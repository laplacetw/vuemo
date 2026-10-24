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
