import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import exifr from 'exifr'
import { add, remove, sync, verify, type Context } from '../src/cli/commands'
import { LocalStorage, R2Storage, r2FromEnv } from '../src/cli/storage'
import { loadEnv } from '../src/cli/env'
import { serializeManifest } from '../src/cli/manifest'
import { installHint, processImage } from '../src/cli/process'
import { takenAtFrom } from '../src/exif'
import { resolveConfig } from '../src/config'

// a JPEG with EXIF (camera, GPS) made by sharp + a hand-written EXIF block through exifr-compatible tags
async function fixture(color: string, w = 900, h = 600) {
  return sharp({ create: { width: w, height: h, channels: 3, background: color } })
    .jpeg()
    .withExif({ IFD0: { Make: 'ACME', Model: 'Cam 1' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '25/1 2/1 3/1', GPSLongitudeRef: 'E', GPSLongitude: '121/1 30/1 0/1' } })
    .toBuffer()
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'galcli-'))
  const photos = join(root, 'photos')
  mkdirSync(photos)
  const logs: string[] = []
  const cfg = resolveConfig({ storage: 'local' })
  const ctx: Context = { root, cfg, storage: new LocalStorage(join(root, 'public/gallery')), log: { info: (m) => logs.push(m), warn: (m) => logs.push('! ' + m) } }
  return { root, photos, ctx, logs }
}

describe('image pipeline', () => {
  it('keeps the allow-listed EXIF and strips GPS from the manifest and from the outputs', async () => {
    const original = await fixture('#336699')
    expect((await exifr.parse(original, { gps: true }))?.latitude).toBeCloseTo(25.0342, 3) // the fixture really has GPS
    const { photo, variants } = await processImage(original, resolveConfig({ storage: 'local' }))
    expect(photo.exif).toEqual({ camera: 'ACME Cam 1' })
    expect(JSON.stringify(photo)).not.toMatch(/latitude|longitude|GPS/i)
    expect(photo.variants).toEqual([400, 800, 900])
    expect(photo.color).toMatch(/^#[0-9a-f]{6}$/)
    for (const v of variants) {
      const out = await exifr.parse(v.data, { gps: true, tiff: true, exif: true }).catch(() => undefined)
      expect(out?.latitude).toBeUndefined()
      expect(out?.Make).toBeUndefined()
      expect((await sharp(v.data).metadata()).exif).toBeUndefined()
    }
  })

  it('limits the long edge with longEdge: a portrait photo becomes 1600 high', async () => {
    const portrait = await sharp({ create: { width: 2400, height: 3200, channels: 3, background: '#4080c0' } }).jpeg().toBuffer()
    const { photo, variants } = await processImage(portrait, resolveConfig({ storage: 'local', widths: [1600], longEdge: 1600 }))
    expect(photo.variants).toEqual([1200])
    const meta = await sharp(variants[0].data).metadata()
    expect([meta.width, meta.height, meta.format]).toEqual([1200, 1600, 'webp'])
  })

  it('rejects a longEdge that is not a positive integer', () => {
    expect(() => resolveConfig({ storage: 'local', longEdge: 0 })).toThrow('"longEdge" must be a positive integer')
  })
})

describe('add / sync / verify / remove (local storage)', () => {
  it('is idempotent', async () => {
    const { photos, ctx, root } = setup()
    writeFileSync(join(photos, 'a.jpg'), await fixture('#aa0000'))
    writeFileSync(join(photos, 'b.jpg'), await fixture('#00aa00', 600, 900))
    const first = await add(ctx, photos, 'trip')
    expect(first).toMatchObject({ added: 2, skipped: 0 })
    const manifest1 = readFileSync(join(root, 'gallery/manifest.json'), 'utf8')
    const second = await add(ctx, photos, 'trip')
    expect(second).toMatchObject({ added: 0, skipped: 2, uploaded: 0 })
    expect(readFileSync(join(root, 'gallery/manifest.json'), 'utf8')).toBe(manifest1)
    expect(readFileSync(join(root, 'gallery/albums.yaml'), 'utf8')).toBe('- slug: trip\n  title: Trip\n')
    expect((await verify(ctx)).errors).toEqual([])
    expect((await verify(ctx)).warnings).toHaveLength(2) // no alt
    expect(await sync(ctx)).toMatchObject({ missing: [], extra: [] })
  })

  it('restores deleted files, prunes unlisted ones and removes a photo', async () => {
    const { photos, ctx } = setup()
    writeFileSync(join(photos, 'a.jpg'), await fixture('#aa0000'))
    await add(ctx, photos, 'trip')
    const keys = await ctx.storage.list('albums/')
    await ctx.storage.delete(keys[0])
    expect((await sync(ctx)).missing).toEqual([keys[0]])
    expect((await verify(ctx)).errors).toHaveLength(1)
    expect(await add(ctx, photos, 'trip')).toMatchObject({ added: 0, skipped: 0, uploaded: 1 })
    await ctx.storage.put('albums/trip/ffffffffffff/400.webp', new Uint8Array([1]), 'image/webp')
    expect(await sync(ctx, { prune: true, yes: true })).toMatchObject({ extra: ['albums/trip/ffffffffffff/400.webp'], deleted: 1 })
    const id = keys[0].split('/')[2]
    expect(await remove(ctx, id)).toBe(true)
    expect(await ctx.storage.list('albums/')).toEqual([])
    expect(await remove(ctx, id)).toBe(false)
  })
})

describe('R2 storage with a mocked fetch', () => {
  it('signs requests, HEADs first and only uploads what is missing', async () => {
    const store = new Map<string, { body: Uint8Array; headers: Headers }>()
    const calls: string[] = []
    const fetchMock = (async (req: Request) => {
      const key = decodeURIComponent(new URL(req.url).pathname.replace(/^\/bucket\//, ''))
      calls.push(`${req.method} ${key}`)
      expect(req.url.startsWith('https://acct.r2.cloudflarestorage.com/bucket')).toBe(true)
      expect(req.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID\/\d{8}\/auto\/s3\/aws4_request/)
      if (req.method === 'HEAD') return new Response(null, { status: store.has(key) ? 200 : 404 })
      if (req.method === 'PUT') {
        store.set(key, { body: new Uint8Array(await req.arrayBuffer()), headers: req.headers })
        return new Response(null, { status: 200 })
      }
      if (req.method === 'GET') {
        const prefix = new URL(req.url).searchParams.get('prefix')!
        return new Response(`<ListBucketResult>${[...store.keys()].filter((k) => k.startsWith(prefix)).map((k) => `<Contents><Key>${k}</Key></Contents>`).join('')}<IsTruncated>false</IsTruncated></ListBucketResult>`)
      }
      return new Response(null, { status: 204 })
    }) as typeof fetch
    const { photos, root, logs } = setup()
    const ctx: Context = {
      root,
      cfg: resolveConfig({ storage: 'r2', baseUrl: 'https://img.example.com' }),
      storage: new R2Storage({ accountId: 'acct', accessKeyId: 'AKID', secretAccessKey: 'secret', bucket: 'bucket' }, fetchMock),
      log: { info: (m) => logs.push(m), warn: (m) => logs.push(m) }
    }
    writeFileSync(join(photos, 'a.jpg'), await fixture('#aa0000'))
    expect(await add(ctx, photos, 'trip')).toMatchObject({ added: 1, uploaded: 3 })
    const puts = calls.filter((c) => c.startsWith('PUT')).length
    expect(puts).toBe(3)
    const [first] = [...store.values()]
    expect(first.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(first.headers.get('content-type')).toBe('image/webp')
    calls.length = 0
    expect(await add(ctx, photos, 'trip')).toMatchObject({ added: 0, skipped: 1, uploaded: 0 })
    expect(calls.every((c) => c.startsWith('HEAD'))).toBe(true)
    expect(await sync(ctx)).toMatchObject({ missing: [], extra: [] })
  })
})

describe('R2 listing', () => {
  it('unescapes XML in the listed keys', async () => {
    const xml = '<ListBucketResult><Contents><Key>albums/a&amp;b/x&lt;1&gt;/it&apos;s&#x41;.webp</Key></Contents><IsTruncated>false</IsTruncated></ListBucketResult>'
    const storage = new R2Storage({ accountId: 'a', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b' }, (async () => new Response(xml)) as typeof fetch)
    expect(await storage.list('albums/')).toEqual(["albums/a&b/x<1>/it'sA.webp"])
  })
})

describe('manifest and env', () => {
  it('serializes stably regardless of input order', () => {
    const p = (id: string, album: string, takenAt?: string) => ({ id, album, w: 1, h: 1, color: '#000000', variants: [1], formats: ['webp'], ...(takenAt && { takenAt }) }) as any
    const a = serializeManifest({ version: 1, photos: [p('bbbbbbbbbbbb', 'x'), p('aaaaaaaaaaaa', 'x', '2020-01-01T00:00:00.000Z'), p('cccccccccccc', 'a')] })
    const b = serializeManifest({ version: 1, photos: [p('cccccccccccc', 'a'), p('bbbbbbbbbbbb', 'x'), p('aaaaaaaaaaaa', 'x', '2020-01-01T00:00:00.000Z')] })
    expect(a).toBe(b)
    expect(a.indexOf('cccccccccccc')).toBeLessThan(a.indexOf('aaaaaaaaaaaa'))
    expect(a.indexOf('aaaaaaaaaaaa')).toBeLessThan(a.indexOf('bbbbbbbbbbbb'))
  })
  it('strips inline comments from .env values but keeps a # inside quotes', () => {
    const root = mkdtempSync(join(tmpdir(), 'galenv-'))
    writeFileSync(join(root, '.env'), 'A=plain # note\nB="has # inside" # note\nC=no#space\nD=\'q\'\n')
    const env: Record<string, string | undefined> = {}
    loadEnv(root, env)
    expect(env).toEqual({ A: 'plain', B: 'has # inside', C: 'no#space', D: 'q' })
  })
  it('loads .env without overriding the environment', () => {
    const root = mkdtempSync(join(tmpdir(), 'galenv-'))
    writeFileSync(join(root, '.env'), '# c\nR2_BUCKET="b"\nexport R2_ACCOUNT_ID=acct\nR2_ACCESS_KEY_ID=file\n')
    const env: Record<string, string | undefined> = { R2_ACCESS_KEY_ID: 'shell' }
    expect(loadEnv(root, env)).toBe(true)
    expect(env).toEqual({ R2_ACCESS_KEY_ID: 'shell', R2_BUCKET: 'b', R2_ACCOUNT_ID: 'acct' })
  })
})


describe('albums.yaml when adding an album', () => {
  const addTo = async (yaml: string | undefined, manifestPhotos?: string[]) => {
    const { photos, ctx, root } = setup()
    mkdirSync(join(root, 'gallery'))
    if (yaml !== undefined) writeFileSync(join(root, 'gallery/albums.yaml'), yaml)
    if (manifestPhotos)
      writeFileSync(join(root, 'gallery/manifest.json'), JSON.stringify({ version: 1, photos: manifestPhotos.map((id, i) => ({ id, album: 'old', w: 1, h: 1, color: '#000000', variants: [400], formats: ['webp'] })) }))
    writeFileSync(join(photos, 'a.jpg'), await fixture('#aa0000'))
    await add(ctx, photos, 'new-one')
    return { text: readFileSync(join(root, 'gallery/albums.yaml'), 'utf8'), ctx }
  }
  it('appends to the mapping form (albums:) and keeps the comments', async () => {
    const { text, ctx } = await addTo('# my albums\nalbums:\n  - slug: old\n    title: Old # first\n')
    expect(text).toContain('# my albums')
    expect(text).toContain('# first')
    expect(text).toMatch(/albums:\n {2}- slug: old\n {4}title: Old # first\n {2}- slug: new-one\n {4}title: New One\n/)
    expect(() => readGalleryDataFor(ctx)).not.toThrow()
  })
  it('appends to the list form', async () => {
    const { text } = await addTo('- slug: old\n  title: Old\n')
    expect(text).toBe('- slug: old\n  title: Old\n- slug: new-one\n  title: New One\n')
  })
  it('handles an empty file and an empty albums: key', async () => {
    expect((await addTo('')).text).toBe('- slug: new-one\n  title: New One\n')
    expect((await addTo('albums:\n')).text).toBe('albums:\n  - slug: new-one\n    title: New One\n')
  })
  it('keeps the albums derived from the photos when it creates the file', async () => {
    const { text, ctx } = await addTo(undefined, ['bbbbbbbbbbbb'])
    expect(text).toBe('- slug: old\n  title: Old\n- slug: new-one\n  title: New One\n')
    expect(() => readGalleryDataFor(ctx)).not.toThrow()
  })
})
import { readGalleryData } from '../src/data'
const readGalleryDataFor = (ctx: Context) => readGalleryData(ctx.root, ctx.cfg.dir)

describe('remove', () => {
  it('refuses to remove the cover of an album and removes it once the cover is changed', async () => {
    const { photos, ctx, root } = setup()
    writeFileSync(join(photos, 'a.jpg'), await fixture('#aa0000'))
    await add(ctx, photos, 'trip')
    const id = JSON.parse(readFileSync(join(root, 'gallery/manifest.json'), 'utf8')).photos[0].id
    writeFileSync(join(root, 'gallery/albums.yaml'), `- slug: trip\n  title: Trip\n  cover: "${id}"\n`)
    expect(await remove(ctx, id)).toBe(false)
    expect((await ctx.storage.list('albums/')).length).toBeGreaterThan(0)
    writeFileSync(join(root, 'gallery/albums.yaml'), '- slug: trip\n  title: Trip\n')
    expect(await remove(ctx, id)).toBe(true)
  })
})

describe('photo date', () => {
  it('reads DateTimeOriginal as UTC without an offset and exactly with one, whatever the time zone', () => {
    expect(takenAtFrom({ DateTimeOriginal: '2025:04:12 17:03:00' })).toBe('2025-04-12T17:03:00.000Z')
    expect(takenAtFrom({ DateTimeOriginal: '2025:04:12 17:03:00', OffsetTimeOriginal: '+09:00' })).toBe('2025-04-12T08:03:00.000Z')
    expect(takenAtFrom({ DateTimeOriginal: '2025:04:12 01:03:00', OffsetTimeOriginal: '-05:30' })).toBe('2025-04-12T06:33:00.000Z')
    expect(takenAtFrom({ DateTimeOriginal: 'garbage' })).toBeUndefined()
    expect(takenAtFrom({})).toBeUndefined()
    expect(takenAtFrom(undefined)).toBeUndefined()
  })
  it('keeps takenAt (and a date from the file) with exif: false, and drops only the exif block', async () => {
    const img = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#445566' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'ACME', Model: 'Cam 1' }, IFD2: { DateTimeOriginal: '2025:04:12 17:03:00' } })
      .toBuffer()
    const off = await processImage(img, resolveConfig({ storage: 'local', exif: false }))
    expect(off.photo.exif).toBeUndefined()
    expect(off.photo.takenAt).toBe('2025-04-12T17:03:00.000Z')
    const on = await processImage(img, resolveConfig({ storage: 'local' }))
    expect(on.photo).toMatchObject({ takenAt: '2025-04-12T17:03:00.000Z', exif: { camera: 'ACME Cam 1' } })
  })
  it('makes the thumbnails from one decode (sizes, grayscale colour)', async () => {
    const gray = await sharp({ create: { width: 1000, height: 500, channels: 3, background: '#808080' } }).grayscale().png().toBuffer()
    const r = await processImage(gray, resolveConfig({ storage: 'local', widths: [400, 800] }))
    expect(r.photo).toMatchObject({ w: 1000, h: 500, variants: [400, 800] })
    expect(r.photo.color).toMatch(/^#[0-9a-f]{6}$/)
    expect((await sharp(r.variants[0].data).metadata()).width).toBe(400)
  })
})

describe('install hint', () => {
  it('follows the lockfile of the project', () => {
    const root = mkdtempSync(join(tmpdir(), 'galhint-'))
    writeFileSync(join(root, 'yarn.lock'), '')
    expect(installHint(root)).toBe('yarn add -D sharp')
    writeFileSync(join(root, 'pnpm-lock.yaml'), '')
    expect(installHint(root)).toBe('pnpm add -D sharp')
  })
})

describe('R2 credentials', () => {
  const ok = { R2_ACCOUNT_ID: '3e1a93ddba71fe2c341db82b01b6b320', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', R2_BUCKET: 'my-photos' }

  it('accepts an account ID and a bucket name', () => {
    expect(r2FromEnv(ok).bucket).toBe('my-photos')
  })

  it('rejects an API token as the account ID without printing it', () => {
    expect(() => r2FromEnv({ ...ok, R2_ACCOUNT_ID: 'cfat_SECRETVALUE' })).toThrow(/R2_ACCOUNT_ID must be the 32-character account ID/)
    expect(() => r2FromEnv({ ...ok, R2_ACCOUNT_ID: 'cfat_SECRETVALUE' })).not.toThrow(/SECRETVALUE/)
  })

  it('rejects a domain or a stray character in the bucket name', () => {
    expect(() => r2FromEnv({ ...ok, R2_BUCKET: ':laplacetw' })).toThrow(/R2_BUCKET must be the bucket name/)
    expect(() => r2FromEnv({ ...ok, R2_BUCKET: 'img.example.com' })).toThrow(/R2_BUCKET/)
  })

  it('names the network cause when fetch fails', async () => {
    const failing = (async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })
    }) as typeof fetch
    const storage = new R2Storage({ accountId: 'a', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b' }, failing)
    await expect(storage.has('albums/x/1/1600.webp')).rejects.toThrow(/fetch failed \(ENOTFOUND\) while reaching a\.r2\.cloudflarestorage\.com/)
  })
})
