/** Safe to import on the client: no vitepress import here. */
export type TaxonomyKey = 'tag' | 'category'

/** `base` is the site base (`/` or `/vuemo/`), `path` the page of the tag/category layout. */
export function taxonomyHref(base: string, path: string, key: TaxonomyKey, name: string): string {
  const prefix = base.replace(/\/+$/, '')
  const segment = path.replace(/^\/+|\/+$/g, '')
  return `${prefix}/${segment}?${key}=${encodeURIComponent(name)}`
}
