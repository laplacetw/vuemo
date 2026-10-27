declare module 'virtual:vuemo-gallery' {
  import type { AlbumSummary, Photo } from './types'
  export const albums: AlbumSummary[]
  export const loaders: Record<string, () => Promise<{ default: Photo[] }>>
}
declare const __VUEMO_GALLERY__: import('./types').ResolvedGalleryConfig
