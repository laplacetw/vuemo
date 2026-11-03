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
    // Image Resizing lives at the root of the zone: `<origin>/cdn-cgi/image/<options>/<path of the source on that origin>`.
    // Resize from the largest variant (originals are not uploaded); format=auto negotiates avif/webp.
    const m = /^(https?:\/\/[^/]+)(\/.*)?$/.exec(base)
    const origin = m ? m[1] : ''
    const path = m ? (m[2] ?? '') : base
    const source = objectKey(photo.album, photo.id, photo.variants[photo.variants.length - 1], format)
    return `${origin}/cdn-cgi/image/width=${width},fit=scale-down,format=auto,quality=80${path}/${source}`
  }
  return `${base}/${objectKey(photo.album, photo.id, width, format)}`
}

export function srcset(cfg: UrlConfig, photo: Pick<Photo, 'album' | 'id' | 'variants'>, format: ImageFormat = 'webp'): string {
  return photo.variants.map((w) => `${photoUrl(cfg, photo, w, format)} ${w}w`).join(', ')
}

/**
 * Widths to generate for an original `width` x `height`: every configured width below the largest usable width, then
 * the first one at or above it is replaced by that width. The largest usable width is the original's own, or less when
 * `longEdge` limits the long edge (a portrait photo then gets narrower variants).
 */
export function variantWidths(original: number, widths: number[], height = original, longEdge?: number): number[] {
  const width = longEdge ? Math.min(original, Math.floor((longEdge * original) / Math.max(original, height))) : original
  const sorted = [...widths].sort((a, b) => a - b)
  const below = sorted.filter((w) => w < width)
  const next = sorted.find((w) => w >= width)
  return next === undefined ? below : [...below, width]
}
