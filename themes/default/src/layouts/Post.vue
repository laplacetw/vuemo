<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { usePrevNext } from '@vuemo/core/client'
import PluginSlot from '../components/PluginSlot.vue'

const { frontmatter } = useData()
const adjacent = usePrevNext()
</script>

<template>
  <article>
    <h1 class="text-3xl font-bold">{{ frontmatter.title }}</h1>
    <div class="mt-2 text-sm text-zinc-500">
      {{ String(frontmatter.date).slice(0, 10) }}
      <span v-if="frontmatter.category"> · {{ frontmatter.category }}</span>
      <span v-for="tag in frontmatter.tags ?? []" :key="tag"> · #{{ tag }}</span>
    </div>
    <slot name="post-before-content" />
    <PluginSlot name="post-before-content" />
    <Content class="vuemo-content prose mt-6 max-w-none dark:prose-invert" />
    <slot name="post-after-content" />
    <PluginSlot name="post-after-content" />
  </article>
  <nav class="mt-10 flex flex-wrap justify-between gap-x-4 gap-y-2 text-sm">
    <a v-if="adjacent.next" :href="withBase(adjacent.next.url)" class="hover:underline">← {{ adjacent.next.title }}</a>
    <span v-else />
    <a v-if="adjacent.prev" :href="withBase(adjacent.prev.url)" class="hover:underline">{{ adjacent.prev.title }} →</a>
  </nav>
  <slot name="post-comments" />
  <PluginSlot name="post-comments" />
</template>
