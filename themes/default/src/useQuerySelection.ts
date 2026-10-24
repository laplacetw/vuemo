import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vitepress'

/**
 * The selected item of the tag/category layouts lives in `?<key>=`.
 * Navigating between `/tags?tag=a` and `/tags` keeps the same path and component, so nothing
 * reactive changes; VitePress's after-route-change hook (called for links and for Back/Forward) is
 * the one reliable signal. Reads `location` only in the browser, so SSR renders nothing selected.
 */
export function useQuerySelection(key: string) {
  const router = useRouter() as any
  const selected = ref('')
  const read = () => {
    selected.value = new URLSearchParams(location.search).get(key) ?? ''
  }

  const original = router.onAfterRouteChange
  onMounted(() => {
    read()
    const previous = original ?? router.onAfterRouteChanged
    router.onAfterRouteChange = async (href: string) => {
      await previous?.(href)
      read()
    }
  })
  onBeforeUnmount(() => {
    router.onAfterRouteChange = original
  })

  function select(name: string) {
    selected.value = selected.value === name ? '' : name
    const url = new URL(location.href)
    selected.value ? url.searchParams.set(key, name) : url.searchParams.delete(key)
    // keep VitePress's own history state (scroll position)
    history.replaceState(history.state, '', url)
  }

  return { selected, select }
}
