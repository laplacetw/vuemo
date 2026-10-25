<script setup lang="ts">
import { useData } from 'vitepress'

const { frontmatter, page } = useData()
</script>

<template>
  <!-- Also the fallback for unknown layouts and the 404 page -->
  <h1>{{ page.isNotFound ? '404' : frontmatter.title }}</h1>
  <p v-if="page.isNotFound">This page could not be found.</p>
  <Content v-else />
</template>
