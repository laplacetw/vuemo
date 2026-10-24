<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import type { VuemoThemeConfig } from '@vuemo/core'
import Nav from './components/Nav.vue'
import Home from './layouts/Home.vue'
import Post from './layouts/Post.vue'
import Archive from './layouts/Archive.vue'
import Tag from './layouts/Tag.vue'
import Category from './layouts/Category.vue'
import Page from './layouts/Page.vue'
import SocialLinks from './components/SocialLinks.vue'

const layouts = { home: Home, post: Post, archive: Archive, tag: Tag, category: Category, page: Page }

const { page, frontmatter, theme } = useData<VuemoThemeConfig>()

// `themeConfig.footer` is `{ message, copyright }` (defineBlogConfig turns a string into the message)
const footer = computed(() => theme.value.footer ?? {})

const layout = computed(() => {
  if (page.value.isNotFound) return Page
  const name = frontmatter.value.layout as keyof typeof layouts | undefined
  if (name && name in layouts) return layouts[name]
  return page.value.relativePath.startsWith('posts/') ? Post : Page
})
</script>

<template>
  <div class="min-h-screen bg-white text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
    <Nav />
    <main class="mx-auto max-w-3xl break-words px-4 py-8">
      <component :is="layout">
        <template #post-before-content><slot name="post-before-content" /></template>
        <template #post-after-content><slot name="post-after-content" /></template>
        <template #post-comments><slot name="post-comments" /></template>
      </component>
    </main>
    <footer class="space-y-1 py-8 text-center text-sm text-zinc-500">
      <SocialLinks />
      <p v-if="footer.message" class="vuemo-footer-message" v-html="footer.message" />
      <p v-if="footer.copyright" class="vuemo-footer-copyright text-xs" v-html="footer.copyright" />
    </footer>
  </div>
</template>
