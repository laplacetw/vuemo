<script setup lang="ts">
import { useData } from 'vitepress'
import type { VuemoThemeConfig } from '@vuemo/core'

const { theme } = useData<VuemoThemeConfig>()
const links = theme.value.socialLinks ?? []
</script>

<template>
  <ul v-if="links.length" class="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
    <li v-for="item in links" :key="item.link">
      <a
        :href="item.link"
        :aria-label="item.ariaLabel ?? (typeof item.icon === 'string' ? item.icon : item.link)"
        target="_blank"
        rel="noopener noreferrer"
        class="hover:underline"
      >
        <span v-if="typeof item.icon === 'string'">{{ item.icon }}</span>
        <span v-else class="inline-block h-5 w-5 align-middle" v-html="item.icon.svg" />
      </a>
    </li>
  </ul>
</template>
