/** Frontmatter accepted by Vuemo posts. Themes and plugins depend only on this. */
export interface Frontmatter {
  title: string
  date: string | Date
  tags?: string[]
  category?: string
  description?: string
}

export interface Post {
  title: string
  url: string
  date: { time: number; string: string }
  category?: string
  tags: string[]
  description?: string
  excerpt?: string
  /** Length of the body for reading time: a CJK character counts as one word, so does a run of other letters or digits. */
  words: number
}

export interface PostSource {
  url: string
  frontmatter: Record<string, any>
  excerpt?: string
  /** The Markdown file (frontmatter included). */
  src?: string
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu

/** Words of a Markdown file: frontmatter, code blocks, HTML tags and link targets do not count. */
export function countWords(src: string): number {
  const text = src
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\S\n]*$/gm, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\]\([^)]*\)/g, ' ')
  const cjk = text.match(CJK)?.length ?? 0
  const other = text.replace(CJK, ' ').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0
  return cjk + other
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
    words: src.src ? countWords(src.src) : 0
  }
}

/** True for pages under `posts/` (a VitePress `relativePath`, e.g. `posts/hello.md`). */
export const isPostPath = (relativePath: string): boolean => relativePath.startsWith('posts/')
