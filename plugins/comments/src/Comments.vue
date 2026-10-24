<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { createAdapter } from './adapters'
import type { CommentsConfig } from './adapters/types'

declare const __VUEMO_COMMENTS__: CommentsConfig

const { isDark, page } = useData()
const container = ref<HTMLElement>()
const adapter = createAdapter(__VUEMO_COMMENTS__)

function remount() {
  if (!container.value) return
  adapter.unmount(container.value)
  adapter.mount(container.value, isDark.value)
}

onMounted(() => {
  remount()
  watch(() => page.value.relativePath, remount)
  watch(isDark, (value) => adapter.setTheme(value))
})

onBeforeUnmount(() => container.value && adapter.unmount(container.value))
</script>

<template>
  <div ref="container" class="vuemo-comments" />
</template>

<style scoped>
.vuemo-comments { margin-top: 2.5rem; }
</style>
