<script setup lang="ts">
import { useData } from 'vitepress'
import type { VuemoThemeConfig } from '@vuemo/core'
import { usePagination } from '@vuemo/core/client'
import PostList from '../components/PostList.vue'
import Pagination from '../components/Pagination.vue'

const { theme } = useData<VuemoThemeConfig>()
const { page, goPage } = usePagination(theme.value.postsPerPage ?? 5)
</script>

<template>
  <PostList :posts="page.items" summary />
  <Pagination :page="page.page" :total-pages="page.totalPages" @go="goPage" />
</template>
