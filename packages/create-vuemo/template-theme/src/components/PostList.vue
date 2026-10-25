<script setup lang="ts">
import { withBase } from 'vitepress'
import type { Post } from '@vuemo/core/client'

defineProps<{ posts: Post[]; readMore?: string }>()
</script>

<template>
  <ul class="post-list">
    <li v-for="post in posts" :key="post.url">
      <a :href="withBase(post.url)" class="post-title">{{ post.title }}</a>
      <div class="meta">{{ post.date.string }}<span v-if="post.category"> · {{ post.category }}</span></div>
      <p v-if="post.description">{{ post.description }}</p>
      <a v-if="readMore" :href="withBase(post.url)">{{ readMore }}</a>
    </li>
  </ul>
</template>
