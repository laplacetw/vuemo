<script setup lang="ts">
import { withBase } from 'vitepress'
import type { Post } from '@vuemo/core/client'

defineProps<{ posts: Post[] }>()
</script>

<template>
  <ul class="space-y-6">
    <li v-for="post in posts" :key="post.url">
      <a :href="withBase(post.url)" class="text-xl font-semibold hover:underline">{{ post.title }}</a>
      <div class="mt-1 text-sm text-zinc-500">
        {{ post.date.string }}<span v-if="post.category"> · {{ post.category }}</span>
      </div>
      <p v-if="post.description" class="mt-1">{{ post.description }}</p>
    </li>
  </ul>
</template>
