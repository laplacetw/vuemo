<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { useArchives } from '@vuemo/core/client'
import ArchiveList from '../components/ArchiveList.vue'
import { postCountText } from '../utils'

const { frontmatter } = useData()
const archives = useArchives()
const total = computed(() => archives.reduce((n, g) => n + g.posts.length, 0))
</script>

<template>
  <h1 class="text-3xl font-bold">{{ frontmatter.title }}</h1>
  <p class="mb-6 mt-1 text-sm text-zinc-500 dark:text-zinc-400">{{ postCountText(total) }}</p>
  <section v-for="group in archives" :key="group.year" class="mb-8">
    <h2 class="mb-3 text-2xl font-semibold">
      {{ group.year }} <span class="text-base font-normal text-zinc-500 dark:text-zinc-400">({{ group.posts.length }})</span>
    </h2>
    <ArchiveList :posts="group.posts" />
  </section>
</template>
