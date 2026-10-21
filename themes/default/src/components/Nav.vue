<script setup lang="ts">
import { useData, withBase } from 'vitepress'

const { site, theme, isDark } = useData()
const nav: { text: string; link: string }[] = theme.value.nav ?? []
</script>

<template>
  <header class="border-b border-zinc-200 dark:border-zinc-700">
    <div class="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4">
      <a :href="withBase('/')" class="whitespace-nowrap text-lg font-bold">{{ site.title }}</a>
      <nav class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <a v-for="item in nav" :key="item.link" :href="withBase(item.link)" class="hover:underline">{{ item.text }}</a>
        <button type="button" aria-label="Toggle dark mode" @click="isDark = !isDark">
          {{ isDark ? '☀️' : '🌙' }}
        </button>
      </nav>
    </div>
  </header>
</template>
