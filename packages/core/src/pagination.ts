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

/** `posts` must be sorted newest first. prev = newer, next = older. */
export function findPrevNext<T extends { url: string }>(posts: T[], url: string): { prev?: T; next?: T } {
  const target = normalize(url)
  const i = posts.findIndex((p) => normalize(p.url) === target)
  if (i === -1) return {}
  return { prev: posts[i - 1], next: posts[i + 1] }
}
