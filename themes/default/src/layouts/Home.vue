<script setup lang="ts">
import { useData } from 'vitepress'
import { usePagination } from '@vuemo/core/client'
import PostList from '../components/PostList.vue'
import Pagination from '../components/Pagination.vue'

const { theme } = useData()
const { page, goPage } = usePagination(theme.value.postsPerPage ?? 5)
</script>

<template>
  <PostList :posts="page.items" />
  <Pagination :page="page.page" :total-pages="page.totalPages" @go="goPage" />
</template>
