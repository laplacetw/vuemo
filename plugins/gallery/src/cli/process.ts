import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import exifr from 'exifr'
import { rgbaToThumbHash } from 'thumbhash'
import { pickExif, takenAtFrom } from '../exif'
import type { ExifInfo, ImageFormat, Photo, ResolvedGalleryConfig } from '../types'
import { variantWidths } from '../urls'

/** Install command for the project's package manager (by lockfile, looking upwards from `root`). */
export function installHint(root: string): string {
  for (let d = resolve(root); ; d = dirname(d)) {
    if (existsSync(join(d, 'pnpm-lock.yaml'))) return 'pnpm add -D sharp'
    if (existsSync(join(d, 'yarn.lock'))) return 'yarn add -D sharp'
    if (existsSync(join(d, 'package-lock.json'))) return 'npm i -D sharp'
    if (dirname(d) === d) return 'npm i -D sharp'
  }
}

/** sharp is an optional peer: only the CLI needs it, and it is loaded when first used. */
export async function loadSharp(root = process.cwd()): Promise<typeof import('sharp')> {
  try {
    const m: any = await import('sharp')
    return m.default ?? m
  } catch {
    throw new Error(`The CLI needs sharp to make thumbnails. Install it: ${installHint(root)}`)
  }
}

export const photoId = (original: Uint8Array) => createHash('sha256').update(original).digest('hex').slice(0, 12)

export interface Processed {
  photo: Omit<Photo, 'album'>
  variants: { width: number; format: ImageFormat; data: Buffer }[]
}

export async function processImage(original: Buffer, cfg: Pick<ResolvedGalleryConfig, 'widths' | 'formats' | 'exif'>): Promise<Processed> {
  const sharp = await loadSharp()
  // decode once (rotated by EXIF orientation, sRGB); every thumbnail below is made from these pixels
  let decoded: { data: Buffer; info: { width: number; height: number; channels: number } }
  try {
    decoded = (await sharp(original, { failOn: 'none' }).rotate().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true })) as any
  } catch {
    throw new Error('not an image sharp can read')
  }
  const { width: w, height: h, channels } = decoded.info
  if (!w || !h) throw new Error('not an image sharp can read')
  const base = () => sharp(decoded.data, { raw: { width: w, height: h, channels: channels as 1 | 2 | 3 | 4 } })

  const px = await base().resize(1, 1, { fit: 'cover' }).removeAlpha().toColourspace('srgb').raw().toBuffer()
  const color = '#' + [...px.subarray(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('')
  const small = await base().resize(100, 100, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const thumbhash = Buffer.from(rgbaToThumbHash(small.info.width, small.info.height, small.data)).toString('base64')

  let raw: Record<string, any> | undefined
  try {
    // gps: false: the GPS block is not even parsed; reviveValues: false keeps dates as the strings in the file
    raw = (await exifr.parse(original, { tiff: true, ifd0: true, exif: true, gps: false, xmp: false, icc: false, iptc: false, reviveValues: false } as any)) ?? undefined
  } catch {
    raw = undefined
  }
  // the date is kept even with `exif: false` (it orders the photos); the EXIF block is what `exif: false` drops
  const takenAt = takenAtFrom(raw)
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
