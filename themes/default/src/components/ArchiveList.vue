<script setup lang="ts">
import { withBase } from 'vitepress'
import type { Post } from '@vuemo/core/client'

defineProps<{ posts: Post[] }>()
</script>

<template>
  <ul class="space-y-1">
    <li v-for="post in posts" :key="post.url" class="flex items-baseline gap-3">
      <!-- MM-DD: the year is the section heading -->
      <time class="shrink-0 font-mono text-sm tabular-nums text-zinc-500" :datetime="post.date.string">{{ post.date.string.slice(5, 10) }}</time>
      <a :href="withBase(post.url)" class="min-w-0 truncate hover:underline" :title="post.title">{{ post.title }}</a>
    </li>
  </ul>
</template>
