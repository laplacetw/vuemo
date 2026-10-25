/// <reference path="./virtual.d.ts" />
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useData, useRoute, useRouter } from 'vitepress'
import { slots, enhanceApps } from 'virtual:vuemo/plugins'
import type { Component } from 'vue'
import type { EnhanceAppContext } from 'vitepress'
import { data } from '../posts.data'
import { groupByCategory, groupByTag, groupByYear } from '../group'
import { findPost, findPrevNext, paginate, stripBase } from '../pagination'
import { taxonomyHref } from '../taxonomy'
import { onAfterRouteChange, readQueryParam, withQueryParam, type RouteHookHost } from '../query'
import type { VuemoThemeConfig } from '../types'

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

/**
 * A ref that follows the URL's `?key=` (`''` when absent): read on mount, on link navigation (also to the same
 * path, e.g. from `/?page=2` to `/`) and on Back/Forward. Assigning updates the URL without a navigation
 * (`''` removes the param): `history.replaceState` by default, `history: 'push'` adds a history entry.
 * Renders `''` on the server. Listeners are removed when the component unmounts.
 */
export function useQueryParam(key: string, options: { history?: 'replace' | 'push' } = {}) {
  const router = useRouter() as unknown as RouteHookHost
  const value = ref('')
  const read = () => {
    value.value = readQueryParam(location.search, key)
  }

  let stop: (() => void) | undefined
  onMounted(() => {
    read()
    stop = onAfterRouteChange(router, read)
  })
  onBeforeUnmount(() => stop?.())

  return computed({
    get: () => value.value,
    set(next: string) {
      value.value = next
      const url = withQueryParam(location.href, key, next)
      // replace keeps VitePress's own history state (scroll position)
      options.history === 'push' ? history.pushState({}, '', url) : history.replaceState(history.state, '', url)
    }
  })
}

/** Page number lives in `?page=`; going to a page adds a history entry, Back/Forward and links follow the URL. */
export function usePagination(perPage = 5, list = data) {
  const param = useQueryParam('page', { history: 'push' })
  const current = computed(() => Number(param.value) || 1)
  const page = computed(() => paginate(list, current.value, perPage))

  function goPage(n: number) {
    param.value = n > 1 ? String(n) : ''
  }

  return { page, goPage }
}

/** prev = newer post, next = older post. Defaults to the current route. */
export function usePrevNext(url?: string) {
  const route = useRoute()
  const { site } = useData()
  return computed(() => findPrevNext(data, url ?? stripBase(route.path, site.value.base)))
}

/**
 * The normalized post at the current route (or `url`): validated date, tags and category.
 * `undefined` for pages that are not posts, or posts the loader skipped for invalid frontmatter.
 */
export function usePost(url?: string) {
  const route = useRoute()
  const { site } = useData()
  return computed(() => findPost(data, url ?? stripBase(route.path, site.value.base)))
}

/** Links to the tag and category pages (`themeConfig.paths`), preselecting the item through the query. */
export function useTaxonomyLinks() {
  const { theme, site } = useData<VuemoThemeConfig>()
  const paths = () => theme.value.paths
  return {
    tagLink: (name: string) => taxonomyHref(site.value.base, paths().tag, 'tag', name),
    categoryLink: (name: string) => taxonomyHref(site.value.base, paths().category, 'category', name)
  }
}

/** Components plugins registered for a standard slot (`post-before-content`, `post-after-content`, `post-comments`). */
export function useSlots(name: string): Component[] {
  return slots[name] ?? []
}

/** Themes call this from their `enhanceApp` so plugins can register client-side behavior. */
export function runEnhanceApps(ctx: EnhanceAppContext) {
  for (const fn of enhanceApps) fn(ctx)
}
