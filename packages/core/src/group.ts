import type { Post } from './schema'

export type Grouped = Record<string, Post[]>

/** Array, not object: integer-like year keys would be forced into ascending order. Newest year first. */
export function groupByYear(posts: Post[]): { year: string; posts: Post[] }[] {
  const out = new Map<string, Post[]>()
  for (const post of posts) {
    const year = post.date.string.slice(0, 4)
    out.set(year, [...(out.get(year) ?? []), post])
  }
  return [...out].map(([year, posts]) => ({ year, posts })).sort((a, b) => b.year.localeCompare(a.year))
}

export function groupByCategory(posts: Post[]): Grouped {
  const out: Grouped = {}
  for (const post of posts) if (post.category) (out[post.category] ??= []).push(post)
  return out
}

export function groupByTag(posts: Post[]): Grouped {
  const out: Grouped = {}
  for (const post of posts) for (const tag of post.tags) (out[tag] ??= []).push(post)
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
}
