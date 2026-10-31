// Types shared with client code: keep this file free of node imports.
import type { DefaultTheme } from 'vitepress'

export interface NavItem {
  text: string
  link: string
}

export interface SocialLink {
  /** A label shown as text (e.g. `github`) or custom inline SVG. */
  icon: string | { svg: string }
  link: string
  ariaLabel?: string
}

export interface FooterConfig {
  /** HTML, e.g. a credit line. */
  message?: string
  /** HTML, e.g. a copyright notice. */
  copyright?: string
}

/**
 * What `defineBlogConfig` writes into VitePress's `themeConfig`, i.e. what a theme reads with
 * `useData<VuemoThemeConfig>().theme.value`. Other `themeConfig` keys the user sets pass through untouched.
 */
export interface VuemoThemeConfig {
  nav?: NavItem[]
  /** Always an object: a string `footer` option becomes `{ message }`. */
  footer?: FooterConfig
  /** Path of a file in `public/`. */
  logo?: string
  socialLinks?: SocialLink[]
  postsPerPage?: number
  /** Always written; `'excerpt'` unless configured. */
  summary: 'excerpt' | 'description'
  /** Always written; both keys are always set (defaults `/tags` and `/categories`). */
  paths: { tag: string; category: string }
  /** Present only when search is on. */
  search?: { provider: 'local'; options?: DefaultTheme.LocalSearchOptions }
  /** Present only when last-updated is on. */
  lastUpdated?: { text?: string }
  /** Theme-specific keys. */
  [key: string]: unknown
}
