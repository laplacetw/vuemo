<script setup lang="ts">
import { defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useData } from 'vitepress'

// the modal (and MiniSearch with the index) is only fetched when it opens
const SearchModal = defineAsyncComponent(() => import('./SearchModal.vue'))

const { theme, localeIndex } = useData()
const options = theme.value.search?.options
const text: string =
  options?.locales?.[localeIndex.value]?.translations?.button?.buttonText ||
  options?.translations?.button?.buttonText ||
  'Search'

const open = ref(false)
const button = ref<HTMLButtonElement>()
// set after mount: it depends on the platform, which the server does not know
const hint = ref('')

function isTyping(el: EventTarget | null) {
  const node = el as HTMLElement | null
  return !!node && (node.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName))
}

function onKeydown(e: KeyboardEvent) {
  if (e.key?.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
    e.preventDefault()
    open.value = true
  } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !open.value && !isTyping(e.target)) {
    e.preventDefault()
    open.value = true
  }
}

function close() {
  open.value = false
  nextTick(() => button.value?.focus())
}

onMounted(() => {
  hint.value = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <button
    ref="button"
    type="button"
    class="flex items-center gap-1.5 rounded-md border border-zinc-300 px-2 py-1 text-zinc-600 hover:border-zinc-400 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-zinc-500"
    aria-haspopup="dialog"
    :aria-label="text"
    @click="open = true"
  >
    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4 4" />
    </svg>
    <span>{{ text }}</span>
    <kbd v-if="hint" class="hidden rounded bg-zinc-100 px-1 text-xs text-zinc-500 sm:inline dark:bg-zinc-800 dark:text-zinc-400">{{ hint }}</kbd>
  </button>
  <SearchModal v-if="open" @close="close" />
</template>
