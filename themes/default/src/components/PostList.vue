<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import type { VuemoThemeConfig } from '@vuemo/core'
import type { Post } from '@vuemo/core/client'
import { postSummary } from '../utils'

// `summary` adds the excerpt or description (per `themeConfig.summary`) and a "Read more" link.
const props = defineProps<{ posts: Post[]; summary?: boolean }>()
const { theme } = useData<VuemoThemeConfig>()
// the summary of each post is worked out once, not once per use in the template
const items = computed(() => props.posts.map((post) => ({ post, summary: props.summary ? postSummary(post, theme.value.summary) : {} })))
</script>

<template>
  <ul class="space-y-6">
    <li v-for="{ post, summary: sum } in items" :key="post.url">
      <a :href="withBase(post.url)" class="text-xl font-semibold hover:underline">{{ post.title }}</a>
      <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {{ post.date.string }}<span v-if="post.category"> · {{ post.category }}</span>
      </div>
      <template v-if="props.summary">
        <div
          v-if="sum.html"
          class="vuemo-excerpt prose prose-sm mt-2 max-w-none dark:prose-invert"
          v-html="sum.html"
        />
        <div v-else-if="sum.text" class="vuemo-excerpt prose prose-sm mt-2 max-w-none dark:prose-invert">
          <p>{{ sum.text }}</p>
        </div>
        <a :href="withBase(post.url)" class="mt-2 inline-block text-sm hover:underline">Read more →<span class="sr-only">: {{ post.title }}</span></a>
      </template>
    </li>
  </ul>
</template>
