import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vitepress'
import { slots, enhanceApps } from 'virtual:vuemo/plugins'
import type { Component } from 'vue'
import type { EnhanceAppContext } from 'vitepress'
import { data } from '../posts.data'
import { groupByCategory, groupByTag, groupByYear } from '../group'
import { findPrevNext, paginate } from '../pagination'

export type { Post, Frontmatter } from '../schema'

export function usePosts() {
  return data
}

export function useTags() {
  return groupByTag(data)
}

export function useCategories() {
  return groupByCategory(data)
}

export function useArchives() {
  return groupByYear(data)
}

/** Page number lives in `?page=` and changes through the History API. */
export function usePagination(perPage = 5, list = data) {
  const current = ref(1)

  const read = () => {
    current.value = Number(new URLSearchParams(location.search).get('page')) || 1
  }

  onMounted(() => {
    read()
    window.addEventListener('popstate', read)
  })

  const page = computed(() => paginate(list, current.value, perPage))

  function goPage(n: number) {
    const url = new URL(location.href)
    n > 1 ? url.searchParams.set('page', String(n)) : url.searchParams.delete('page')
    history.pushState({}, '', url)
    current.value = n
  }

  return { page, goPage }
}

/** prev = newer post, next = older post. Defaults to the current route. */
export function usePrevNext(url?: string) {
  const route = useRoute()
  return computed(() => findPrevNext(data, url ?? route.path))
}

/** Components plugins registered for a standard slot (`post-before-content`, `post-after-content`, `post-comments`). */
export function useSlots(name: string): Component[] {
  return slots[name] ?? []
}

/** Themes call this from their `enhanceApp` so plugins can register client-side behavior. */
export function runEnhanceApps(ctx: EnhanceAppContext) {
  for (const fn of enhanceApps) fn(ctx)
}
