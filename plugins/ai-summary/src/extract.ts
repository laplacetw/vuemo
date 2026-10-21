/** Plain text of the article, without code blocks and footnotes. `root` is not modified. */
export function articleText(root: HTMLElement): string {
  const copy = root.cloneNode(true) as HTMLElement
  copy.querySelectorAll("[class^='language-'], .footnotes, .footnote, .footnote-ref").forEach((el) => el.remove())
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Reads `{ summary }`, or the Cloudflare AI Gateway shape `{ response: { result: { response } } }`. */
export function pickSummary(res: any): string | undefined {
  const text = res?.summary ?? res?.response?.result?.response
  return typeof text === 'string' && text.trim() ? text.trim() : undefined
}
