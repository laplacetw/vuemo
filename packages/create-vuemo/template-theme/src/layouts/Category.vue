<script setup lang="ts">
import { useData } from 'vitepress'
import { useCategories, useQueryParam } from '@vuemo/core/client'
import PostList from '../components/PostList.vue'

const { frontmatter } = useData()
const groups = useCategories() // { [category]: Post[] }
// The selected category lives in the URL (?category=name), which is what `useTaxonomyLinks().categoryLink()` links to.
const selected = useQueryParam('category')
const toggle = (name: string) => (selected.value = selected.value === name ? '' : name)
</script>

<template>
  <h1>{{ frontmatter.title }}</h1>
  <div class="chips">
    <button
      v-for="(list, name) in groups"
      :key="name"
      type="button"
      :aria-pressed="selected === name"
      @click="toggle(String(name))"
    >
      {{ name }} ({{ list.length }})
    </button>
  </div>
  <PostList v-if="selected && Object.hasOwn(groups, selected)" :posts="groups[selected]" />
</template>
