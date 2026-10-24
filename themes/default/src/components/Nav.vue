<script setup lang="ts">
import { useData, withBase } from 'vitepress'

const { site, theme, isDark } = useData()
const nav: { text: string; link: string }[] = theme.value.nav ?? []
</script>

<template>
  <header class="border-b border-zinc-200 dark:border-zinc-700">
    <div class="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4">
      <a :href="withBase('/')" class="flex items-center gap-2 whitespace-nowrap text-lg font-bold">
        <img v-if="theme.logo" :src="withBase(theme.logo)" alt="" class="h-6 w-6" />
        {{ site.title }}
      </a>
      <nav class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <a v-for="item in nav" :key="item.link" :href="withBase(item.link)" class="hover:underline">{{ item.text }}</a>
        <button type="button" aria-label="Toggle dark mode" @click="isDark = !isDark">
          <!-- both icons are rendered; CSS picks one from `.dark`, so SSR and hydration agree -->
          <span class="dark:hidden">🌙</span>
          <span class="hidden dark:inline">☀️</span>
        </button>
      </nav>
    </div>
  </header>
</template>
