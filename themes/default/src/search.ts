// Pure helpers for the search modal. No DOM, so they are unit tested.

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c])
}

/**
 * HTML-escape `text` and wrap every occurrence of a search term in `<mark>`. Matching runs on the raw text and
 * every piece is escaped afterwards, so a term like `lt` can never match inside an entity such as `&lt;`.
 */
export function highlight(text: string, terms: readonly string[]): string {
  const parts = [...new Set(terms.filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!parts.length) return escapeHtml(text)
  // split with a capture group: matches land on the odd indexes
  return text
    .split(new RegExp(`(${parts.join('|')})`, 'gi'))
    .map((piece, i) => (i % 2 ? `<mark>${escapeHtml(piece)}</mark>` : escapeHtml(piece)))
    .join('')
}

/**
 * Router target of a search result. Document ids already include `base`, so it is not added again.
 * A result without parent titles is the page itself (its anchor is the generated title heading): drop the anchor.
 */
export function resultHref(id: string, titles: readonly string[] = []): string {
  const hash = id.indexOf('#')
  return hash === -1 || titles.length ? id : id.slice(0, hash)
}

/** Next active index when moving by `delta` (+1 / -1), wrapping around. `-1` means nothing is active yet. */
export function moveIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return -1
  if (current < 0) return delta > 0 ? 0 : length - 1
  return (((current + delta) % length) + length) % length
}

/** Screen reader announcement for the result count. */
export function resultsText(count: number): string {
  return count === 1 ? '1 result' : `${count} results`
}
