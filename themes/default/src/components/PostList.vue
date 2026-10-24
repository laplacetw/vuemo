<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import type { Post } from '@vuemo/core/client'
import { postSummary } from '../utils'

// `summary` adds the excerpt or description (per `themeConfig.summary`) and a "Read more" link.
defineProps<{ posts: Post[]; summary?: boolean }>()
const { theme } = useData()
</script>

<template>
  <ul class="space-y-6">
    <li v-for="post in posts" :key="post.url">
      <a :href="withBase(post.url)" class="text-xl font-semibold hover:underline">{{ post.title }}</a>
      <div class="mt-1 text-sm text-zinc-500">
        {{ post.date.string }}<span v-if="post.category"> · {{ post.category }}</span>
      </div>
      <template v-if="summary">
        <div
          v-if="postSummary(post, theme.summary).html"
          class="vuemo-excerpt prose prose-sm mt-2 max-w-none dark:prose-invert"
          v-html="postSummary(post, theme.summary).html"
        />
        <div v-else-if="postSummary(post, theme.summary).text" class="vuemo-excerpt prose prose-sm mt-2 max-w-none dark:prose-invert">
          <p>{{ postSummary(post, theme.summary).text }}</p>
        </div>
        <a :href="withBase(post.url)" class="mt-2 inline-block text-sm hover:underline">Read more →</a>
      </template>
    </li>
  </ul>
</template>
