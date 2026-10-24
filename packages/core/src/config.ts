import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, mergeConfig, type UserConfig } from 'vitepress'
import { postJsonLd } from './seo'
import type { VuemoPlugin } from './plugin'
import { loadFeatures, OFFICIAL_FEATURES, type Importer, type OfficialFeatures } from './features'
import { createPostsLoader } from './loader'
import { buildRss } from './rss'
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

export interface BlogConfig extends UserConfig, Partial<OfficialFeatures> {
  /** Theme package. Default: `@vuemo/theme-default`. */
  theme?: string
  /** Site origin, e.g. https://example.com. Used by sitemap and JSON-LD. */
  hostname?: string
  /** → themeConfig.nav */
  nav?: NavItem[]
  /** HTML shown in the footer. → themeConfig.footer */
  footer?: string
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
  /** RSS feed at `feed.xml`. On when `hostname` is set; `false` turns it off. */
  rss?: false | { limit?: number }
  /** Third-party and theme plugins. Official features are enabled by their own keys instead. */
  plugins?: VuemoPlugin[]
}

export const DEFAULT_THEME = '@vuemo/theme-default'

/** `importer` only exists so tests don't need real plugin packages. */
export async function defineBlogConfig(config: BlogConfig = {}, importer?: Importer): Promise<UserConfig> {
  const { theme = DEFAULT_THEME, hostname, nav, footer, logo, socialLinks, postsPerPage, summary = 'excerpt', paths, rss, plugins = [], ...rest } = config
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

  const themeConfig = {
    ...(nav && { nav }),
    ...(footer && { footer }),
    ...(logo && { logo }),
    ...(socialLinks && { socialLinks }),
    ...(postsPerPage && { postsPerPage }),
    summary,
    paths: { tag: '/tags', category: '/category', ...paths },
    ...rest.themeConfig
  }

  return defineConfig({
    cleanUrls: true,
    srcExclude: ['README.md', 'CHANGELOG.md'],
    sitemap: hostname ? { hostname } : undefined,
    ...rest,
    themeConfig,
    head: [
      ...(rest.head ?? []),
      ...all.flatMap((p) => p.head ?? []),
      ...(rssEnabled
        ? [['link', { rel: 'alternate', type: 'application/rss+xml', href: `${rest.base ?? '/'}feed.xml` }] as [string, Record<string, string>]]
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
