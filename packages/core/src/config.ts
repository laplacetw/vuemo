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
import { isPostPath, type Post } from './schema'
import { virtualPlugin } from './virtual'
import { DEFAULT_THEME_NAME, isExplicitThemePath, resolveThemeSource, THEME_PREFIX } from './theme-source'
import type { FooterConfig, NavItem, SocialLink, VuemoThemeConfig } from './types'

export type { FooterConfig, NavItem, SocialLink, VuemoThemeConfig }

export interface BlogConfig extends Omit<UserConfig, 'lastUpdated'>, Partial<OfficialFeatures> {
  /**
   * The theme, resolved in this order: a path (`./x`, `../x` or absolute; a file or a folder), a folder `themes/<name>/` in the project,
   * the installed package `vuemo-theme-<name>` (short name), the installed package `<name>` (also `@scope/name`).
   * Default: `@vuemo/theme-default`.
   */
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
  /** RSS feed at `feed.xml`. On when `hostname` is set; `false` turns it off. `true` or `{ limit }` asks for it explicitly (then a missing `hostname` is warned about). */
  rss?: boolean | { limit?: number }
  /** Third-party and theme plugins. Official features are enabled by their own keys instead. */
  plugins?: VuemoPlugin[]
}

/** An `undefined` value must not override a default. */
const defined = <T extends object>(o?: T) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined))

/** Site origin plus base with a trailing slash: `https://example.com/vuemo/`. */
export const sitemapHostname = (hostname: string, base?: string) => hostname.replace(/\/+$/, '') + normalizeBase(base)

/**
 * The package names to bundle (they must be, like @vuemo/*): the package the theme resolves to, else `vuemo-theme-<name>` for
 * a short name. A bare `<name>` is only added when it is what the theme resolves to. Paths and `themes/` folders are not in node_modules.
 */
export const themePackageNames = (theme: string, root: string = process.cwd()): string[] => {
  if (isExplicitThemePath(theme) || (theme.includes('/') && !theme.startsWith('@'))) return []
  const found = resolveThemeSource(theme, root)
  if (found.ok) return found.kind === 'package' && found.packageName ? [found.packageName] : []
  if (theme === 'default') return [DEFAULT_THEME_NAME]
  return theme.startsWith('@') || theme.startsWith(THEME_PREFIX) ? [theme] : [THEME_PREFIX + theme]
}

export const DEFAULT_THEME = '@vuemo/theme-default'

/** The package name of a file inside `node_modules` (`.../node_modules/@s/p/src/x.vue` → `@s/p`; pnpm's nested layout uses the last one). */
export const packageOfFile = (file: string): string | undefined => {
  const m = file.replace(/\\/g, '/').match(/.*\/node_modules\/((?:@[^/]+\/)?[^/]+)\//)
  return m?.[1]
}

/**
 * Packages Vite's dependency optimizer (esbuild) must leave alone: they import `virtual:` modules or ship `.vue` / `.ts`
 * sources, which only Vite's plugin pipeline can handle. In a workspace they are linked (never optimized); installed from a
 * registry they sit in node_modules and would be pre-bundled, which fails with `Could not resolve "virtual:vuemo/theme"`.
 */
export const unoptimizedPackages = (theme: string, plugins: VuemoPlugin[], root?: string): string[] => {
  const fromPlugins = plugins.flatMap((p) => [p.enhanceApp, ...Object.values(p.slots ?? {})].map((f) => (f ? packageOfFile(f) : undefined)))
  return [...new Set(['@vuemo/core', DEFAULT_THEME, '@vuemo/plugin-comments', '@vuemo/plugin-ai-summary', ...themePackageNames(theme, root), ...fromPlugins].filter((n): n is string => !!n))]
}

/** `importer` only exists so tests don't need real plugin packages. */
export async function defineBlogConfig(config: BlogConfig = {}, importer?: Importer): Promise<UserConfig> {
  const { theme = DEFAULT_THEME, hostname, nav, footer, logo, socialLinks, postsPerPage, summary = 'excerpt', paths, search, lastUpdated, rss, plugins = [], ...rest } = config
  const features = Object.fromEntries(Object.keys(OFFICIAL_FEATURES).map((key) => [key, (rest as any)[key]]))
  for (const key of Object.keys(OFFICIAL_FEATURES)) delete (rest as any)[key]

  const rssEnabled = rss !== false && !!hostname
  // only a blog that asked for a feed is told why it does not get one
  if (rss && !hostname) console.warn('[vuemo] no RSS feed: `rss` is set but `hostname` is not. Set `hostname` (or remove `rss`).')

  const all = [...(await loadFeatures(features, importer)), ...plugins]

  let vite: Record<string, any> = rest.vite ?? {}
  for (const plugin of all) if (plugin.vite) vite = mergeConfig(vite as any, plugin.vite as any, false)
  // Vuemo packages ship .ts/.vue sources that Vite must process.
  vite = mergeConfig(
    vite as any,
    { plugins: [virtualPlugin(all, theme)], ssr: { noExternal: [/^@vuemo\//, ...themePackageNames(theme)] } } as any,
    false
  )
  // the user's `optimizeDeps` is kept; `exclude` gets the Vuemo packages added once
  const userOptimize = vite.optimizeDeps ?? {}
  vite = {
    ...vite,
    optimizeDeps: { ...userOptimize, exclude: [...new Set([...(userOptimize.exclude ?? []), ...unoptimizedPackages(theme, all, process.cwd())])] }
  }

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
    ...(lastUpdated && { lastUpdated: true }),
    // VitePress lists page URLs relative to the site root (`posts/a`) and the sitemap library resolves them
    // against `hostname`, so the base must be part of it, with a trailing slash (else `/vuemo` is dropped).
    sitemap: hostname ? { hostname: sitemapHostname(hostname, rest.base) } : undefined,
    ...rest,
    // a theme unzipped into `themes/` brings README.md and other Markdown that must not become pages; `themes/**` is always excluded
    srcExclude: [...(rest.srcExclude ?? ['README.md', 'CHANGELOG.md']), 'themes/**'],
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
    // Themes dispatch on `frontmatter.layout` only, so a post without one gets `post`. The user's own hook runs
    // first; its result is merged shallowly, as VitePress does.
    async transformPageData(pageData, ctx) {
      const result = (await rest.transformPageData?.(pageData, ctx)) || undefined
      const frontmatter = { ...pageData.frontmatter, ...result?.frontmatter }
      if (isPostPath(pageData.relativePath) && !frontmatter.layout) return { ...result, frontmatter: { ...frontmatter, layout: 'post' } }
      return result
    },
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
      const xml = buildRss(posts, { title, description, lang, base, hostname: hostname!, limit: typeof rss === 'object' ? rss.limit : undefined })
      mkdirSync(siteConfig.outDir, { recursive: true })
      writeFileSync(join(siteConfig.outDir, 'feed.xml'), xml)
    },
    // read by the posts loader (see loader.ts)
    vuemo: { plugins: all }
  } as UserConfig)
}
