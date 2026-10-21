<script setup lang="ts">
import { useData } from 'vitepress'
import { useArchives } from '@vuemo/core/client'
import PostList from '../components/PostList.vue'

const { frontmatter } = useData()
const archives = useArchives()
</script>

<template>
  <h1 class="mb-6 text-3xl font-bold">{{ frontmatter.title }}</h1>
  <section v-for="group in archives" :key="group.year" class="mb-8">
    <h2 class="mb-3 text-2xl font-semibold">{{ group.year }}</h2>
    <PostList :posts="group.posts" />
  </section>
</template>
