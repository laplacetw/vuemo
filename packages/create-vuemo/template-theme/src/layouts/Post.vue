<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { usePost, usePrevNext, useTaxonomyLinks } from '@vuemo/core/client'
import PluginSlot from '../components/PluginSlot.vue'

const { frontmatter } = useData()
// The normalized post for this route: date, tags and category are already validated.
const post = usePost()
const adjacent = usePrevNext() // prev = newer post, next = older post
const { tagLink, categoryLink } = useTaxonomyLinks()
</script>

<template>
  <article>
    <h1>{{ frontmatter.title }}</h1>
    <div v-if="post" class="meta">
      {{ post.date.string }}
      <a v-if="post.category" :href="categoryLink(post.category)"> · {{ post.category }}</a>
      <a v-for="tag in post.tags" :key="tag" :href="tagLink(tag)"> #{{ tag }}</a>
    </div>

    <!-- Contract: the standard slots. Each has a <slot> (for `extends`) and a <PluginSlot> (for plugins). -->
    <slot name="post-before-content" />
    <PluginSlot name="post-before-content" />

    <!-- Contract: the class `vuemo-content` marks the post body (the AI summary plugin reads its text). -->
    <Content class="vuemo-content" />

    <slot name="post-after-content" />
    <PluginSlot name="post-after-content" />
  </article>

  <nav class="prev-next">
    <a v-if="adjacent.next" :href="withBase(adjacent.next.url)">&larr; {{ adjacent.next.title }}</a>
    <span v-else />
    <a v-if="adjacent.prev" :href="withBase(adjacent.prev.url)">{{ adjacent.prev.title }} &rarr;</a>
  </nav>

  <slot name="post-comments" />
  <PluginSlot name="post-comments" />
</template>
