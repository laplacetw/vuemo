/** Safe to import on the client: no vitepress import here. */

/** The value of `?key=` in a `location.search` string, or `''`. */
export function readQueryParam(search: string, key: string): string {
  return new URLSearchParams(search).get(key) ?? ''
}

/** `href` with `?key=` set to `value`, or removed when `value` is empty. Other params and the hash are kept. */
export function withQueryParam(href: string, key: string, value: string): URL {
  const url = new URL(href)
  value ? url.searchParams.set(key, value) : url.searchParams.delete(key)
  return url
}

type RouteHook = (href: string) => unknown
/** The part of VitePress's router that carries the after-route-change hook (`onAfterRouteChanged` is its old name). */
export interface RouteHookHost {
  onAfterRouteChange?: RouteHook
  onAfterRouteChanged?: RouteHook
}

/**
 * Calls `callback` after every route change (link navigation and Back/Forward), chained behind the hook
 * that was installed before. Returns a function that stops it: the previous hook is restored when ours is
 * still the current one; if someone else installed a hook on top of ours in the meantime, ours stays in the
 * chain (a hook of theirs may depend on it) but does nothing anymore, so their hook is never dropped.
 */
export function onAfterRouteChange(host: RouteHookHost, callback: (href: string) => void): () => void {
  const original = host.onAfterRouteChange
  const previous = original ?? host.onAfterRouteChanged
  let active = true
  const ours: RouteHook = async (href) => {
    await previous?.(href)
    if (active) callback(href)
  }
  host.onAfterRouteChange = ours
  return () => {
    active = false
    if (host.onAfterRouteChange === ours) host.onAfterRouteChange = original
  }
}
