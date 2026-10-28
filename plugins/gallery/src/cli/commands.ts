import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { albumsPath, manifestPath, readGalleryData } from '../data'
import { Document, isMap, isSeq, parseDocument } from 'yaml'
import { SLUG_RE } from '../schema'
import type { Album, Photo, ResolvedGalleryConfig } from '../types'
import { MIME, objectKey } from '../urls'
import { keysOf, writeManifest } from './manifest'
import { loadSharp, processImage, photoId } from './process'
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

/** Image files under `dir`; dot-folders/files and symbolic links are skipped. */
function listImages(dir: string): string[] {
  const walk = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      if (e.name.startsWith('.') || e.isSymbolicLink()) return []
      const p = join(d, e.name)
      return e.isDirectory() ? walk(p) : e.isFile() && IMAGE_EXT.has(extname(e.name).toLowerCase()) ? [p] : []
    })
  return walk(dir).sort()
}

const titleOf = (slug: string) => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

/** Adds an album to `albums.yaml` (a list, or a mapping with `albums:`), keeping the comments of an existing file. */
function addAlbumToFile(file: string, slug: string, derived: Album[]) {
  const entry = { slug, title: titleOf(slug) }
  mkdirSync(dirname(file), { recursive: true })
  if (!existsSync(file)) {
    // no file yet: the albums derived from the photos so far become explicit, or the existing photos would lose their albums
    const own = derived.map((a) => ({ slug: a.slug, title: titleOf(a.slug) }))
    writeFileSync(file, String(new Document([...own, entry])))
    return
  }
  const doc = parseDocument(readFileSync(file, 'utf8'))
  const root = doc.contents
  if (isSeq(root)) root.add(doc.createNode(entry) as any)
  else if (isMap(root)) {
    const list = root.get('albums', true)
    if (isSeq(list)) list.add(doc.createNode(entry) as any)
    else doc.set('albums', doc.createNode([entry]))
  } else doc.contents = doc.createNode([entry]) as any
  writeFileSync(file, doc.toString({ lineWidth: 0 }))
}

export interface AddResult { added: number; skipped: number; uploaded: number; failed: number }

/** Idempotent: a photo already in the manifest whose files all exist is skipped; missing files are uploaded again. */
export async function add(ctx: Context, dir: string, album: string): Promise<AddResult> {
  if (!SLUG_RE.test(album)) throw new Error(`"${album}" is not a valid album slug (a-z, 0-9, -)`)
  if (!existsSync(dir)) throw new Error(`${dir} does not exist`)
  await loadSharp(ctx.root) // one clear failure before anything is written
  const { manifest, albums } = readGalleryData(ctx.root, ctx.cfg.dir)
  const result: AddResult = { added: 0, skipped: 0, uploaded: 0, failed: 0 }
  if (!albums.some((a) => a.slug === album)) {
    addAlbumToFile(albumsPath(ctx.root, ctx.cfg.dir), album, albums)
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
      ctx.log.info(`${name} -> "${id}"`)
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

export interface SyncOptions {
  /** Delete what the manifest does not list. */
  prune?: boolean
  /** Do not ask. */
  yes?: boolean
  /** Allow deleting everything under `albums/` (an empty manifest, or a manifest that matches nothing in the storage). */
  force?: boolean
  /** Asked before deleting (an interactive prompt); without it, `prune` needs `yes`. */
  confirm?: (extra: string[]) => Promise<boolean>
}

/**
 * Compares the storage with the manifest. `prune` deletes what the manifest does not list, so it is guarded: the manifest
 * must exist, deleting every object needs `force`, and the number of objects is confirmed (or `yes` given) first.
 * Missing files need `add` with the originals.
 */
export async function sync(ctx: Context, o: SyncOptions = {}): Promise<SyncResult> {
  const file = manifestPath(ctx.root, ctx.cfg.dir)
  const { manifest } = readGalleryData(ctx.root, ctx.cfg.dir)
  const expected = new Set(manifest.photos.flatMap(keyOf))
  const present = new Set(await ctx.storage.list('albums/'))
  const missing = [...expected].filter((k) => !present.has(k)).sort()
  const extra = [...present].filter((k) => !expected.has(k)).sort()
  let deleted = 0
  if (o.prune && extra.length) {
    if (!existsSync(file)) throw new Error(`refusing to prune: ${ctx.cfg.dir}/manifest.json does not exist (is this the right project and \`dir\`?). Nothing was deleted.`)
    if (!manifest.photos.length && !o.force) throw new Error(`refusing to prune: ${ctx.cfg.dir}/manifest.json lists no photos, so all ${extra.length} object(s) would be deleted. Use --force if that is what you want. Nothing was deleted.`)
    if (extra.length === present.size && !o.force)
      throw new Error(`refusing to prune: none of the ${extra.length} object(s) in the storage is listed in the manifest (wrong bucket or \`dir\`?). Use --force to delete them all. Nothing was deleted.`)
    if (!o.yes) {
      if (!o.confirm) throw new Error(`refusing to delete ${extra.length} object(s) without confirmation: pass --yes (or run in a terminal to be asked). Nothing was deleted.`)
      if (!(await o.confirm(extra))) throw new Error('cancelled. Nothing was deleted.')
    }
    for (const k of extra) (await ctx.storage.delete(k), deleted++)
  }
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
  const { manifest, albums } = readGalleryData(ctx.root, ctx.cfg.dir)
  const p = manifest.photos.find((x) => x.id === id)
  if (!p) {
    ctx.log.warn(`no photo with id ${id}`)
    return false
  }
  const covered = albums.find((a) => a.cover === id)
  if (covered) {
    ctx.log.warn(`"${id}" is the cover of album "${covered.slug}": change or remove \`cover\` in ${ctx.cfg.dir}/albums.yaml first. Nothing was removed.`)
    return false
  }
  for (const k of keyOf(p)) await ctx.storage.delete(k)
  manifest.photos = manifest.photos.filter((x) => x.id !== id)
  writeManifest(manifestPath(ctx.root, ctx.cfg.dir), manifest)
  ctx.log.info(`removed "${id}"`)
  return true
}
