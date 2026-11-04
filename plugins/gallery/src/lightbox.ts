import type { ImageFormat, Photo, ResolvedGalleryConfig } from './types'
import { photoUrl, srcset } from './urls'
import { exifLine } from './exif'

export interface LightboxOptions {
  photos: Photo[]
  index: number
  cfg: Pick<ResolvedGalleryConfig, 'baseUrl' | 'urlBuilder'>
  /** Called when the current photo changes (also for the first one). */
  onChange(id: string): void
  /** Called once when the lightbox starts closing. */
  onClose(): void
}

export interface LightboxHandle {
  close(): void
}

/** PhotoSwipe is loaded on first use: it is not part of the gallery's initial bundle. */
export async function openLightbox(o: LightboxOptions): Promise<LightboxHandle> {
  const [{ default: PhotoSwipe }] = await Promise.all([import('photoswipe'), import('photoswipe/style.css')])
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const format = (p: Photo): ImageFormat => p.formats[p.formats.length - 1]
  const largest = (p: Photo) => p.variants[p.variants.length - 1]

  const pswp = new PhotoSwipe({
    dataSource: o.photos.map((p) => ({
      src: photoUrl(o.cfg, p, largest(p), format(p)),
      srcset: srcset(o.cfg, p, format(p)),
      msrc: photoUrl(o.cfg, p, p.variants[0], format(p)),
      width: p.w,
      height: p.h,
      alt: p.alt ?? '',
      // the caption is what the author wrote (alt is for screen readers and may be a file name); the second line is the camera data
      caption: p.caption ?? '',
      meta: exifLine(p)
    })),
    index: o.index,
    returnFocus: true,
    // no motion for people who ask for less of it
    ...(reduced && { showHideAnimationType: 'none' as const, showAnimationDuration: 0, hideAnimationDuration: 0, zoomAnimationDuration: 0, easing: 'linear' })
  })

  // zoom from and back to the thumbnail
  pswp.addFilter('thumbBounds', (bounds, _data, index) => {
    const img = document.querySelector<HTMLElement>(`[data-photo-id="${o.photos[index]?.id}"] img`)
    if (!img) return bounds as any
    // PhotoSwipe works in viewport coordinates (it is a fixed layer): no scroll offset
    const r = img.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width }
  })

  pswp.on('uiRegister', () => {
    pswp.ui?.registerElement({
      name: 'caption',
      order: 9,
      isButton: false,
      appendTo: 'root',
      onInit(el) {
        el.className = 'vuemo-gallery__caption'
        pswp.on('change', () => {
          const data = (pswp.currSlide?.data ?? {}) as { caption?: string; meta?: string }
          const lines = [
            [data.caption, 'vuemo-gallery__caption-text'],
            [data.meta, 'vuemo-gallery__caption-meta']
          ].flatMap(([text, cls]) => {
            if (!text) return []
            const p = document.createElement('p')
            p.className = cls!
            p.textContent = text
            return [p]
          })
          el.replaceChildren(...lines)
          el.hidden = !lines.length
        })
      }
    })
  })
  pswp.on('change', () => o.onChange(o.photos[pswp.currIndex].id))
  pswp.on('close', () => o.onClose())
  pswp.init()
  return { close: () => pswp.close() }
}
