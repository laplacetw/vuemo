import type { GalleryConfig, ResolvedGalleryConfig } from './types'

export const DEFAULT_WIDTHS = [400, 800, 1600, 2400]

export function resolveConfig(config: GalleryConfig = {}): ResolvedGalleryConfig {
  const storage = config.storage ?? 'r2'
  const baseUrl = (config.baseUrl ?? (storage === 'local' ? '/gallery' : '')).replace(/\/+$/, '')
  if (!baseUrl) throw new Error("[vuemo] plugin-gallery: \"baseUrl\" is required when storage is 'r2' (the public URL of your bucket, e.g. https://img.example.com)")
  const widths = [...new Set(config.widths ?? DEFAULT_WIDTHS)].sort((a, b) => a - b)
  if (!widths.length || widths.some((w) => !Number.isInteger(w) || w <= 0)) throw new Error('[vuemo] plugin-gallery: "widths" must be a list of positive integers')
  if (config.longEdge !== undefined && (!Number.isInteger(config.longEdge) || config.longEdge <= 0)) throw new Error('[vuemo] plugin-gallery: "longEdge" must be a positive integer')
  const perPage = config.perPage ?? 60
  if (!Number.isInteger(perPage) || perPage <= 0) throw new Error('[vuemo] plugin-gallery: "perPage" must be a positive integer')
  return {
    baseUrl,
    dir: (config.dir ?? 'gallery').replace(/\/+$/, ''),
    widths,
    formats: config.formats?.length ? config.formats : ['webp'],
    ...(config.longEdge !== undefined && { longEdge: config.longEdge }),
    exif: config.exif === false ? false : 'basic',
    perPage,
    urlBuilder: config.urlBuilder ?? 'static',
    storage
  }
}
