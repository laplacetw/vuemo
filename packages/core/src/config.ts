import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, mergeConfig, type DefaultTheme, type UserConfig } from 'vitepress'
import { postJsonLd } from './seo'
import type { VuemoPlugin } from './plugin'
import { loadFeatures, OFFICIAL_FEATURES, type Importer, type OfficialFeatures } from './features'
import { createPostsLoader } from './loader'
import { normalizeBase } from './base'
import { buildRss } from './rss'
import { searchRender } from './search'
import type { Post } from './schema'
import { virtualPlugin } from './virtual'

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
  /** Always written; both keys are always set (defaults `/tags` and `/category`). */
  paths: { tag: string; category: string }
  /** Present only when search is on. */
  search?: { provider: 'local'; options?: DefaultTheme.LocalSearchOptions }
  /** Present only when last-updated is on. */
  lastUpdated?: { text?: string }
  /** Theme-specific keys. */
  [key: string]: unknown
}

export interface BlogConfig extends Omit<UserConfig, 'lastUpdated'>, Partial<OfficialFeatures> {
  /** Theme package. Default: `@vuemo/theme-default`. */
  theme?: string
  /** Site origin, e.g. https://example.com. Used by sitemap and JSON-LD. */
  hostname?: string
  /** → themeConfig.nav */
  nav?: NavItem[]
  /** HTML shown in the footer: a string (the message) or `{ message, copyright }`. → themeConfig.footer (always an object) */
  footer?: string | FooterConfig
  /** Path of a file in `public/`. → themeConfig.logo */
  logo?: string
  /** → themeConfig.socialLinks */
  socialLinks?: SocialLink[]
  /** What the home page lists under each post: its excerpt (default) or its description. → themeConfig.summary */
  summary?: 'excerpt' | 'description'
  /** Where the tag and category layouts live. Default `/tags` and `/category`. → themeConfig.paths */
  paths?: { tag?: string; category?: string }
  /** → themeConfig.postsPerPage */
  postsPerPage?: number
  /** Full-text local search (VitePress's local search; the theme renders the UI). Off by default. → themeConfig.search */
  search?: boolean | DefaultTheme.LocalSearchOptions
  /** Show when posts were last updated (from git history). `true` or `{ text }` turns it on. Off by default; a post opts out with `lastUpdated: false`. */
  lastUpdated?: boolean | { text?: string }
  /** RSS feed at `feed.xml`. On when `hostname` is set; `false` turns it off. */
  rss?: false | { limit?: number }
  /** Third-party and theme plugins. Official features are enabled by their own keys instead. */
  plugins?: VuemoPlugin[]
}

/** An `undefined` value must not override a default. */
const defined = <T extends object>(o?: T) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined))

/** Site origin plus base with a trailing slash: `https://example.com/vuemo/`. */
export const sitemapHostname = (hostname: string, base?: string) => hostname.replace(/\/+$/, '') + normalizeBase(base)

export const DEFAULT_THEME = '@vuemo/theme-default'

/** `importer` only exists so tests don't need real plugin packages. */
export async function defineBlogConfig(config: BlogConfig = {}, importer?: Importer): Promise<UserConfig> {
  const { theme = DEFAULT_THEME, hostname, nav, footer, logo, socialLinks, postsPerPage, summary = 'excerpt', paths, search, lastUpdated, rss, plugins = [], ...rest } = config
  const features = Object.fromEntries(Object.keys(OFFICIAL_FEATURES).map((key) => [key, (rest as any)[key]]))
  for (const key of Object.keys(OFFICIAL_FEATURES)) delete (rest as any)[key]

  const rssEnabled = rss !== false && !!hostname
  if (rss !== false && !hostname) console.warn('[vuemo] no RSS feed: set `hostname` (or `rss: false` to silence this)')

  const all = [...(await loadFeatures(features, importer)), ...plugins]

  let vite: Record<string, any> = rest.vite ?? {}
  for (const plugin of all) if (plugin.vite) vite = mergeConfig(vite as any, plugin.vite as any, false)
  // Vuemo packages ship .ts/.vue sources that Vite must process.
  vite = mergeConfig(
    vite as any,
    { plugins: [virtualPlugin(all, theme)], ssr: { noExternal: [/^@vuemo\//, theme] } } as any,
    false
  )

  const themeConfig: VuemoThemeConfig = {
    ...(nav && { nav }),
    ...(footer && { footer: typeof footer === 'string' ? { message: footer } : footer }),
    ...(logo && { logo }),
    ...(socialLinks && { socialLinks }),
    ...(postsPerPage && { postsPerPage }),
    ...(lastUpdated && { lastUpdated: { ...(lastUpdated !== true && lastUpdated.text && { text: lastUpdated.text }) } }),
    ...(search && {
      search: { provider: 'local' as const, options: { _render: searchRender, ...(search === true ? {} : search) } }
    }),
    summary,
    ...rest.themeConfig,
    // merged per key, so a partial `themeConfig.paths` keeps the other default
    paths: { tag: '/tags', category: '/category', ...defined(paths), ...defined(rest.themeConfig?.paths) }
  }

  return defineConfig({
    cleanUrls: true,
    srcExclude: ['README.md', 'CHANGELOG.md'],
    ...(lastUpdated && { lastUpdated: true }),
    // VitePress lists page URLs relative to the site root (`posts/a`) and the sitemap library resolves them
    // against `hostname`, so the base must be part of it, with a trailing slash (else `/vuemo` is dropped).
    sitemap: hostname ? { hostname: sitemapHostname(hostname, rest.base) } : undefined,
    ...rest,
    themeConfig,
    head: [
      ...(rest.head ?? []),
      ...all.flatMap((p) => p.head ?? []),
      ...(rssEnabled
        ? [['link', { rel: 'alternate', type: 'application/rss+xml', href: `${normalizeBase(rest.base)}feed.xml` }] as [string, Record<string, string>]]
        : [])
    ],
    markdown: {
      ...rest.markdown,
      config(md) {
        rest.markdown?.config?.(md)
        for (const plugin of all) plugin.markdown?.(md)
      }
    },
    vite,
    transformHead(ctx) {
      const head = [...((rest.transformHead?.(ctx) as any) ?? [])]
      const ld = postJsonLd(ctx.pageData, hostname, rest.base)
      if (ld) head.push(ld)
      return head
    },
    async buildEnd(siteConfig) {
      await rest.buildEnd?.(siteConfig)
      if (!rssEnabled) return
      const posts = (await createPostsLoader().load()) as unknown as Post[]
      const { title, description, lang, base } = siteConfig.site
      const xml = buildRss(posts, { title, description, lang, base, hostname: hostname!, limit: rss ? rss.limit : undefined })
      mkdirSync(siteConfig.outDir, { recursive: true })
      writeFileSync(join(siteConfig.outDir, 'feed.xml'), xml)
    },
    // read by the posts loader (see loader.ts)
    vuemo: { plugins: all }
  } as UserConfig)
}
