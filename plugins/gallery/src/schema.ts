import type { Album, ImageFormat, Manifest, Photo } from './types'

export const ID_RE = /^[0-9a-f]{12}$/
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const FORMATS: ImageFormat[] = ['webp', 'avif', 'jpeg']
const PHOTO_KEYS = ['id', 'album', 'w', 'h', 'color', 'thumbhash', 'alt', 'caption', 'takenAt', 'exif', 'variants', 'formats']
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/
const EXIF_KEYS = ['camera', 'lens', 'focal', 'aperture', 'iso', 'exposure'] as const

/** Thrown for any problem in the gallery files; the message names the file and the field. */
export class GalleryDataError extends Error {
  constructor(file: string, field: string, problem: string) {
    super(`${file}: ${field ? field + ': ' : ''}${problem}`)
    this.name = 'GalleryDataError'
  }
}

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0

export function validateManifest(raw: unknown, file = 'gallery/manifest.json'): Manifest {
  const bad = (field: string, problem: string): never => {
    throw new GalleryDataError(file, field, problem)
  }
  if (!isObj(raw)) return bad('', 'expected an object')
  if (raw.version !== 1) bad('version', 'expected 1')
  if (!Array.isArray(raw.photos)) bad('photos', 'expected a list')
  const seen = new Set<string>()
  const photos = (raw.photos as unknown[]).map((p, i): Photo => {
    const at = (f: string) => `photos[${i}].${f}`
    if (!isObj(p)) return bad(`photos[${i}]`, 'expected an object')
    for (const k of Object.keys(p)) if (!PHOTO_KEYS.includes(k)) bad(at(k), `not allowed (allowed: ${PHOTO_KEYS.join(', ')})`)
    if (typeof p.id !== 'string' || !ID_RE.test(p.id)) bad(at('id'), 'expected 12 lowercase hex characters')
    if (seen.has(p.id)) bad(at('id'), `duplicate id "${p.id}"`)
    seen.add(p.id)
    if (typeof p.album !== 'string' || !SLUG_RE.test(p.album)) bad(at('album'), 'expected a slug (a-z, 0-9, -)')
    if (!isPosInt(p.w)) bad(at('w'), 'expected a positive integer')
    if (!isPosInt(p.h)) bad(at('h'), 'expected a positive integer')
    if (typeof p.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(p.color)) bad(at('color'), 'expected a colour like #8a7d6b')
    for (const k of ['thumbhash', 'alt', 'caption', 'takenAt']) if (p[k] !== undefined && typeof p[k] !== 'string') bad(at(k), 'expected a string')
    if (p.thumbhash !== undefined && !BASE64_RE.test(p.thumbhash)) bad(at('thumbhash'), 'expected a base64 string')
    if (p.takenAt !== undefined && Number.isNaN(Date.parse(p.takenAt))) bad(at('takenAt'), 'expected a date')
    if (!Array.isArray(p.variants) || !p.variants.length || !p.variants.every(isPosInt) || p.variants.some((v: number, j: number) => j && v <= p.variants[j - 1]))
      bad(at('variants'), 'expected a non-empty ascending list of positive integers')
    if (!Array.isArray(p.formats) || !p.formats.length || !p.formats.every((f: unknown) => FORMATS.includes(f as ImageFormat)))
      bad(at('formats'), `expected a non-empty list of ${FORMATS.join(', ')}`)
    if (p.exif !== undefined) {
      if (!isObj(p.exif)) bad(at('exif'), 'expected an object')
      for (const k of Object.keys(p.exif)) if (!(EXIF_KEYS as readonly string[]).includes(k)) bad(at(`exif.${k}`), `not allowed (allowed: ${EXIF_KEYS.join(', ')})`)
    }
    return p as Photo
  })
  return { version: 1, photos }
}

export function validateAlbums(raw: unknown, photos: Photo[], file = 'gallery/albums.yaml'): Album[] {
  const bad = (field: string, problem: string): never => {
    throw new GalleryDataError(file, field, problem)
  }
  const list = isObj(raw) && 'albums' in raw ? raw.albums : raw
  if (list == null) return []
  if (!Array.isArray(list)) return bad('', 'expected a list of albums')
  const slugs = new Set<string>()
  const albums = list.map((a, i): Album => {
    const at = (f: string) => `[${i}].${f}`
    if (!isObj(a)) return bad(`[${i}]`, 'expected a mapping')
    if (typeof a.slug !== 'string' || !SLUG_RE.test(a.slug)) bad(at('slug'), 'expected a slug (a-z, 0-9, -)')
    if (slugs.has(a.slug)) bad(at('slug'), `duplicate slug "${a.slug}"`)
    slugs.add(a.slug)
    if (typeof a.title !== 'string' || !a.title) bad(at('title'), 'expected a non-empty string')
    if (a.description !== undefined && typeof a.description !== 'string') bad(at('description'), 'expected a string')
    if (a.order !== undefined && typeof a.order !== 'number') bad(at('order'), 'expected a number')
    if (a.hidden !== undefined && typeof a.hidden !== 'boolean') bad(at('hidden'), 'expected true or false')
    let date = a.date
    if (date instanceof Date) date = date.toISOString().slice(0, 10)
    if (date !== undefined && (typeof date !== 'string' || Number.isNaN(Date.parse(date)))) bad(at('date'), 'expected a date')
    if (a.cover !== undefined) {
      const photo = photos.find((p) => p.id === String(a.cover))
      if (!photo) bad(at('cover'), `no photo with id "${a.cover}" (put the id in quotes: ids made only of digits are read by YAML as numbers, e.g. cover: "123456789012")`)
      else if (photo.album !== a.slug) bad(at('cover'), `photo "${a.cover}" belongs to album "${photo.album}"`)
    }
    return { ...a, date, cover: a.cover === undefined ? undefined : String(a.cover) } as Album
  })
  for (const [i, p] of photos.entries()) if (!slugs.has(p.album)) throw new GalleryDataError('gallery/manifest.json', `photos[${i}].album`, `unknown album "${p.album}" (define it in ${file})`)
  return albums
}

/** Albums to show, in display order. Without `albums.yaml` they are derived from the photos. */
export function sortAlbums(albums: Album[]): Album[] {
  return [...albums].sort(
    (a, b) =>
      (a.order ?? Infinity) - (b.order ?? Infinity) || (b.date ?? '').localeCompare(a.date ?? '') || a.slug.localeCompare(b.slug)
  )
}

export function deriveAlbums(photos: Photo[]): Album[] {
  return [...new Set(photos.map((p) => p.album))].map((slug) => ({ slug, title: slug }))
}
