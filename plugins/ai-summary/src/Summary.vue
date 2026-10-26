<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { articleText, pickSummary } from './extract'

declare const __VUEMO_AI_SUMMARY__: { api: string; buttonText: string; resultPrefix: string }

const { api, buttonText, resultPrefix } = __VUEMO_AI_SUMMARY__
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
  <div class="vuemo-ai-summary" :class="{ 'is-loading': loading }" aria-live="polite">
    <p v-if="summary" class="vuemo-ai-summary-result">{{ resultPrefix }}{{ summary }}</p>
    <button v-else type="button" class="vuemo-ai-summary-button" :disabled="loading" :aria-busy="loading" @click="run">
      <span v-if="loading" class="vuemo-ai-summary-dots" role="status" aria-label="Loading">
        <span class="vuemo-ai-summary-dot"></span>
        <span class="vuemo-ai-summary-dot"></span>
        <span class="vuemo-ai-summary-dot"></span>
      </span>
      <template v-else>{{ buttonText }}</template>
    </button>
    <p v-if="error" class="vuemo-ai-summary-error">{{ error }}</p>
  </div>
</template>

<!-- Not scoped on purpose: every rule is wrapped in :where() (specificity 0), so any theme rule overrides it.
     Colors and sizes come from CSS custom properties; see the README for the styling contract. -->
<style>
:where(.vuemo-ai-summary) { margin: 1rem 0; }
:where(.vuemo-ai-summary-button) { cursor: pointer; background: none; border: 0; padding: 0; color: inherit; font: inherit; }
:where(.vuemo-ai-summary-button:disabled) { cursor: progress; }
:where(.vuemo-ai-summary-result, .vuemo-ai-summary-error) { margin: 0; }
:where(.vuemo-ai-summary-error) { font-size: 0.85em; margin-top: 0.5rem; opacity: 0.7; }
:where(.vuemo-ai-summary-dots) { display: inline-flex; align-items: flex-end; gap: var(--vuemo-ai-summary-dot-gap, 0.5rem); height: 1em; }
:where(.vuemo-ai-summary-dot) {
  width: var(--vuemo-ai-summary-dot-size, 0.5rem);
  height: var(--vuemo-ai-summary-dot-size, 0.5rem);
  border-radius: 9999px;
  background: currentColor;
  animation: vuemo-ai-summary-bounce 1s infinite;
}
:where(.vuemo-ai-summary-dot:nth-child(1)) { animation-delay: -0.3s; }
:where(.vuemo-ai-summary-dot:nth-child(2)) { animation-delay: -0.15s; }
@keyframes vuemo-ai-summary-bounce {
  0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
  50% { transform: none; animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
}
@media (prefers-reduced-motion: reduce) {
  :where(.vuemo-ai-summary-dot) { animation: none; }
}
</style>
