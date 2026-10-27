import { fileURLToPath } from 'node:url'
import type { VuemoPlugin } from '@vuemo/core'
import { resolveConfig } from './config'
import { galleryVitePlugin } from './vite'
import type { GalleryConfig } from './types'

export type { GalleryConfig, ImageFormat, Photo, Album, Manifest, ResolvedGalleryConfig } from './types'

export default function gallery(config: GalleryConfig | true = {}): VuemoPlugin {
  const cfg = resolveConfig(config === true ? {} : config)
  return {
    name: '@vuemo/plugin-gallery',
    vite: { define: { __VUEMO_GALLERY__: JSON.stringify(cfg) }, plugins: [galleryVitePlugin(cfg) as any] },
    enhanceApp: fileURLToPath(new URL('../src/enhance.ts', import.meta.url))
  }
}

declare module '@vuemo/core' {
  interface OfficialFeatures {
    /** Photo gallery (`<VuemoGallery />`). Remove or set to `false` to disable. */
    gallery?: GalleryConfig | false
  }
}
