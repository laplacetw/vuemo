import { defineConfig, mergeConfig, type UserConfig } from 'vitepress'
import { postJsonLd } from './seo'
import type { VuemoPlugin } from './plugin'
import { virtualPlugin } from './virtual'

export interface BlogConfig extends UserConfig {
  /** Site origin, e.g. https://example.com. Used by sitemap and JSON-LD. */
  hostname?: string
  plugins?: VuemoPlugin[]
}

export function defineBlogConfig(config: BlogConfig = {}): UserConfig {
  const { hostname, plugins = [], ...rest } = config

  let vite: Record<string, any> = rest.vite ?? {}
  for (const plugin of plugins) if (plugin.vite) vite = mergeConfig(vite as any, plugin.vite as any, false)
  // Vuemo packages ship .ts/.vue sources that Vite must process.
  vite = mergeConfig(vite as any, { plugins: [virtualPlugin(plugins)], ssr: { noExternal: [/^@vuemo\//] } } as any, false)

  return defineConfig({
    cleanUrls: true,
    srcExclude: ['README.md', 'CHANGELOG.md'],
    sitemap: hostname ? { hostname } : undefined,
    ...rest,
    head: [...(rest.head ?? []), ...plugins.flatMap((p) => p.head ?? [])],
    markdown: {
      ...rest.markdown,
      config(md) {
        rest.markdown?.config?.(md)
        for (const plugin of plugins) plugin.markdown?.(md)
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
    vuemo: { plugins }
  } as UserConfig)
}
