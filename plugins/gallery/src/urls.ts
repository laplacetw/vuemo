import type { ImageFormat, Photo, ResolvedGalleryConfig } from './types'

export const MIME: Record<ImageFormat, string> = { webp: 'image/webp', avif: 'image/avif', jpeg: 'image/jpeg' }
export const EXT: Record<ImageFormat, string> = { webp: 'webp', avif: 'avif', jpeg: 'jpg' }

/** Object key of one variant: `albums/<slug>/<id>/<width>.<ext>`. */
export const objectKey = (album: string, id: string, width: number, format: ImageFormat = 'webp') =>
  `albums/${album}/${id}/${width}.${EXT[format]}`

/** A root-relative `baseUrl` (`/gallery`) follows the site base; an absolute one is kept. */
export function resolveBaseUrl(baseUrl: string, siteBase = '/'): string {
  if (baseUrl.startsWith('/') && !baseUrl.startsWith('//')) return siteBase.replace(/\/+$/, '') + baseUrl
  return baseUrl
}

type UrlConfig = Pick<ResolvedGalleryConfig, 'baseUrl' | 'urlBuilder'>

export function photoUrl(cfg: UrlConfig, photo: Pick<Photo, 'album' | 'id' | 'variants'>, width: number, format: ImageFormat = 'webp'): string {
  const base = cfg.baseUrl.replace(/\/+$/, '')
  if (cfg.urlBuilder === 'cloudflare') {
    // resize from the largest variant (originals are not uploaded); format=auto negotiates avif/webp
    const source = objectKey(photo.album, photo.id, photo.variants[photo.variants.length - 1], format)
    return `${base}/cdn-cgi/image/width=${width},fit=scale-down,format=auto,quality=80/${source}`
  }
  return `${base}/${objectKey(photo.album, photo.id, width, format)}`
}

export function srcset(cfg: UrlConfig, photo: Pick<Photo, 'album' | 'id' | 'variants'>, format: ImageFormat = 'webp'): string {
  return photo.variants.map((w) => `${photoUrl(cfg, photo, w, format)} ${w}w`).join(', ')
}

/** Widths to generate for an original `width` pixels wide: every configured width below it, then the first one at or above it is replaced by the original's own width. */
export function variantWidths(width: number, widths: number[]): number[] {
  const sorted = [...widths].sort((a, b) => a - b)
  const below = sorted.filter((w) => w < width)
  const next = sorted.find((w) => w >= width)
  return next === undefined ? below : [...below, width]
}
