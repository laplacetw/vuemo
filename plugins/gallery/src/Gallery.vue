<script setup lang="ts">
import './style.css'
import { computed, defineAsyncComponent, defineComponent, h } from 'vue'
import { useQueryParam } from '@vuemo/core/client'
import { albums, loaders } from 'virtual:vuemo-gallery'
import AlbumList from './AlbumList.vue'
import AlbumView from './AlbumView.vue'

const props = defineProps<{ /** Show this album only (a page of its own). */ album?: string }>()

const visible = albums.filter((a) => !a.hidden)
const selected = useQueryParam('album', { history: 'push' })

// a pinned album, the only album, or the one chosen with ?album=; '' shows the album list
const slug = computed(() => {
  if (props.album) return props.album
  if (visible.length === 1) return visible[0].slug
  return albums.some((a) => a.slug === selected.value) ? selected.value : ''
})
const canGoBack = computed(() => !props.album && visible.length > 1)

// One async component per album: it resolves before SSR output and before hydration, so both sides render the same photos.
const cache = new Map<string, ReturnType<typeof defineAsyncComponent>>()
function albumComponent(name: string) {
  let c = cache.get(name)
  if (!c) {
    c = defineAsyncComponent(async () => {
      // the chunk leaves out `album` (it is the same for all); URLs need it
      const photos = (await loaders[name]()).default.map((p) => ({ ...p, album: name }))
      return defineComponent({
        inheritAttrs: false,
        setup: (_, { attrs }) => () => h(AlbumView, { ...attrs, photos })
      })
    })
    cache.set(name, c)
  }
  return c
}
</script>

<template>
  <div class="vuemo-gallery">
    <p v-if="props.album && !albums.some((a) => a.slug === props.album)" class="vuemo-gallery__empty">Unknown album "{{ props.album }}".</p>
    <component :is="albumComponent(slug)" v-else-if="slug" :key="slug" :slug="slug" :can-go-back="canGoBack" @back="selected = ''" />
    <AlbumList v-else :albums="visible" @select="selected = $event" />
  </div>
</template>
