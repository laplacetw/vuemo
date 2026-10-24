<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import type { VuemoThemeConfig } from '@vuemo/core'
import { usePost, usePrevNext, useTaxonomyLinks } from '@vuemo/core/client'
import PluginSlot from '../components/PluginSlot.vue'
import { updatedDate } from '../utils'

const { frontmatter, page, theme } = useData<VuemoThemeConfig>()
// date, tags and category come from the normalized post (invalid values are already dropped);
// a post the loader skipped has none of them, so none is shown
const post = usePost()
// shown only when the `lastUpdated` option is on; the date is UTC so the server and the browser agree
const updated = computed(() =>
  theme.value.lastUpdated && post.value
    ? updatedDate(page.value.lastUpdated, post.value.date.string, frontmatter.value.lastUpdated)
    : undefined
)
const adjacent = usePrevNext()
const { tagLink, categoryLink } = useTaxonomyLinks()
</script>

<template>
  <article>
    <h1 class="text-3xl font-bold">{{ frontmatter.title }}</h1>
    <div class="mt-2 text-sm text-zinc-500">
      <template v-if="post">
      {{ post.date.string }}
      <span v-if="updated" class="vuemo-updated">· {{ theme.lastUpdated?.text || 'Updated' }} {{ updated }}</span>
      <span v-if="post.category">
        · <a :href="categoryLink(post.category)" class="hover:underline">{{ post.category }}</a>
      </span>
      <span v-for="tag in post.tags" :key="tag">
        · <a :href="tagLink(tag)" class="hover:underline">#{{ tag }}</a>
      </span>
      </template>
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
