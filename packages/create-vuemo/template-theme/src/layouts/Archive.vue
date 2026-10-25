<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { useArchives } from '@vuemo/core/client'

const { frontmatter } = useData()
// Posts grouped by year, newest first.
const archives = useArchives()
</script>

<template>
  <h1>{{ frontmatter.title }}</h1>
  <section v-for="group in archives" :key="group.year">
    <h2>{{ group.year }}</h2>
    <ul class="archive-list">
      <li v-for="post in group.posts" :key="post.url">
        <time :datetime="post.date.string">{{ post.date.string.slice(5, 10) }}</time>
        <a :href="withBase(post.url)">{{ post.title }}</a>
      </li>
    </ul>
  </section>
</template>
