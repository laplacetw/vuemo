import type { Post } from '@vuemo/core/client'

export type SummaryMode = 'excerpt' | 'description'

/**
 * What to show under a post in a list.
 * `excerpt` mode: the excerpt HTML, else the description, else nothing.
 * `description` mode: the description only, never the excerpt.
 */
export function postSummary(
  post: Pick<Post, 'excerpt' | 'description'>,
  mode: SummaryMode = 'excerpt'
): { html?: string; text?: string } {
  if (mode === 'excerpt' && post.excerpt?.trim()) return { html: post.excerpt }
  if (post.description?.trim()) return { text: post.description }
  return {}
}

/** "1 post" / "N posts". */
export function postCountText(count: number): string {
  return count === 1 ? '1 post' : `${count} posts`
}

/**
 * "Updated" date (YYYY-MM-DD, UTC) of a post, or undefined when nothing should be shown: the feature is off or
 * opted out per post (`lastUpdated: false`), the timestamp is not a positive number (NaN = untracked file,
 * 0 = missing), or it falls on the publish date.
 */
export function updatedDate(
  lastUpdated: number | undefined,
  published: string,
  optOut?: unknown
): string | undefined {
  if (optOut === false) return undefined
  if (typeof lastUpdated !== 'number' || !Number.isFinite(lastUpdated) || lastUpdated <= 0) return undefined
  const date = new Date(lastUpdated).toISOString().slice(0, 10)
  return date === String(published).slice(0, 10) ? undefined : date
}
