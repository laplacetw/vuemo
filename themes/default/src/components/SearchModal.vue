<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useData, useRouter } from 'vitepress'
import type { VuemoThemeConfig } from '@vuemo/core'
import type MiniSearch from 'minisearch'
import { decodeEntities, highlight, moveIndex, resultHref, resultsText } from '../search'

const emit = defineEmits<{ (e: 'close'): void }>()

interface Stored {
  title: string
  titles: string[]
}
interface Hit extends Stored {
  id: string
  terms: string[]
}

const { theme, localeIndex } = useData<VuemoThemeConfig>()
const router = useRouter()
const options = theme.value.search?.options
const t = (key: 'noResultsText') =>
  options?.locales?.[localeIndex.value]?.translations?.modal?.[key] || options?.translations?.modal?.[key]
const noResultsText: string = t('noResultsText') || 'No results'
const placeholder: string = options?.locales?.[localeIndex.value]?.translations?.button?.buttonText || options?.translations?.button?.buttonText || 'Search'

const dialog = ref<HTMLElement>()
const input = ref<HTMLInputElement>()
const query = ref('')
const active = ref(-1)
const status = ref<'loading' | 'ready' | 'unavailable'>('loading')
const index = shallowRef<MiniSearch<Stored> | null>(null)
const listId = 'vuemo-search-results'

const hits = computed<Hit[]>(() => {
  const q = query.value.trim()
  if (!index.value || !q) return []
  return index.value.search(q).slice(0, 20) as unknown as Hit[]
})
const rows = computed(() =>
  hits.value.map((h, i) => ({
    key: h.id,
    optionId: `${listId}-${i}`,
    title: highlight(decodeEntities(h.title), h.terms),
    path: (h.titles ?? []).map(decodeEntities).join(' › '),
    href: resultHref(h.id)
  }))
)
const showEmpty = computed(() => status.value === 'ready' && !!query.value.trim() && !rows.value.length)
const announce = computed(() => (status.value !== 'ready' || !query.value.trim() ? '' : rows.value.length ? resultsText(rows.value.length) : noResultsText))

watch(rows, (r) => {
  active.value = r.length ? 0 : -1
})

async function build(json: unknown) {
  if (typeof json !== 'string' || json === '{}') {
    status.value = 'unavailable'
    return
  }
  const { default: Mini } = await import('minisearch')
  const mini = options?.miniSearch
  index.value = Mini.loadJSON<Stored>(json, {
    fields: ['title', 'titles', 'text'],
    storeFields: ['title', 'titles'],
    searchOptions: { fuzzy: 0.2, prefix: true, boost: { title: 4, text: 2, titles: 1 }, ...mini?.searchOptions },
    ...mini?.options
  })
  status.value = 'ready'
}

async function load() {
  try {
    // client only, and only now: neither MiniSearch nor the index is part of the page's own chunks
    const [, idx] = await Promise.all([import('minisearch'), import('@localSearchIndex')])
    const entry = idx.default?.[localeIndex.value] ?? idx.default?.root
    await build((await entry?.())?.default)
  } catch {
    status.value = 'unavailable'
  }
}

// dev: the index changes when a post is edited
if (import.meta.hot) {
  import.meta.hot.accept('/@localSearchIndex', async (m) => {
    const entry = m?.default?.[localeIndex.value] ?? m?.default?.root
    if (entry) await build((await entry())?.default)
  })
}

function go(i: number) {
  const row = rows.value[i]
  if (!row) return
  // ids already carry `base`: no withBase here
  router.go(row.href)
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = moveIndex(active.value, e.key === 'ArrowDown' ? 1 : -1, rows.value.length)
    nextTick(() => document.getElementById(`${listId}-${active.value}`)?.scrollIntoView({ block: 'nearest' }))
  } else if (e.key === 'Enter') {
    if (e.target === input.value) {
      e.preventDefault()
      go(active.value)
    }
  } else if (e.key === 'Tab' && dialog.value) {
    // keep focus inside the dialog
    const items = [...dialog.value.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])')]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    const current = document.activeElement
    if (e.shiftKey && (current === first || !dialog.value.contains(current))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (current === last || !dialog.value.contains(current))) {
      e.preventDefault()
      first.focus()
    }
  }
}

let previousOverflow = ''
let previousPadding = ''
onMounted(() => {
  previousOverflow = document.body.style.overflow
  // hiding the scrollbar widens the page: pad the body by the scrollbar's width so nothing shifts
  previousPadding = document.body.style.paddingRight
  const gap = window.innerWidth - document.documentElement.clientWidth
  document.body.style.overflow = 'hidden'
  if (gap > 0) document.body.style.paddingRight = `${gap}px`
  input.value?.focus()
  load()
})
onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  document.body.style.paddingRight = previousPadding
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex sm:items-start sm:justify-center sm:bg-black/50 sm:px-4 sm:pt-[10vh]"
      @mousedown.self="emit('close')"
    >
      <div
        ref="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        class="flex h-full w-full flex-col bg-white text-zinc-800 sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-lg sm:shadow-xl dark:bg-zinc-900 dark:text-zinc-200 dark:sm:border dark:sm:border-zinc-700"
        @keydown="onKeydown"
      >
        <div class="flex items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-700">
          <svg class="h-5 w-5 shrink-0 text-zinc-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" />
          </svg>
          <input
            ref="input"
            v-model="query"
            type="search"
            role="combobox"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            aria-label="Search"
            aria-autocomplete="list"
            :aria-expanded="rows.length > 0"
            :aria-controls="listId"
            :aria-activedescendant="active >= 0 ? `${listId}-${active}` : undefined"
            :placeholder="placeholder"
            class="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400"
          />
          <button
            type="button"
            class="shrink-0 rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-600 dark:text-zinc-300"
            @click="emit('close')"
          >
            Esc
          </button>
        </div>

        <ul v-show="rows.length" :id="listId" role="listbox" aria-label="Search results" class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          <li
            v-for="(row, i) in rows"
            :id="row.optionId"
            :key="row.key"
            role="option"
            :aria-selected="i === active"
            class="cursor-pointer rounded-md px-3 py-2"
            :class="i === active ? 'bg-zinc-100 dark:bg-zinc-800' : ''"
            @mousemove="active = i"
            @click="go(i)"
          >
            <div class="font-medium [&_mark]:rounded-sm [&_mark]:bg-yellow-200 [&_mark]:text-inherit dark:[&_mark]:bg-yellow-500/40" v-html="row.title" />
            <div v-if="row.path" class="truncate text-sm text-zinc-500 dark:text-zinc-400">{{ row.path }}</div>
          </li>
        </ul>

        <p v-if="status === 'unavailable'" class="p-6 text-center text-zinc-500">Search index unavailable</p>
        <p v-else-if="showEmpty" aria-hidden="true" class="p-6 text-center text-zinc-500">{{ noResultsText }}</p>
        <p class="sr-only" role="status" aria-live="polite">{{ announce }}</p>
      </div>
    </div>
  </Teleport>
</template>
