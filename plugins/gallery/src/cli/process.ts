import { createHash } from 'node:crypto'
import exifr from 'exifr'
import { rgbaToThumbHash } from 'thumbhash'
import { pickExif } from '../exif'
import type { ExifInfo, ImageFormat, Photo, ResolvedGalleryConfig } from '../types'
import { variantWidths } from '../urls'

/** sharp is an optional peer: only the CLI needs it, and it is loaded when first used. */
export async function loadSharp(): Promise<typeof import('sharp')> {
  try {
    const m: any = await import('sharp')
    return m.default ?? m
  } catch {
    throw new Error('The CLI needs sharp to make thumbnails. Install it: pnpm add -D sharp')
  }
}

export const photoId = (original: Uint8Array) => createHash('sha256').update(original).digest('hex').slice(0, 12)

export interface Processed {
  photo: Omit<Photo, 'album'>
  variants: { width: number; format: ImageFormat; data: Buffer }[]
}

export async function processImage(original: Buffer, cfg: Pick<ResolvedGalleryConfig, 'widths' | 'formats' | 'exif'>): Promise<Processed> {
  const sharp = await loadSharp()
  const meta = await sharp(original, { failOn: 'none' }).metadata()
  if (!meta.width || !meta.height) throw new Error('not an image sharp can read')
  const turned = (meta.orientation ?? 1) >= 5
  const w = turned ? meta.height : meta.width
  const h = turned ? meta.width : meta.height

  const base = () => sharp(original, { failOn: 'none' }).rotate()
  const px = await base().resize(1, 1, { fit: 'cover' }).removeAlpha().raw().toBuffer()
  const color = '#' + [...px.subarray(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('')
  const small = await base().resize(100, 100, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const thumbhash = Buffer.from(rgbaToThumbHash(small.info.width, small.info.height, small.data)).toString('base64')

  let raw: Record<string, any> | undefined
  try {
    // gps: false: the GPS block is not even parsed
    raw = (await exifr.parse(original, { tiff: true, ifd0: true, exif: true, gps: false, xmp: false, icc: false, iptc: false } as any)) ?? undefined
  } catch {
    raw = undefined
  }
  const takenAt = raw?.DateTimeOriginal instanceof Date && !Number.isNaN(+raw.DateTimeOriginal) ? raw.DateTimeOriginal.toISOString() : undefined
  const exif: ExifInfo | undefined = cfg.exif ? pickExif(raw) : undefined

  const widths = variantWidths(w, cfg.widths)
  const variants: Processed['variants'] = []
  for (const format of cfg.formats) {
    for (const width of widths) {
      // no `withMetadata()`: the output carries no EXIF, so no GPS
      const img = base().resize({ width, withoutEnlargement: true })
      const data = await (format === 'jpeg' ? img.jpeg({ quality: 82, mozjpeg: true }) : format === 'avif' ? img.avif({ quality: 55 }) : img.webp({ quality: 80 })).toBuffer()
      variants.push({ width, format, data })
    }
  }
  return {
    photo: { id: photoId(original), w, h, color, thumbhash, ...(takenAt && { takenAt }), ...(exif && { exif }), variants: widths, formats: [...cfg.formats] },
    variants
  }
}
