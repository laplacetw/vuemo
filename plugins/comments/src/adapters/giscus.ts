import type { CommentsAdapter, GiscusOptions } from './types'

export function giscus(options: GiscusOptions): CommentsAdapter {
  const light = options.light ?? 'light'
  const dark = options.dark ?? 'dark'

  return {
    mount(el, isDark) {
      const script = document.createElement('script')
      script.src = 'https://giscus.app/client.js'
      script.async = true
      script.crossOrigin = 'anonymous'
      const attrs: Record<string, string> = {
        repo: options.repo,
        'repo-id': options.repoId,
        category: options.category,
        'category-id': options.categoryId,
        mapping: options.mapping ?? 'pathname',
        'reactions-enabled': '1',
        'input-position': 'bottom',
        theme: isDark ? dark : light,
        lang: options.lang ?? 'en',
        loading: 'lazy'
      }
      for (const [k, v] of Object.entries(attrs)) script.setAttribute(`data-${k}`, v)
      el.appendChild(script)
    },
    unmount(el) {
      el.replaceChildren()
    },
    setTheme(isDark) {
      const frame = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
      frame?.contentWindow?.postMessage(
        { giscus: { setConfig: { theme: isDark ? dark : light } } },
        'https://giscus.app'
      )
    }
  }
}
