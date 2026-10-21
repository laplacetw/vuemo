<script setup lang="ts">
import { useData } from 'vitepress'

const { frontmatter, page } = useData()
</script>

<template>
  <h1 class="text-3xl font-bold">{{ page.isNotFound ? '404' : frontmatter.title }}</h1>
  <Content class="prose mt-6 max-w-none dark:prose-invert" />
</template>
