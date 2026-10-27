<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { useQueryParam } from '@vuemo/core/client'
import { albums } from 'virtual:vuemo-gallery'
import type { Photo } from './types'
import { aspect, sizesAttr } from './layout'
import type { LightboxHandle } from './lightbox'
import { MIME, photoUrl, resolveBaseUrl, srcset } from './urls'

const props = defineProps<{ slug: string; photos: Photo[]; canGoBack?: boolean }>()
const emit = defineEmits<{ back: [] }>()

const { site } = useData()
const cfg = computed(() => ({ ...__VUEMO_GALLERY__, baseUrl: resolveBaseUrl(__VUEMO_GALLERY__.baseUrl, site.value.base) }))
const album = computed(() => albums.find((a) => a.slug === props.slug))

const photoParam = useQueryParam('photo')
let lightbox: LightboxHandle | undefined
let opening = false

// ?photo=<id> (a click, a deep link, Back/Forward) opens the lightbox; clearing it closes it
async function sync(id: string) {
  const index = props.photos.findIndex((p) => p.id === id)
  if (index < 0) {
    lightbox?.close()
    return
  }
  if (lightbox || opening) return
  opening = true
  try {
    const { openLightbox } = await import('./lightbox')
    // the param may have changed while PhotoSwipe was loading
    if (photoParam.value !== id) return
    lightbox = await openLightbox({
      photos: props.photos,
      index,
      cfg: cfg.value,
      onChange: (current) => {
        if (photoParam.value !== current) photoParam.value = current
      },
      onClose: () => {
        lightbox = undefined
        photoParam.value = ''
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
const photoHref = (id: string) => (props.canGoBack ? `?album=${props.slug}&photo=${id}` : `?photo=${id}`)

const FIRST = 6 // above the fold: not lazy, high priority

// the first `perPage` photos are rendered on the server; the rest follow on scroll or on a click of "Load more"
const shown = ref(__VUEMO_GALLERY__.perPage)
const visible = computed(() => props.photos.slice(0, shown.value))
const remaining = computed(() => props.photos.length - visible.value.length)
const sentinel = ref<HTMLElement>()
const loadMore = () => {
  shown.value += __VUEMO_GALLERY__.perPage
}
let observer: IntersectionObserver | undefined

// thumbhash placeholders are decoded in the browser only; SSR uses the average colour
const placeholders = reactive<Record<string, string>>({})
async function decode() {
  const todo = visible.value.filter((p) => p.thumbhash && !placeholders[p.id])
  if (!todo.length) return
  const { thumbHashToDataURL } = await import('thumbhash')
  for (const p of todo) placeholders[p.id] = thumbHashToDataURL(Uint8Array.from(atob(p.thumbhash!), (c) => c.charCodeAt(0)))
}
onMounted(() => {
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
const label = (p: Photo, i: number) => p.alt || p.caption || `Photo ${i + 1}`
const sources = (p: Photo) => p.formats.slice(0, -1)
const last = (p: Photo) => p.formats[p.formats.length - 1]
const src = (p: Photo) => photoUrl(cfg.value, p, p.variants[Math.min(1, p.variants.length - 1)], last(p))
</script>

<template>
  <section class="vuemo-gallery__album-view" :aria-label="album?.title">
    <header v-if="album" class="vuemo-gallery__header">
      <a v-if="canGoBack" class="vuemo-gallery__back" href="?" @click.prevent="emit('back')">← All albums</a>
      <h2 class="vuemo-gallery__title">{{ album.title }}</h2>
      <p v-if="album.description" class="vuemo-gallery__desc">{{ album.description }}</p>
    </header>
    <p v-if="!photos.length" class="vuemo-gallery__empty">No photos in this album yet.</p>
    <ul v-else class="vuemo-gallery__grid" role="list">
      <li v-for="(p, i) in visible" :key="p.id" class="vuemo-gallery__item" :data-photo-id="p.id" :style="itemStyle(p)">
        <a :href="photoHref(p.id)" :aria-label="label(p, i)" @click="open(p.id, $event)">
          <picture>
            <source v-for="f in sources(p)" :key="f" :type="MIME[f]" :srcset="srcset(cfg, p, f)" :sizes="sizesAttr(p.w, p.h)" />
            <img
              :src="src(p)"
              :srcset="srcset(cfg, p, last(p))"
              :sizes="sizesAttr(p.w, p.h)"
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
