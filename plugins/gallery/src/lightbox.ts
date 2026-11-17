import type { ImageFormat, Photo, ResolvedGalleryConfig } from './types'
import { photoUrl, srcset } from './urls'
import { exifFrame, exifLine, type ExifFrame } from './exif'

/** Border and bottom bar of the camera-data frame, in px: smaller on a phone. */
const frameSize = (viewportWidth: number) => (viewportWidth <= 640 ? { border: 10, bar: 52, gap: 8 } : { border: 16, bar: 64, gap: 24 })
const TOP_BAR = 60 // PhotoSwipe's buttons: white icons must not sit on the white frame
const CAPTION = 44 // one line of caption below the frame

function frameElement(f: ExifFrame): HTMLElement {
  const line = (cls: string, text: string) => {
    const el = document.createElement('span')
    el.className = cls
    el.textContent = text
    return el
  }
  const frame = document.createElement('div')
  frame.className = 'vuemo-gallery__frame'
  frame.setAttribute('aria-hidden', 'true') // the caption element carries the same data for screen readers
  // the camera over its settings, centred
  const bar = document.createElement('div')
  bar.className = 'vuemo-gallery__frame-bar'
  if (f.camera) bar.append(line('vuemo-gallery__frame-main', f.camera))
  if (f.settings.length) bar.append(line('vuemo-gallery__frame-sub', f.settings.join('  ')))
  frame.append(bar)
  return frame
}

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
      meta: exifLine(p),
      frame: exifFrame(p)
    })),
    index: o.index,
    returnFocus: true,
    // a framed photo leaves room for its frame (and the caption below it), so both stay on screen
    paddingFn: (viewport, data) => {
      if (!data.frame) return { top: 0, bottom: 0, left: 0, right: 0 }
      const { border, bar, gap } = frameSize(viewport.x)
      return {
        top: Math.max(TOP_BAR, border + gap),
        left: border + gap,
        right: border + gap,
        bottom: border + bar + gap + (data.caption ? CAPTION : 0)
      }
    },
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

  // the camera-data frame lives in the slide's zoom wrapper, behind the image: it slides with the photo. Its size follows
  // the displayed image; at the fit zoom the wrapper is not scaled, so px are exact (zoomed in, CSS hides the frame)
  pswp.on('slideInit', ({ slide }) => {
    const f = (slide.data as { frame?: ExifFrame }).frame
    if (f) slide.container.prepend(frameElement(f))
  })
  pswp.on('imageSizeChange', ({ slide, width, height }) => {
    const frame = slide.container.querySelector<HTMLElement>(':scope > .vuemo-gallery__frame')
    if (!frame) return
    const { border, bar } = frameSize(pswp.viewportSize.x)
    Object.assign(frame.style, {
      left: `${-border}px`,
      top: `${-border}px`,
      width: `${width + 2 * border}px`,
      height: `${height + border + bar}px`
    })
    frame.style.setProperty('--_bar', `${bar}px`)
  })
  // no frame while the photo zooms out of its thumbnail or back into it
  pswp.on('openingAnimationEnd', () => pswp.element?.classList.add('vuemo-gallery--open'))
  pswp.on('close', () => pswp.element?.classList.remove('vuemo-gallery--open'))

  pswp.on('uiRegister', () => {
    pswp.ui?.registerElement({
      name: 'caption',
      order: 9,
      isButton: false,
      appendTo: 'root',
      onInit(el) {
        el.className = 'vuemo-gallery__caption'
        pswp.on('change', () => {
          const data = (pswp.currSlide?.data ?? {}) as { caption?: string; meta?: string; frame?: ExifFrame }
          const lines = [
            [data.caption, 'vuemo-gallery__caption-text'],
            // a framed photo shows the camera data in its frame (hidden from screen readers): the line stays for them
            [data.meta, data.frame ? 'vuemo-gallery__caption-meta vuemo-gallery__sr-only' : 'vuemo-gallery__caption-meta']
          ].flatMap(([text, cls]) => {
            if (!text) return []
            const p = document.createElement('p')
            p.className = cls!
            p.textContent = text
            return [p]
          })
          el.replaceChildren(...lines)
          el.hidden = !lines.length
          el.classList.toggle('vuemo-gallery__caption--bare', !data.caption && !!data.frame) // only the screen-reader line: no gradient
        })
      }
    })
  })
  pswp.on('change', () => o.onChange(o.photos[pswp.currIndex].id))
  pswp.on('close', () => o.onClose())
  pswp.init()
  return { close: () => pswp.close() }
}
