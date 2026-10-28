<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import type { AlbumSummary } from './types'
import { photoUrl, resolveBaseUrl, srcset } from './urls'

defineProps<{ albums: AlbumSummary[] }>()
const emit = defineEmits<{ select: [slug: string] }>()

const { site } = useData()
const cfg = computed(() => ({ ...__VUEMO_GALLERY__, baseUrl: resolveBaseUrl(__VUEMO_GALLERY__.baseUrl, site.value.base) }))

function choose(slug: string, e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return
  e.preventDefault()
  emit('select', slug)
}
</script>

<template>
  <p v-if="!albums.length" class="vuemo-gallery__empty">No albums yet.</p>
  <ul v-else class="vuemo-gallery__albums" role="list">
    <li v-for="a in albums" :key="a.slug" class="vuemo-gallery__album">
      <a :href="`?album=${a.slug}`" @click="choose(a.slug, $event)">
        <span class="vuemo-gallery__cover" :style="{ backgroundColor: a.cover?.color }">
          <img
            v-if="a.cover"
            :src="photoUrl(cfg, a.cover, a.cover.variants[Math.min(1, a.cover.variants.length - 1)])"
            :srcset="srcset(cfg, a.cover)"
            sizes="(max-width: 640px) 100vw, 320px"
            :width="a.cover.w"
            :height="a.cover.h"
            alt=""
            loading="lazy"
            decoding="async"
          />
        </span>
        <span class="vuemo-gallery__album-title">{{ a.title }}</span>
        <span class="vuemo-gallery__album-meta">{{ a.count }} {{ a.count === 1 ? 'photo' : 'photos' }}</span>
        <span v-if="a.description" class="vuemo-gallery__album-desc">{{ a.description }}</span>
      </a>
    </li>
  </ul>
</template>
