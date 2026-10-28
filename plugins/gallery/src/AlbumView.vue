<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { useQueryParam } from '@vuemo/core/client'
import { albums } from 'virtual:vuemo-gallery'
import type { Photo } from './types'
import { ROW_HEIGHT, ROW_HEIGHT_MOBILE, aspect, parseRowHeight, sizesAttr } from './layout'
import type { LightboxHandle } from './lightbox'
import { MIME, photoUrl, resolveBaseUrl, srcset } from './urls'

const props = defineProps<{ slug: string; photos: Photo[]; canGoBack?: boolean; named?: boolean }>()
const emit = defineEmits<{ back: [] }>()

const { site } = useData()
const cfg = computed(() => ({ ...__VUEMO_GALLERY__, baseUrl: resolveBaseUrl(__VUEMO_GALLERY__.baseUrl, site.value.base) }))
const album = computed(() => albums.find((a) => a.slug === props.slug))

const photoParam = useQueryParam('photo')
let lightbox: LightboxHandle | undefined
let opening = false
let current = ''

// ?photo=<id> (a click, a deep link, Back/Forward) opens the lightbox; clearing it closes it
async function sync(id: string) {
  const index = props.photos.findIndex((p) => p.id === id)
  if (index < 0) {
    lightbox?.close()
    return
  }
  if (lightbox || opening) return
  // a deep link to a photo beyond the first page: render it so the lightbox has a thumbnail to zoom from
  if (index >= shown.value) shown.value = index + 1
  opening = true
  try {
    const { openLightbox } = await import('./lightbox')
    // the param may have changed while PhotoSwipe was loading
    if (photoParam.value !== id) return
    lightbox = await openLightbox({
      photos: props.photos,
      index,
      cfg: cfg.value,
      onChange: (id) => {
        current = id
        if (photoParam.value !== id) photoParam.value = id
      },
      onClose: () => {
        lightbox = undefined
        photoParam.value = ''
        // opened by a deep link there is no opener to return to: focus the photo's link (a click-opened one is restored by PhotoSwipe)
        const id = current
        setTimeout(() => {
          if (document.activeElement && document.activeElement !== document.body) return
          document.querySelector<HTMLElement>(`[data-photo-id="${id}"] a`)?.focus({ preventScroll: true })
        }, 400)
      }
    })
  } finally {
    opening = false
  }
}
watch(photoParam, sync, { flush: 'post' })
onBeforeUnmount(() => lightbox?.close())

function open(id: string, e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return
  e.preventDefault()
  photoParam.value = id
}
// in the album list mode the URL also names the album
const photoHref = (id: string) => (props.named ? `?album=${props.slug}&photo=${id}` : `?photo=${id}`)

const titleId = computed(() => `vuemo-gallery-title-${props.slug}`)
const FIRST = 6 // above the fold: not lazy, high priority

// the first `perPage` photos are rendered on the server; the rest follow on scroll or on a click of "Load more"
const shown = ref(__VUEMO_GALLERY__.perPage)
const visible = computed(() => props.photos.slice(0, shown.value))
const remaining = computed(() => props.photos.length - visible.value.length)
const sentinel = ref<HTMLElement>()
const loadMore = () => {
  shown.value += __VUEMO_GALLERY__.perPage
  // the observer only reports changes: look again, or a sentinel still in view would never load the next page
  nextTick(() => {
    if (!observer || !sentinel.value) return
    observer.unobserve(sentinel.value)
    observer.observe(sentinel.value)
  })
}
let observer: IntersectionObserver | undefined

// thumbhash placeholders are decoded in the browser only; SSR uses the average colour
const placeholders = reactive<Record<string, string>>({})
async function decode() {
  const todo = visible.value.filter((p) => p.thumbhash && !placeholders[p.id])
  if (!todo.length) return
  const { thumbHashToDataURL } = await import('thumbhash')
  for (const p of todo) {
    try {
      placeholders[p.id] = thumbHashToDataURL(Uint8Array.from(atob(p.thumbhash!), (c) => c.charCodeAt(0)))
    } catch {
      placeholders[p.id] = '' // a bad hash only costs this photo its placeholder (the average colour stays)
    }
  }
}
// `sizes` follows the row heights the page sets with CSS variables (the server uses the defaults)
const grid = ref<HTMLElement>()
const rows = ref({ desktop: ROW_HEIGHT, mobile: ROW_HEIGHT_MOBILE })
onMounted(() => {
  if (grid.value) {
    const s = getComputedStyle(grid.value)
    rows.value = {
      desktop: parseRowHeight(s.getPropertyValue('--vuemo-gallery-row-height'), ROW_HEIGHT),
      mobile: parseRowHeight(s.getPropertyValue('--vuemo-gallery-row-height-mobile'), ROW_HEIGHT_MOBILE)
    }
  }
  decode()
  if ('IntersectionObserver' in window && sentinel.value) {
    observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && remaining.value > 0 && loadMore(), { rootMargin: '600px' })
    observer.observe(sentinel.value)
  }
})
watch(visible, decode)
onBeforeUnmount(() => observer?.disconnect())

const itemStyle = (p: Photo) => {
  const ar = aspect(p.w, p.h)
  return {
    '--ar': ar,
    backgroundColor: p.color,
    ...(placeholders[p.id] && { backgroundImage: `url(${placeholders[p.id]})` })
  }
}
const sizes = (p: Photo) => sizesAttr(p.w, p.h, rows.value)
const label = (p: Photo, i: number) => p.alt || p.caption || `Photo ${i + 1}`
const sources = (p: Photo) => p.formats.slice(0, -1)
const last = (p: Photo) => p.formats[p.formats.length - 1]
const src = (p: Photo) => photoUrl(cfg.value, p, p.variants[Math.min(1, p.variants.length - 1)], last(p))
</script>

<template>
  <section class="vuemo-gallery__album-view" :aria-labelledby="album ? titleId : undefined">
    <header v-if="album" class="vuemo-gallery__header">
      <a v-if="canGoBack" class="vuemo-gallery__back" href="?" @click.prevent="emit('back')">← All albums</a>
      <h2 :id="titleId" class="vuemo-gallery__title">{{ album.title }}</h2>
      <p v-if="album.description" class="vuemo-gallery__desc">{{ album.description }}</p>
    </header>
    <p v-if="!photos.length" class="vuemo-gallery__empty">No photos in this album yet.</p>
    <ul v-else ref="grid" class="vuemo-gallery__grid" role="list">
      <li v-for="(p, i) in visible" :key="p.id" class="vuemo-gallery__item" :data-photo-id="p.id" :style="itemStyle(p)">
        <a :href="photoHref(p.id)" :aria-label="label(p, i)" @click="open(p.id, $event)">
          <picture>
            <source v-for="f in sources(p)" :key="f" :type="MIME[f]" :srcset="srcset(cfg, p, f)" :sizes="sizes(p)" />
            <img
              :src="src(p)"
              :srcset="srcset(cfg, p, last(p))"
              :sizes="sizes(p)"
              :width="p.w"
              :height="p.h"
              :alt="p.alt ?? ''"
              :loading="i < FIRST ? 'eager' : 'lazy'"
              :fetchpriority="i < FIRST ? 'high' : undefined"
              decoding="async"
            />
          </picture>
        </a>
      </li>
    </ul>
    <div v-if="remaining > 0" ref="sentinel" class="vuemo-gallery__more">
      <button type="button" class="vuemo-gallery__more-button" @click="loadMore">Load more ({{ remaining }} left)</button>
    </div>
  </section>
</template>
