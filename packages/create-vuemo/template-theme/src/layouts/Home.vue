<script setup lang="ts">
import { useData } from 'vitepress'
import type { VuemoThemeConfig } from '@vuemo/core'
import { usePagination } from '@vuemo/core/client'
import PostList from '../components/PostList.vue'
import type { MyThemeConfig } from '../types'

const { theme } = useData<VuemoThemeConfig & MyThemeConfig>()
// The page number lives in the URL (?page=2); core provides the data, the theme draws the buttons.
const { page, goPage } = usePagination(theme.value.postsPerPage ?? 5)
</script>

<template>
  <PostList :posts="page.items" :read-more="theme.readMoreText ?? 'Read more'" />
  <nav v-if="page.totalPages > 1" class="pagination" aria-label="Pagination">
    <button
      v-for="n in page.totalPages"
      :key="n"
      type="button"
      :aria-current="n === page.page ? 'page' : undefined"
      @click="goPage(n)"
    >
      {{ n }}
    </button>
  </nav>
</template>
