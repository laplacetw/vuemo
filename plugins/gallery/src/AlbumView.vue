<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { useData } from 'vitepress'
import { albums } from 'virtual:vuemo-gallery'
import type { Photo } from './types'
import { aspect, sizesAttr } from './layout'
import { MIME, photoUrl, resolveBaseUrl, srcset } from './urls'

const props = defineProps<{ slug: string; photos: Photo[]; canGoBack?: boolean }>()
const emit = defineEmits<{ back: [] }>()

const { site } = useData()
const cfg = computed(() => ({ ...__VUEMO_GALLERY__, baseUrl: resolveBaseUrl(__VUEMO_GALLERY__.baseUrl, site.value.base) }))
const album = computed(() => albums.find((a) => a.slug === props.slug))

const FIRST = 6 // above the fold: not lazy, high priority

// thumbhash placeholders are decoded in the browser only; SSR uses the average colour
const placeholders = reactive<Record<string, string>>({})
onMounted(async () => {
  const withHash = props.photos.filter((p) => p.thumbhash)
  if (!withHash.length) return
  const { thumbHashToDataURL } = await import('thumbhash')
  for (const p of withHash) placeholders[p.id] = thumbHashToDataURL(Uint8Array.from(atob(p.thumbhash!), (c) => c.charCodeAt(0)))
})

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
      <li v-for="(p, i) in photos" :key="p.id" class="vuemo-gallery__item" :style="itemStyle(p)">
        <a :href="`?photo=${p.id}`" :aria-label="label(p, i)">
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
  </section>
</template>
