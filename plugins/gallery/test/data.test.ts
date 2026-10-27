import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateAlbums, validateManifest } from '../src/schema'
import { readGalleryData } from '../src/data'
import { buildAlbumModule, buildListModule } from '../src/vite'
import { resolveConfig } from '../src/config'
import gallery from '../src/index'
import { objectKey, photoUrl, resolveBaseUrl, srcset, variantWidths } from '../src/urls'
import { itemFlex, sizesAttr } from '../src/layout'
import { pickExif } from '../src/exif'

const photo = (o: object = {}) => ({ id: '3f9a1c0d2b7e', album: 'a', w: 400, h: 300, color: '#112233', variants: [400], formats: ['webp'], ...o })

describe('manifest validation', () => {
  it('accepts a valid manifest', () => {
    expect(validateManifest({ version: 1, photos: [photo()] }).photos).toHaveLength(1)
  })
  it.each([
    [{ version: 2, photos: [] }, 'gallery/manifest.json: version: expected 1'],
    [{ version: 1, photos: [photo({ w: 0 })] }, 'photos[0].w: expected a positive integer'],
    [{ version: 1, photos: [photo({ id: 'XYZ' })] }, 'photos[0].id'],
    [{ version: 1, photos: [photo(), photo()] }, 'photos[1].id: duplicate'],
    [{ version: 1, photos: [photo({ variants: [800, 400] })] }, 'photos[0].variants'],
    [{ version: 1, photos: [photo({ exif: { gps: 1 } })] }, 'photos[0].exif.gps: not allowed']
  ])('rejects %#', (raw, message) => {
    expect(() => validateManifest(raw)).toThrow(message)
  })
})

describe('albums validation', () => {
  const photos = [photo()] as any
  it('accepts a list or { albums }', () => {
    expect(validateAlbums([{ slug: 'a', title: 'A', cover: '3f9a1c0d2b7e' }], photos)).toHaveLength(1)
    expect(validateAlbums({ albums: [{ slug: 'a', title: 'A' }] }, photos)).toHaveLength(1)
  })
  it('names file and field', () => {
    expect(() => validateAlbums([{ slug: 'A b', title: 'x' }], photos)).toThrow('gallery/albums.yaml: [0].slug')
    expect(() => validateAlbums([{ slug: 'b', title: 'B' }], photos)).toThrow('unknown album "a"')
    expect(() => validateAlbums([{ slug: 'a', title: 'A', cover: 'ffffffffffff' }], photos)).toThrow('[0].cover')
  })
})

describe('virtual modules', () => {
  const root = mkdtempSync(join(tmpdir(), 'gal-'))
  mkdirSync(join(root, 'gallery'))
  writeFileSync(join(root, 'gallery/albums.yaml'), '- slug: a\n  title: A\n  date: 2025-01-02\n- slug: b\n  title: B\n  hidden: true\n')
  writeFileSync(join(root, 'gallery/manifest.json'), JSON.stringify({ version: 1, photos: [photo(), photo({ id: 'aaaaaaaaaaaa', album: 'b' })] }))
  it('lists albums with covers and loaders', () => {
    const src = buildListModule(root, 'gallery')
    expect(src).toContain('"slug":"a"')
    expect(src).toContain('"cover":{"id":"3f9a1c0d2b7e","album":"a"')
    expect(src).toContain('import("virtual:vuemo-gallery/album/b")')
  })
  it('builds one album chunk', () => {
    const src = buildAlbumModule(root, 'gallery', 'b')
    expect(src).toContain('aaaaaaaaaaaa')
    expect(src).not.toContain('3f9a1c0d2b7e')
  })
  it('missing files mean empty', () => {
    expect(readGalleryData(root, 'nope').albums).toEqual([])
  })
  it('reports a broken file', () => {
    writeFileSync(join(root, 'gallery/manifest.json'), '{')
    expect(() => buildListModule(root, 'gallery')).toThrow('gallery/manifest.json: invalid JSON')
  })
})

describe('config and plugin', () => {
  it('requires baseUrl for r2, defaults local', () => {
    expect(() => resolveConfig({})).toThrow('baseUrl')
    expect(resolveConfig({ storage: 'local' }).baseUrl).toBe('/gallery')
  })
  it('returns a plugin with a Vite plugin and a client define', () => {
    const p = gallery({ storage: 'local' })
    expect(p.name).toBe('@vuemo/plugin-gallery')
    expect(JSON.parse((p.vite as any).define.__VUEMO_GALLERY__).perPage).toBe(60)
    expect((p.vite as any).plugins[0].name).toBe('vuemo:gallery')
  })
})

describe('urls', () => {
  const cfg = { baseUrl: 'https://img.example.com/', urlBuilder: 'static' as const }
  const p = { album: 'a', id: '3f9a1c0d2b7e', variants: [400, 800] }
  it('builds keys and urls', () => {
    expect(objectKey('a', 'x', 400)).toBe('albums/a/x/400.webp')
    expect(photoUrl(cfg, p, 800)).toBe('https://img.example.com/albums/a/3f9a1c0d2b7e/800.webp')
    expect(srcset(cfg, p)).toBe('https://img.example.com/albums/a/3f9a1c0d2b7e/400.webp 400w, https://img.example.com/albums/a/3f9a1c0d2b7e/800.webp 800w')
  })
  it('cloudflare builder resizes the largest variant', () => {
    expect(photoUrl({ ...cfg, urlBuilder: 'cloudflare' }, p, 600)).toBe(
      'https://img.example.com/cdn-cgi/image/width=600,fit=scale-down,format=auto,quality=80/albums/a/3f9a1c0d2b7e/800.webp'
    )
  })
  it('follows the site base for root-relative urls', () => {
    expect(resolveBaseUrl('/gallery', '/vuemo/')).toBe('/vuemo/gallery')
    expect(resolveBaseUrl('https://x.y', '/vuemo/')).toBe('https://x.y')
  })
  it('never upscales', () => {
    const w = [400, 800, 1600, 2400]
    expect(variantWidths(4000, w)).toEqual(w)
    expect(variantWidths(1000, w)).toEqual([400, 800, 1000])
    expect(variantWidths(300, w)).toEqual([300])
    expect(variantWidths(800, w)).toEqual([400, 800])
  })
})

describe('layout and exif', () => {
  it('justified math', () => {
    expect(itemFlex(300, 200, 200)).toEqual({ grow: 150, basis: 300 })
    expect(sizesAttr(300, 200)).toBe('(max-width: 640px) 210px, 330px')
  })
  it('exif allow-list drops gps and unknown tags', () => {
    const out = pickExif({ Make: 'FUJIFILM', Model: 'X-T5', LensModel: 'XF23', FocalLength: 23, FNumber: 2, ISO: 200, ExposureTime: 0.004, latitude: 1, GPSLatitude: 2, Software: 'x' })
    expect(out).toEqual({ camera: 'FUJIFILM X-T5', lens: 'XF23', focal: 23, aperture: 2, iso: 200, exposure: '1/250' })
    expect(JSON.stringify(out)).not.toMatch(/lat|GPS|Software/i)
    expect(pickExif({})).toBeUndefined()
  })
})
