/** Frontmatter accepted by Vuemo posts. Themes and plugins depend only on this. */
export interface Frontmatter {
  title: string
  date: string | Date
  tags?: string[]
  category?: string
  description?: string
  draft?: boolean
}

export interface Post {
  title: string
  url: string
  date: { time: number; string: string }
  category?: string
  tags: string[]
  description?: string
  excerpt?: string
  draft: boolean
}

export interface PostSource {
  url: string
  frontmatter: Record<string, any>
  excerpt?: string
}

/** Returns a normalized Post, or an error message when required fields are invalid. */
export function parsePost(src: PostSource): Post | string {
  const fm = src.frontmatter
  if (typeof fm.title !== 'string' || !fm.title.trim()) return 'missing "title"'
  const time = +new Date(fm.date)
  if (!fm.date || Number.isNaN(time)) return 'missing or invalid "date"'

  const tags = Array.isArray(fm.tags) ? fm.tags.filter((t: unknown) => typeof t === 'string' && t) : []
  return {
    title: fm.title,
    url: src.url,
    date: { time, string: new Date(time).toISOString().slice(0, 10) },
    category: typeof fm.category === 'string' && fm.category ? fm.category : undefined,
    tags,
    description: typeof fm.description === 'string' ? fm.description : undefined,
    excerpt: src.excerpt,
    draft: fm.draft === true
  }
}
