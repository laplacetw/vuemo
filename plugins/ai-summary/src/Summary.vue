<script setup lang="ts">
import { ref, watch } from 'vue'
import { useData } from 'vitepress'
import { articleText, pickSummary } from './extract'

declare const __VUEMO_AI_SUMMARY__: { api: string; buttonText: string }

const { api, buttonText } = __VUEMO_AI_SUMMARY__
const { page } = useData()
const summary = ref('')
const error = ref('')
const loading = ref(false)

watch(() => page.value.relativePath, () => {
  summary.value = error.value = ''
})

async function run() {
  const article = document.querySelector<HTMLElement>('.vuemo-content')
  if (!article) return
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: articleText(article) })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = pickSummary(await res.json())
    if (!text) throw new Error('empty summary')
    summary.value = text
  } catch (e) {
    error.value = String((e as Error).message ?? e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="vuemo-ai-summary">
    <p v-if="summary">🤖 {{ summary }}</p>
    <button v-else type="button" :disabled="loading" @click="run">
      {{ loading ? '…' : buttonText }}
    </button>
    <p v-if="error" class="vuemo-ai-summary-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.vuemo-ai-summary { margin: 1rem 0; padding: 0.75rem 1rem; border: 1px solid currentColor; border-radius: 0.5rem; opacity: 0.85; }
.vuemo-ai-summary button { cursor: pointer; background: none; border: 0; color: inherit; font: inherit; }
.vuemo-ai-summary-error { font-size: 0.85em; opacity: 0.7; }
</style>
