import { defineConfig, mergeConfig, type UserConfig } from 'vitepress'
import { postJsonLd } from './seo'
import type { VuemoPlugin } from './plugin'
import { loadFeatures, OFFICIAL_FEATURES, type Importer, type OfficialFeatures } from './features'
import { virtualPlugin } from './virtual'

export interface NavItem {
  text: string
  link: string
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
  /** → themeConfig.postsPerPage */
  postsPerPage?: number
  /** Third-party and theme plugins. Official features are enabled by their own keys instead. */
  plugins?: VuemoPlugin[]
}

export const DEFAULT_THEME = '@vuemo/theme-default'

/** `importer` only exists so tests don't need real plugin packages. */
export async function defineBlogConfig(config: BlogConfig = {}, importer?: Importer): Promise<UserConfig> {
  const { theme = DEFAULT_THEME, hostname, nav, footer, postsPerPage, plugins = [], ...rest } = config
  const features = Object.fromEntries(Object.keys(OFFICIAL_FEATURES).map((key) => [key, (rest as any)[key]]))
  for (const key of Object.keys(OFFICIAL_FEATURES)) delete (rest as any)[key]

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
    ...(postsPerPage && { postsPerPage }),
    ...rest.themeConfig
  }

  return defineConfig({
    cleanUrls: true,
    srcExclude: ['README.md', 'CHANGELOG.md'],
    sitemap: hostname ? { hostname } : undefined,
    ...rest,
    themeConfig,
    head: [...(rest.head ?? []), ...all.flatMap((p) => p.head ?? [])],
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
    // read by the posts loader (see loader.ts)
    vuemo: { plugins: all }
  } as UserConfig)
}
