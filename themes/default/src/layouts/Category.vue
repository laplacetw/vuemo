<script setup lang="ts">
import { useData } from 'vitepress'
import { useCategories } from '@vuemo/core/client'
import PostList from '../components/PostList.vue'
import { useQuerySelection } from '../useQuerySelection'

const { frontmatter } = useData()
const groups = useCategories()
const { selected, select } = useQuerySelection('category')
</script>

<template>
  <h1 class="mb-6 text-3xl font-bold">{{ frontmatter.title }}</h1>
  <div class="mb-8 flex flex-wrap gap-2">
    <button
      v-for="(list, name) in groups"
      :key="name"
      type="button"
      class="rounded-full border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
      :class="selected === name && 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'"
      @click="select(String(name))"
    >
      {{ name }} ({{ list.length }})
    </button>
  </div>
  <PostList v-if="selected && groups[selected]" :posts="groups[selected]" />
</template>
