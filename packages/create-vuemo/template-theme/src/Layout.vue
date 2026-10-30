<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import type { VuemoThemeConfig } from '@vuemo/core'
import type { MyThemeConfig } from './types'
import Home from './layouts/Home.vue'
import Post from './layouts/Post.vue'
import Archive from './layouts/Archive.vue'
import Tag from './layouts/Tag.vue'
import Category from './layouts/Category.vue'
import Page from './layouts/Page.vue'

const layouts = { home: Home, post: Post, archive: Archive, tag: Tag, category: Category, about: Page, page: Page }

const { page, frontmatter, theme, site, isDark } = useData<VuemoThemeConfig & MyThemeConfig>()

// Contract: dispatch on `frontmatter.layout` ONLY. Core gives every page under posts/ the `post` layout.
// `about` is a plain page here (a theme may give it its own look). A missing layout is rendered as `page`
// (so is an unknown one, by choice of this theme), and so is the 404 page.
const layout = computed(() => {
  if (page.value.isNotFound) return Page
  const name = frontmatter.value.layout as keyof typeof layouts | undefined
  return name && Object.hasOwn(layouts, name) ? layouts[name] : Page
})

// Validate your own options and warn in the console (this also shows up in the output of `vitepress build`).
if (theme.value.readMoreText !== undefined && typeof theme.value.readMoreText !== 'string') {
  console.warn('[my-theme] themeConfig.readMoreText must be a string, got', typeof theme.value.readMoreText)
}

const nav = computed(() => theme.value.nav ?? [])
// Core always normalizes `footer` to `{ message?, copyright? }` (a string becomes the message).
const footer = computed(() => theme.value.footer ?? {})
</script>

<template>
  <header class="site-header">
    <a :href="withBase('/')" class="site-title">{{ site.title }}</a>
    <nav>
      <a v-for="item in nav" :key="item.link" :href="withBase(item.link)">{{ item.text }}</a>
      <!-- Contract: follow VitePress `isDark`; plugins (e.g. comments) read the same state. -->
      <button type="button" aria-label="Toggle dark mode" @click="isDark = !isDark">
        <!-- both icons are rendered and CSS picks one from `html.dark`, so SSR and hydration agree -->
        <span class="icon-moon">&#9790;</span>
        <span class="icon-sun">&#9728;</span>
      </button>
    </nav>
  </header>

  <main>
    <component :is="layout">
      <!-- Standard slots of the `post` layout; pass them through so users of `extends` can fill them too. -->
      <template #post-before-content><slot name="post-before-content" /></template>
      <template #post-after-content><slot name="post-after-content" /></template>
      <template #post-comments><slot name="post-comments" /></template>
    </component>
  </main>

  <footer class="site-footer">
    <p v-if="footer.message" v-html="footer.message" />
    <p v-if="footer.copyright" v-html="footer.copyright" />
  </footer>
</template>
