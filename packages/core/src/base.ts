/** VitePress `base` with a leading and a trailing slash: `/`, `/vuemo/`. Accepts `vuemo`, `/vuemo`, `/vuemo/`. */
export function normalizeBase(base = '/'): string {
  const inner = base.replace(/^\/+|\/+$/g, '')
  return inner ? `/${inner}/` : '/'
}
