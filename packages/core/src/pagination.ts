export interface Page<T> {
  items: T[]
  page: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
}

export function paginate<T>(list: T[], page: number, perPage: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(list.length / perPage))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages)
  return {
    items: list.slice((current - 1) * perPage, current * perPage),
    page: current,
    totalPages,
    hasPrev: current > 1,
    hasNext: current < totalPages
  }
}

const normalize = (url: string) => url.replace(/(index)?(\.html)?$/, '').replace(/\/$/, '') || '/'

/** `route.path` includes the site `base` (`/vuemo/posts/a`), post urls do not: strip it. */
export function stripBase(path: string, base = '/'): string {
  const prefix = base.replace(/\/+$/, '')
  return prefix && (path === prefix || path.startsWith(prefix + '/')) ? path.slice(prefix.length) || '/' : path
}

/** The post served at `url` (with or without `.html` / `index`), if the loader accepted it. */
export function findPost<T extends { url: string }>(posts: T[], url: string): T | undefined {
  const target = normalize(url)
  return posts.find((p) => normalize(p.url) === target)
}

/** `posts` must be sorted newest first. prev = older, next = newer (chronological reading order). */
export function findPrevNext<T extends { url: string }>(posts: T[], url: string): { prev?: T; next?: T } {
  const target = normalize(url)
  const i = posts.findIndex((p) => normalize(p.url) === target)
  if (i === -1) return {}
  return { prev: posts[i + 1], next: posts[i - 1] }
}
