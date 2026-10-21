import type { CommentsAdapter, UtterancesOptions } from './types'

export function utterances(options: UtterancesOptions): CommentsAdapter {
  const light = options.light ?? 'github-light'
  const dark = options.dark ?? 'github-dark'

  return {
    mount(el, isDark) {
      const script = document.createElement('script')
      script.src = 'https://utteranc.es/client.js'
      script.async = true
      script.crossOrigin = 'anonymous'
      script.setAttribute('repo', options.repo)
      script.setAttribute('issue-term', options.issueTerm ?? 'title')
      script.setAttribute('theme', isDark ? dark : light)
      el.appendChild(script)
    },
    unmount(el) {
      el.replaceChildren()
    },
    setTheme(isDark) {
      const frame = document.querySelector<HTMLIFrameElement>('.utterances-frame')
      frame?.contentWindow?.postMessage({ type: 'set-theme', theme: isDark ? dark : light }, 'https://utteranc.es')
    }
  }
}
