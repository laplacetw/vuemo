<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { articleText, pickSummary } from './extract'

declare const __VUEMO_AI_SUMMARY__: { api: string; buttonText: string }

const { api, buttonText } = __VUEMO_AI_SUMMARY__
const { page } = useData()
const summary = ref('')
const error = ref('')
const loading = ref(false)

const TIMEOUT_MS = 30_000
let controller: AbortController | undefined

// A new page invalidates the running request and the shown summary.
watch(() => page.value.relativePath, () => {
  controller?.abort()
  summary.value = error.value = ''
  loading.value = false
})
onBeforeUnmount(() => controller?.abort())

async function run() {
  const article = document.querySelector<HTMLElement>('.vuemo-content')
  if (!article) return
  controller?.abort()
  const mine = (controller = new AbortController())
  const timer = setTimeout(() => mine.abort(new Error('timeout')), TIMEOUT_MS)
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: articleText(article) }),
      signal: mine.signal
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = pickSummary(await res.json())
    if (mine !== controller) return
    if (!text) throw new Error('empty summary')
    summary.value = text
  } catch (e) {
    if (mine !== controller) return // superseded or cancelled by navigation: stay silent
    error.value = mine.signal.aborted ? 'timeout' : String((e as Error).message ?? e)
  } finally {
    clearTimeout(timer)
    if (mine === controller) loading.value = false
  }
}
</script>

<template>
  <div class="vuemo-ai-summary" aria-live="polite">
    <p v-if="summary">🤖 {{ summary }}</p>
    <button v-else type="button" :disabled="loading" @click="run">
      {{ loading ? '…' : buttonText }}
    </button>
    <p v-if="error" class="vuemo-ai-summary-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.vuemo-ai-summary { margin: 1rem 0; padding: 0.75rem 1rem; border: 1px solid color-mix(in srgb, currentColor 40%, transparent); border-radius: 0.5rem; }
.vuemo-ai-summary button { cursor: pointer; background: none; border: 0; color: inherit; font: inherit; }
.vuemo-ai-summary-error { font-size: 0.85em; margin: 0.5rem 0 0; color: color-mix(in srgb, currentColor 70%, transparent); }
</style>
