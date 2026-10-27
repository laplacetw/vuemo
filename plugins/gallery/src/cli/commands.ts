import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { albumsPath, manifestPath, readGalleryData } from '../data'
import { SLUG_RE } from '../schema'
import type { Photo, ResolvedGalleryConfig } from '../types'
import { MIME, objectKey } from '../urls'
import { keysOf, writeManifest } from './manifest'
import { processImage, photoId } from './process'
import type { Storage } from './storage'

export interface Context {
  root: string
  cfg: ResolvedGalleryConfig
  storage: Storage
  log: { info(m: string): void; warn(m: string): void }
}

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff', '.gif'])
const keyOf = (p: Pick<Photo, 'album' | 'id' | 'variants' | 'formats'>) => keysOf(p, objectKey)
const noAlt = (ctx: Context, id: string, name: string) =>
  ctx.log.warn(`photo ${id} (${name}) has no alt text: add "alt" in ${ctx.cfg.dir}/manifest.json`)

function listImages(dir: string): string[] {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n)
      return statSync(p).isDirectory() ? walk(p) : IMAGE_EXT.has(extname(n).toLowerCase()) ? [p] : []
    })
  return walk(dir).sort()
}

const titleOf = (slug: string) => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export interface AddResult { added: number; skipped: number; uploaded: number; failed: number }

/** Idempotent: a photo already in the manifest whose files all exist is skipped; missing files are uploaded again. */
export async function add(ctx: Context, dir: string, album: string): Promise<AddResult> {
  if (!SLUG_RE.test(album)) throw new Error(`"${album}" is not a valid album slug (a-z, 0-9, -)`)
  if (!existsSync(dir)) throw new Error(`${dir} does not exist`)
  const { manifest, albums } = readGalleryData(ctx.root, ctx.cfg.dir)
  const result: AddResult = { added: 0, skipped: 0, uploaded: 0, failed: 0 }
  if (!albums.some((a) => a.slug === album)) {
    const file = albumsPath(ctx.root, ctx.cfg.dir)
    const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
    mkdirSync(dirname(file), { recursive: true })
    appendFileSync(file, `${current && !current.endsWith('\n') ? '\n' : ''}- slug: ${album}\n  title: ${titleOf(album)}\n`)
    ctx.log.info(`added album "${album}" to ${ctx.cfg.dir}/albums.yaml`)
  }
  for (const file of listImages(dir)) {
    const name = basename(file)
    try {
      const original = readFileSync(file)
      const id = photoId(original)
      const existing = manifest.photos.find((p) => p.id === id)
      if (existing) {
        if (existing.album !== album) ctx.log.warn(`${name} is already in album "${existing.album}"; left there`)
        const missing: string[] = []
        for (const k of keyOf(existing)) if (!(await ctx.storage.has(k))) missing.push(k)
        if (!missing.length) {
          result.skipped++
          continue
        }
        const { variants } = await processImage(original, { ...ctx.cfg, widths: existing.variants, formats: existing.formats })
        for (const v of variants) {
          const k = objectKey(existing.album, id, v.width, v.format)
          if (missing.includes(k)) (await ctx.storage.put(k, v.data, MIME[v.format]), result.uploaded++)
        }
        ctx.log.info(`${name}: restored ${missing.length} missing file(s)`)
        continue
      }
      const { photo, variants } = await processImage(original, ctx.cfg)
      const full: Photo = { ...photo, album }
      for (const v of variants) {
        const k = objectKey(album, id, v.width, v.format)
        if (!(await ctx.storage.has(k))) (await ctx.storage.put(k, v.data, MIME[v.format]), result.uploaded++)
      }
      manifest.photos.push(full)
      result.added++
      ctx.log.info(`${name} -> ${id}`)
      noAlt(ctx, id, name)
    } catch (e) {
      result.failed++
      ctx.log.warn(`${name}: ${(e as Error).message}`)
    }
  }
  if (result.added) writeManifest(manifestPath(ctx.root, ctx.cfg.dir), manifest)
  return result
}

export interface SyncResult { missing: string[]; extra: string[]; deleted: number }

/** Compares the storage with the manifest. `prune` deletes what the manifest does not list. Missing files need `add` with the originals. */
export async function sync(ctx: Context, prune = false): Promise<SyncResult> {
  const { manifest } = readGalleryData(ctx.root, ctx.cfg.dir)
  const expected = new Set(manifest.photos.flatMap(keyOf))
  const present = new Set(await ctx.storage.list('albums/'))
  const missing = [...expected].filter((k) => !present.has(k)).sort()
  const extra = [...present].filter((k) => !expected.has(k)).sort()
  let deleted = 0
  if (prune) for (const k of extra) (await ctx.storage.delete(k), deleted++)
  return { missing, extra, deleted }
}

export interface VerifyResult { errors: string[]; warnings: string[] }

/** Offline checks (files and fields, alt text); `remote` also asks the storage whether every file exists. Throws for an invalid file. */
export async function verify(ctx: Context, remote = false): Promise<VerifyResult> {
  const { manifest } = readGalleryData(ctx.root, ctx.cfg.dir)
  const r: VerifyResult = { errors: [], warnings: [] }
  for (const p of manifest.photos) {
    if (!p.alt) r.warnings.push(`photo ${p.id} (album ${p.album}) has no alt text`)
    if (ctx.cfg.storage === 'local' || remote)
      for (const k of keyOf(p)) if (!(await ctx.storage.has(k))) r.errors.push(`missing file: ${k}`)
  }
  return r
}

export async function remove(ctx: Context, id: string): Promise<boolean> {
  const { manifest } = readGalleryData(ctx.root, ctx.cfg.dir)
  const p = manifest.photos.find((x) => x.id === id)
  if (!p) {
    ctx.log.warn(`no photo with id ${id}`)
    return false
  }
  for (const k of keyOf(p)) await ctx.storage.delete(k)
  manifest.photos = manifest.photos.filter((x) => x.id !== id)
  writeManifest(manifestPath(ctx.root, ctx.cfg.dir), manifest)
  ctx.log.info(`removed ${id}`)
  return true
}
