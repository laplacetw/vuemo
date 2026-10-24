<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import { useTags } from '@vuemo/core/client'
import PostList from '../components/PostList.vue'

const { frontmatter } = useData()
const groups = useTags()
const route = useRoute()
const selected = ref('')

// Selection lives in `?tag=` so it can be linked and survives reload.
const read = () => {
  selected.value = new URLSearchParams(location.search).get('tag') ?? ''
}
onMounted(read)
// client-side navigation (e.g. from a post) changes the query without a remount in some cases
watch(() => route.path, read, { flush: 'post' })

function select(name: string) {
  selected.value = selected.value === name ? '' : name
  const url = new URL(location.href)
  selected.value ? url.searchParams.set('tag', name) : url.searchParams.delete('tag')
  history.replaceState({}, '', url)
}
</script>

<template>
  <h1 class="mb-6 text-3xl font-bold">{{ frontmatter.title }}</h1>
  <div class="mb-8 flex flex-wrap gap-2">
    <button
      v-for="(list, name) in groups"
      :key="name"
      type="button"
      class="rounded-full border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
      :class="selected === name && 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'"
      @click="select(String(name))"
    >
      {{ name }} ({{ list.length }})
    </button>
  </div>
  <PostList v-if="selected && groups[selected]" :posts="groups[selected]" />
</template>
