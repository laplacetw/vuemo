import { describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { parsePost } from '../src/schema'
import { groupByTag, groupByYear, groupByCategory } from '../src/group'
import { findPost, findPrevNext, paginate, stripBase } from '../src/pagination'
import { postJsonLd } from '../src/seo'
import { localDateTime, postTemplate, validPostName, yamlString } from '../src/newpost'
import { isPostPath } from '../src/schema'
import { taxonomyHref } from '../src/taxonomy'
import { searchRender } from '../src/search'
import { normalizeBase } from '../src/base'
import { onAfterRouteChange, readQueryParam, withQueryParam } from '../src/query'

const mk = (n: number, fm: Record<string, any> = {}) =>
  parsePost({ url: `/posts/p${n}`, frontmatter: { title: `P${n}`, date: `202${n}-01-01`, ...fm } }) as any

describe('parsePost', () => {
  it('normalizes valid frontmatter', () => {
    const p = mk(1, { tags: ['a', 3], category: 'x' })
    expect(p.date.string).toBe('2021-01-01')
    expect(p.tags).toEqual(['a'])
  })
  it('reports invalid fields', () => {
    expect(parsePost({ url: '/a', frontmatter: { date: '2020-01-01' } })).toMatch(/title/)
    expect(parsePost({ url: '/a', frontmatter: { title: 't', date: 'nope' } })).toMatch(/date/)
  })
})

describe('group', () => {
  const posts = [mk(3, { tags: ['b'], category: 'c' }), mk(2, { tags: ['a', 'b'] }), mk(1)]
  it('groups', () => {
    expect(groupByYear(posts).map((g) => g.year)).toEqual(['2023', '2022', '2021'])
    expect(Object.keys(groupByTag(posts))).toEqual(['a', 'b'])
    expect(Object.keys(groupByCategory(posts))).toEqual(['c'])
  })
})

describe('pagination', () => {
  it('clamps pages', () => {
    const r = paginate([1, 2, 3, 4, 5], 9, 2)
    expect(r).toMatchObject({ items: [5], page: 3, totalPages: 3, hasPrev: true, hasNext: false })
    expect(paginate([], 1, 5).totalPages).toBe(1)
  })
  it('finds prev/next', () => {
    const posts = [mk(3), mk(2), mk(1)]
    expect(findPrevNext(posts, '/posts/p2.html')).toEqual({ prev: posts[2], next: posts[0] })
    expect(findPrevNext(posts, '/nope')).toEqual({})
  })
})

describe('stripBase', () => {
  it('removes the site base from a route path', () => {
    expect(stripBase('/vuemo/posts/a', '/vuemo/')).toBe('/posts/a')
    expect(stripBase('/vuemo/', '/vuemo/')).toBe('/')
    expect(stripBase('/vuemo', '/vuemo/')).toBe('/')
  })
  it('leaves other paths alone', () => {
    expect(stripBase('/posts/a', '/')).toBe('/posts/a')
    expect(stripBase('/posts/a')).toBe('/posts/a')
    expect(stripBase('/vuemo-x/a', '/vuemo/')).toBe('/vuemo-x/a')
  })
})

describe('findPost', () => {
  const posts = [mk(2), mk(1)]
  it('finds a post by route path', () => {
    expect(findPost(posts, '/posts/p1.html')).toBe(posts[1])
    expect(findPost(posts, '/posts/p2')).toBe(posts[0])
    expect(findPost(posts, '/posts/p2/')).toBe(posts[0])
  })
  it('returns undefined for other pages', () => {
    expect(findPost(posts, '/about')).toBeUndefined()
  })
})

describe('taxonomyHref', () => {
  it('joins base and path', () => {
    expect(taxonomyHref('/', '/tags', 'tag', 'vuemo')).toBe('/tags?tag=vuemo')
    expect(taxonomyHref('/vuemo/', '/category', 'category', 'Notes')).toBe('/vuemo/category?category=Notes')
  })
  it('tolerates slashes', () => {
    expect(taxonomyHref('/vuemo', 'tags/', 'tag', 'a')).toBe('/vuemo/tags?tag=a')
    expect(taxonomyHref('/', '/topics/', 'tag', 'a')).toBe('/topics?tag=a')
  })
  it('encodes names', () => {
    expect(taxonomyHref('/', '/tags', 'tag', 'c++ & 中文/x?')).toBe('/tags?tag=c%2B%2B%20%26%20%E4%B8%AD%E6%96%87%2Fx%3F')
  })
})

describe('isPostPath', () => {
  it('matches pages under posts/ only', () => {
    expect(isPostPath('posts/a.md')).toBe(true)
    expect(isPostPath('posts/2024/a.md')).toBe(true)
    for (const p of ['about.md', 'postscript.md', 'docs/posts/a.md', 'Posts/a.md']) expect(isPostPath(p), p).toBe(false)
  })
})

describe('seo', () => {
  it('emits JSON-LD only for posts', () => {
    const page: any = { relativePath: 'posts/a.md', frontmatter: { title: 'A', date: '2024-01-02' } }
    expect(postJsonLd(page, 'https://x.com', '/b/')![2]).toContain('"url":"https://x.com/b/posts/a"')
    expect(postJsonLd({ ...page, relativePath: 'about.md' }, undefined)).toBeUndefined()
  })

  describe('dateModified', () => {
    const ld = (lastUpdated: number | undefined) =>
      JSON.parse(postJsonLd({ relativePath: 'posts/a.md', frontmatter: { title: 'A', date: '2024-01-02' }, lastUpdated } as any, undefined)![2] as string)

    it('uses a valid lastUpdated timestamp', () => {
      const t = Date.UTC(2025, 0, 5, 12)
      expect(ld(t).dateModified).toBe('2025-01-05T12:00:00.000Z')
    })
    it('is omitted for NaN, 0 and undefined', () => {
      for (const v of [NaN, 0, undefined]) expect(ld(v)).not.toHaveProperty('dateModified')
    })
    it('never precedes the publish date', () => {
      const j = ld(Date.UTC(2023, 0, 1))
      expect(j.dateModified).toBe(j.datePublished)
    })
  })
})

import { join } from 'node:path'
import { buildThemeModule, buildVirtualModule, loadThemeModule, virtualPlugin } from '../src/virtual'
import { defineBlogConfig } from '../src/config'

describe('plugins', () => {
  const plugin = {
    name: 'p',
    head: [['meta', { name: 'x', content: '1' }]] as any,
    vite: { define: { __X__: '1' } },
    slots: { 'post-comments': '/a/C.vue', bogus: '/a/B.vue' } as any,
    enhanceApp: '/a/enhance.ts',
    markdown: () => {}
  }
  it('builds the virtual module with only standard slots', () => {
    const code = buildVirtualModule([plugin])
    expect(code).toContain('import s0_0_post_comments from "/a/C.vue"')
    expect(code).toContain('"post-comments": [s0_0_post_comments]')
    expect(code).not.toContain('B.vue')
    expect(code).toContain('export const enhanceApps = [e0]')
  })
  it('merges plugin fields into the config', async () => {
    const cfg: any = await defineBlogConfig({ head: [['meta', { name: 'y' }]], vite: { define: { __Y__: '2' } }, plugins: [plugin] })
    expect(cfg.head).toHaveLength(2)
    expect(cfg.vite.define).toEqual({ __Y__: '2', __X__: '1' })
    expect(cfg.vite.plugins.some((p: any) => p.name === 'vuemo:virtual')).toBe(true)
    expect(cfg.vuemo.plugins).toEqual([plugin])
  })
})

describe('defineBlogConfig', () => {
  const fake = (name: string) => async () => ({ default: (options: any) => ({ name, head: [['meta', { name, content: JSON.stringify(options) }]] as any }) })
  const importer = async (pkg: string) => {
    if (pkg === '@vuemo/plugin-comments') return fake('comments')()
    const e: any = new Error('nope')
    e.code = 'ERR_MODULE_NOT_FOUND'
    throw e
  }

  it('maps site options into themeConfig, explicit themeConfig wins', async () => {
    const cfg: any = await defineBlogConfig({
      nav: [{ text: 'Home', link: '/' }],
      footer: 'f',
      logo: '/logo.svg',
      socialLinks: [{ icon: 'github', link: 'https://github.com/x' }],
      postsPerPage: 3,
      themeConfig: { postsPerPage: 9, custom: true }
    })
    expect(cfg.themeConfig).toEqual({
      summary: 'excerpt',
      paths: { tag: '/tags', category: '/category' },
      nav: [{ text: 'Home', link: '/' }],
      footer: { message: 'f' },
      logo: '/logo.svg',
      socialLinks: [{ icon: 'github', link: 'https://github.com/x' }],
      postsPerPage: 9,
      custom: true
    })
    expect(cfg.nav).toBeUndefined()
  })

  it('normalizes footer to an object', async () => {
    expect(((await defineBlogConfig({ footer: 'hi' })) as any).themeConfig.footer).toEqual({ message: 'hi' })
    expect(((await defineBlogConfig({ footer: { message: 'm', copyright: 'c' } })) as any).themeConfig.footer).toEqual({ message: 'm', copyright: 'c' })
    expect(((await defineBlogConfig({})) as any).themeConfig.footer).toBeUndefined()
    const cfg: any = await defineBlogConfig({ footer: 'hi', themeConfig: { footer: 'raw' } })
    expect(cfg.themeConfig.footer).toBe('raw')
  })

  it('defaults summary to excerpt and maps the summary option', async () => {
    expect(((await defineBlogConfig({})) as any).themeConfig.summary).toBe('excerpt')
    expect(((await defineBlogConfig({ summary: 'description' })) as any).themeConfig.summary).toBe('description')
    const cfg: any = await defineBlogConfig({ summary: 'description', themeConfig: { summary: 'excerpt' } })
    expect(cfg.themeConfig.summary).toBe('excerpt')
    expect(cfg.summary).toBeUndefined()
  })

  it('writes paths with defaults, user paths override per key', async () => {
    expect(((await defineBlogConfig({})) as any).themeConfig.paths).toEqual({ tag: '/tags', category: '/category' })
    const cfg: any = await defineBlogConfig({ paths: { tag: '/topics' } })
    expect(cfg.themeConfig.paths).toEqual({ tag: '/topics', category: '/category' })
    expect(cfg.paths).toBeUndefined()
  })

  it('merges paths per key and lets themeConfig.paths win', async () => {
    const cfg: any = await defineBlogConfig({ paths: { tag: '/a', category: '/b' }, themeConfig: { paths: { tag: '/t' } } })
    expect(cfg.themeConfig.paths).toEqual({ tag: '/t', category: '/b' })
    const partial: any = await defineBlogConfig({ themeConfig: { paths: { tag: '/t' } } })
    expect(partial.themeConfig.paths).toEqual({ tag: '/t', category: '/category' })
  })

  it('enables official features by their keys and strips them from the config', async () => {
    const cfg: any = await defineBlogConfig({ comments: { provider: 'utterances', repo: 'a/b' } } as any, importer)
    expect(cfg.head).toEqual([['meta', { name: 'comments', content: '{"provider":"utterances","repo":"a/b"}' }]])
    expect(cfg.comments).toBeUndefined()
  })

  it('treats false and missing features as disabled without importing them', async () => {
    const cfg: any = await defineBlogConfig({ comments: false, aiSummary: undefined } as any, async () => {
      throw new Error('should not import')
    })
    expect(cfg.head).toEqual([])
  })

  it('explains how to install a missing plugin', async () => {
    await expect(defineBlogConfig({ aiSummary: { api: 'x' } } as any, importer)).rejects.toThrow(
      /"aiSummary" is enabled but @vuemo\/plugin-ai-summary is not installed\. Run: pnpm add/
    )
  })

  it('points the theme module at the configured theme', async () => {
    const cfg: any = await defineBlogConfig({ theme: '@x/theme' })
    expect(cfg.vite.ssr.noExternal).toContain('@x/theme')
    // a short name may be the package vuemo-theme-<name>; a path or a themes/ folder is not a package
    expect(((await defineBlogConfig({ theme: 'trigger' })) as any).vite.ssr.noExternal).toEqual([/^@vuemo\//, 'trigger', 'vuemo-theme-trigger'])
    expect(((await defineBlogConfig({ theme: 'vuemo-theme-x' })) as any).vite.ssr.noExternal).toEqual([/^@vuemo\//, 'vuemo-theme-x'])
    expect(((await defineBlogConfig({ theme: './themes/x' })) as any).vite.ssr.noExternal).toEqual([/^@vuemo\//])
    const code = buildThemeModule('@x/theme')
    expect(code).toContain('import theme from "@x/theme"')
    expect(code).toContain('export default theme')
    expect(buildThemeModule('@x/theme', '/abs/theme.js')).toContain('import theme from "/abs/theme.js"')
  })
})

describe('srcExclude', () => {
  it('excludes README.md, CHANGELOG.md and themes/ by default', async () => {
    expect(((await defineBlogConfig({})) as any).srcExclude).toEqual(['README.md', 'CHANGELOG.md', 'themes/**'])
  })
  it('keeps themes/ excluded when the user sets srcExclude', async () => {
    expect(((await defineBlogConfig({ srcExclude: ['drafts/**'] })) as any).srcExclude).toEqual(['drafts/**', 'themes/**'])
  })
})

describe('theme module', () => {
  const run = (code: string, theme: unknown) => {
    // evaluate the generated module with `theme` as the imported default
    const body = code.replace(/^import theme from .*$/m, '').replace('export default theme', 'return theme')
    return new Function('theme', body)(theme)
  }
  const code = buildThemeModule('@x/theme')

  it('accepts a theme with a Layout, directly or through extends', () => {
    const layout = {}
    expect(run(code, { Layout: layout })).toEqual({ Layout: layout })
    const nested = { extends: { extends: { Layout: layout } } }
    expect(run(code, nested)).toBe(nested)
  })
  it('rejects anything else with an explanation', () => {
    for (const bad of [{}, undefined, null, 'x', () => {}, { extends: {} }, { extends: null }]) {
      expect(() => run(code, bad), String(bad)).toThrow('[vuemo] theme "@x/theme" does not default-export a VitePress theme ({ Layout, enhanceApp })')
    }
  })
  it('quotes the theme name safely in the message', () => {
    expect(() => run(buildThemeModule('a"b'), {})).toThrow('theme "a"b" does not')
  })
  const mkdir = () => mkdtempSync(join(tmpdir(), 'vuemo-theme-'))
  const err = (m: string): never => { throw new Error(m) }
  it('imports an installed package through the bundler resolution, from the project root', async () => {
    const root = mkdir()
    mkdirSync(join(root, 'node_modules/vuemo-theme-x'), { recursive: true })
    writeFileSync(join(root, 'node_modules/vuemo-theme-x/index.ts'), 'export default {}')
    const calls: any[] = []
    const ctx = { resolve: async (id: string, importer?: string) => (calls.push([id, importer]), { id: '/resolved/theme.ts' }), error: err }
    const out = await loadThemeModule(ctx, 'x', root)
    expect(calls).toEqual([['vuemo-theme-x', join(root, 'index.html')]])
    expect(out).toContain('import theme from "/resolved/theme.ts"')
    // when the bundler cannot resolve it, the entry found on disk is used
    const out2 = await loadThemeModule({ resolve: async () => null, error: err }, 'x', root)
    expect(out2).toContain('index.ts"')
  })
  it('imports a local folder or a path by its absolute entry, without the bundler', async () => {
    const root = mkdir()
    mkdirSync(join(root, 'themes/t'), { recursive: true })
    writeFileSync(join(root, 'themes/t/index.ts'), 'export default {}')
    const ctx = { resolve: async () => { throw new Error('must not resolve') }, error: err }
    expect(await loadThemeModule(ctx, 't', root)).toContain(JSON.stringify(join(root, 'themes/t/index.ts')))
    expect(await loadThemeModule(ctx, './themes/t', root)).toContain(JSON.stringify(join(root, 'themes/t/index.ts')))
  })
  it('explains a theme that cannot be resolved', async () => {
    const root = mkdir()
    const ctx = { resolve: async () => null, error: err }
    const e = (await loadThemeModule(ctx, 'nope', root).catch((x) => x)) as Error
    expect(e.message).toContain('[vuemo] theme "nope" was not found')
    expect(e.message).toContain('npm install vuemo-theme-nope')
  })
  it('says a theme path does not exist', async () => {
    const ctx = { resolve: async () => null, error: err }
    await expect(loadThemeModule(ctx, '/abs/theme.ts', '/p')).rejects.toThrow('theme path "/abs/theme.ts" does not exist')
  })
  it('limits the extends chain so a cycle cannot hang', () => {
    expect(buildThemeModule('x')).toContain('i < 10')
  })
  it('remembers the root in configResolved', async () => {
    const plugin: any = virtualPlugin([], 'nope-theme')
    plugin.configResolved({ root: '/proj' })
    const ctx = { resolve: async () => null, error: (m: string): never => { throw new Error(m) } }
    await expect(plugin.load.call(ctx, '\0virtual:vuemo/theme')).rejects.toThrow(join('/proj', 'themes', 'nope-theme'))
  })
})

describe('transformPageData', () => {
  const page = (relativePath: string, frontmatter: Record<string, any> = {}): any => ({ relativePath, frontmatter })
  const run = async (config: any, p: any) => (await defineBlogConfig(config) as any).transformPageData(p, {})
  const apply = async (config: any, p: any) => {
    Object.assign(p, await run(config, p))
    return p
  }

  it('gives posts without a layout the post layout', async () => {
    expect((await apply({}, page('posts/a.md', { title: 'A' }))).frontmatter).toEqual({ title: 'A', layout: 'post' })
  })
  it('keeps an explicit layout', async () => {
    expect((await apply({}, page('posts/a.md', { layout: 'page' }))).frontmatter.layout).toBe('page')
  })
  it('leaves other pages alone', async () => {
    for (const path of ['about.md', 'index.md', 'postscript.md', 'docs/posts/a.md']) {
      expect(await run({}, page(path, { title: 'x' })), path).toBeUndefined()
    }
  })
  it('runs the user hook first and keeps what it returns', async () => {
    const order: string[] = []
    const transformPageData = (p: any) => {
      order.push('user')
      return { frontmatter: { ...p.frontmatter, extra: 1 }, title: 'T' }
    }
    const p = await apply({ transformPageData }, page('posts/a.md', { title: 'A' }))
    expect(p.frontmatter).toEqual({ title: 'A', extra: 1, layout: 'post' })
    expect(p.title).toBe('T')
    expect(order).toEqual(['user'])
    // not a post: the user's result passes through untouched
    expect(await run({ transformPageData }, page('about.md'))).toEqual({ frontmatter: { extra: 1 }, title: 'T' })
  })
  it('sees a layout the user hook sets by mutation or by return value', async () => {
    const mutate = (p: any) => void (p.frontmatter.layout = 'page')
    expect((await apply({ transformPageData: mutate }, page('posts/a.md'))).frontmatter.layout).toBe('page')
    const ret = async () => ({ frontmatter: { layout: 'archive' } })
    expect((await apply({ transformPageData: ret }, page('posts/a.md', { title: 'A' }))).frontmatter).toEqual({ layout: 'archive' })
  })
  it('treats a user hook returning nothing as no result', async () => {
    const p = await apply({ transformPageData: () => {} }, page('posts/a.md'))
    expect(p.frontmatter.layout).toBe('post')
  })
})

import { buildRss } from '../src/rss'

describe('rss', () => {
  const posts = [mk(3, { description: 'a & b' }), mk(2), mk(1)]
  const xml = buildRss(posts, { title: 'T <x>', hostname: 'https://x.com/', base: '/b/', lang: 'en', limit: 2 })

  it('lists the newest posts with absolute links', () => {
    expect(xml.match(/<item>/g)).toHaveLength(2)
    expect(xml).toContain('<link>https://x.com/b/posts/p3</link>')
    expect(xml).toContain('<link>https://x.com/b/</link>')
    expect(xml.indexOf('P3')).toBeLessThan(xml.indexOf('P2'))
  })
  it('escapes text', () => {
    expect(xml).toContain('<title>T &lt;x&gt;</title>')
    expect(xml).toContain('<description>a &amp; b</description>')
  })
})

describe('normalizeBase', () => {
  it('adds the missing slashes', () => {
    for (const b of [undefined, '', '/', '//']) expect(normalizeBase(b)).toBe('/')
    for (const b of ['vuemo', '/vuemo', '/vuemo/', 'vuemo/']) expect(normalizeBase(b)).toBe('/vuemo/')
    expect(normalizeBase('/a/b')).toBe('/a/b/')
  })
  it('is used for the feed link, the feed items and the JSON-LD url', async () => {
    const cfg: any = await defineBlogConfig({ hostname: 'https://x.com', base: '/vuemo' })
    expect(cfg.head).toContainEqual(['link', { rel: 'alternate', type: 'application/rss+xml', href: '/vuemo/feed.xml' }])
    expect(buildRss([mk(1)], { title: 'T', hostname: 'https://x.com', base: '/vuemo' })).toContain('https://x.com/vuemo/posts/p1')
    const page: any = { relativePath: 'posts/a.md', frontmatter: { title: 't', date: '2025-01-01' } }
    expect(postJsonLd(page, 'https://x.com', '/vuemo')![2]).toContain('"url":"https://x.com/vuemo/posts/a"')
  })
})

describe('defineBlogConfig sitemap', () => {
  it('puts the normalized base into the sitemap hostname, with one trailing slash', async () => {
    const host = async (hostname?: string, base?: string) => ((await defineBlogConfig({ hostname, base })) as any).sitemap?.hostname
    expect(await host('https://x.com')).toBe('https://x.com/')
    expect(await host('https://x.com/', '/')).toBe('https://x.com/')
    expect(await host('https://x.com', '/vuemo/')).toBe('https://x.com/vuemo/')
    expect(await host('https://x.com/', 'vuemo')).toBe('https://x.com/vuemo/')
    expect(await host('https://x.com//', '//a/b//')).toBe('https://x.com/a/b/')
    expect(await host(undefined, '/vuemo/')).toBeUndefined()
  })
})

describe('defineBlogConfig rss warning', () => {
  const warnings = async (config: any) => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await defineBlogConfig(config)
      return spy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('RSS'))
    } finally {
      spy.mockRestore()
    }
  }
  it('stays silent when rss was not asked for', async () => {
    expect(await warnings({})).toEqual([])
    expect(await warnings({ rss: false })).toEqual([])
    expect(await warnings({ hostname: 'https://x.com' })).toEqual([])
  })
  it('warns when rss is set without a hostname', async () => {
    expect(await warnings({ rss: true })).toHaveLength(1)
    expect(await warnings({ rss: { limit: 5 } })).toHaveLength(1)
    expect(await warnings({ rss: true, hostname: 'https://x.com' })).toEqual([])
  })
  it('does not add the feed link without a hostname, and accepts rss: true', async () => {
    expect(((await defineBlogConfig({ rss: true })) as any).head).toEqual([])
    const on: any = await defineBlogConfig({ rss: true, hostname: 'https://x.com' })
    expect(on.head).toHaveLength(1)
  })
})

describe('defineBlogConfig rss', () => {
  it('adds the feed link when hostname is set and not when rss is false', async () => {
    const on: any = await defineBlogConfig({ hostname: 'https://x.com', base: '/b/' })
    expect(on.head).toContainEqual(['link', { rel: 'alternate', type: 'application/rss+xml', href: '/b/feed.xml' }])
    const off: any = await defineBlogConfig({ hostname: 'https://x.com', rss: false })
    expect(off.head).toEqual([])
  })
})

describe('defineBlogConfig search', () => {
  it('is off by default and with false', async () => {
    expect(((await defineBlogConfig({})) as any).themeConfig.search).toBeUndefined()
    const off: any = await defineBlogConfig({ search: false })
    expect(off.themeConfig.search).toBeUndefined()
    expect('search' in off).toBe(false)
  })
  it('true turns the local provider on with searchRender', async () => {
    const cfg: any = await defineBlogConfig({ search: true })
    expect(cfg.themeConfig.search).toEqual({ provider: 'local', options: { _render: searchRender } })
    expect('search' in cfg).toBe(false)
  })
  it('passes VitePress options through and lets the user override _render', async () => {
    const cfg: any = await defineBlogConfig({ search: { detailedView: true, miniSearch: { searchOptions: { fuzzy: 0.5 } } } })
    expect(cfg.themeConfig.search.options).toMatchObject({ detailedView: true, _render: searchRender })
    expect(cfg.themeConfig.search.options.miniSearch.searchOptions.fuzzy).toBe(0.5)
    const _render = () => 'x'
    expect(((await defineBlogConfig({ search: { _render } })) as any).themeConfig.search.options._render).toBe(_render)
  })
  it('lets an explicit themeConfig.search win', async () => {
    const cfg: any = await defineBlogConfig({ search: true, themeConfig: { search: { provider: 'local', options: { detailedView: true } } } })
    expect(cfg.themeConfig.search).toEqual({ provider: 'local', options: { detailedView: true } })
  })
})

describe('searchRender', () => {
  const md = { render: (src: string, env?: any) => {
    if (env) env.frontmatter = (globalThis as any).__fm
    return src.startsWith('# ') ? `<h1>${src.slice(2)}</h1>` : `<p>${src}</p>`
  } }
  const run = (fm: Record<string, any>, src = 'body') => {
    ;(globalThis as any).__fm = fm
    return searchRender(src, {}, md as any)
  }
  it('prepends the title as a heading', () => {
    expect(run({ title: 'Hello' })).toBe('<h1>Hello<a class="header-anchor" href="#"></a></h1><p>body</p>')
  })
  it('escapes the title and gives it an empty anchor, so it never clashes with a body heading', () => {
    const out = run({ title: 'A <b>&</b> "Setup"' }, '<h2 id="setup">Setup <a class="header-anchor" href="#setup"></a></h2>')
    expect(out.startsWith('<h1>A &lt;b&gt;&amp;&lt;/b&gt; &quot;Setup&quot;<a class="header-anchor" href="#"></a></h1>')).toBe(true)
    expect(out).not.toContain('href="#setup-1"')
  })
  it('keeps the page as is when there is no title', () => {
    expect(run({})).toBe('<p>body</p>')
  })
  it('skips listing layouts and search: false', () => {
    for (const layout of ['home', 'archive', 'tag', 'category']) expect(run({ title: 'T', layout })).toBe('')
    expect(run({ title: 'T', search: false })).toBe('')
    expect(run({ title: 'T', layout: 'post' })).not.toBe('')
  })
})

describe('defineBlogConfig lastUpdated', () => {
  it('is off by default and with false', async () => {
    for (const cfg of [await defineBlogConfig({}), await defineBlogConfig({ lastUpdated: false })] as any[]) {
      expect(cfg.lastUpdated).toBeUndefined()
      expect(cfg.themeConfig.lastUpdated).toBeUndefined()
    }
  })
  it('true enables the VitePress option; the theme supplies the default text', async () => {
    const cfg: any = await defineBlogConfig({ lastUpdated: true })
    expect(cfg.lastUpdated).toBe(true)
    expect(cfg.themeConfig.lastUpdated).toEqual({})
  })
  it('takes a custom text', async () => {
    const cfg: any = await defineBlogConfig({ lastUpdated: { text: 'Edited' } })
    expect(cfg.lastUpdated).toBe(true)
    expect(cfg.themeConfig.lastUpdated).toEqual({ text: 'Edited' })
    expect(((await defineBlogConfig({ lastUpdated: {} })) as any).themeConfig.lastUpdated).toEqual({})
  })
  it('lets an explicit themeConfig.lastUpdated win', async () => {
    const cfg: any = await defineBlogConfig({ lastUpdated: true, themeConfig: { lastUpdated: { text: 'X' } } })
    expect(cfg.themeConfig.lastUpdated).toEqual({ text: 'X' })
  })
})

describe('defineBlogConfig paths with undefined values', () => {
  it('keeps the defaults', async () => {
    const a: any = await defineBlogConfig({ paths: { tag: undefined } })
    expect(a.themeConfig.paths).toEqual({ tag: '/tags', category: '/category' })
    const b: any = await defineBlogConfig({ paths: { tag: '/t' }, themeConfig: { paths: { tag: undefined, category: undefined } } })
    expect(b.themeConfig.paths).toEqual({ tag: '/t', category: '/category' })
  })
})

describe('query param helpers', () => {
  it('reads a param', () => {
    expect(readQueryParam('?page=2&tag=a%20b', 'tag')).toBe('a b')
    expect(readQueryParam('?page=2', 'tag')).toBe('')
    expect(readQueryParam('', 'page')).toBe('')
  })
  it('sets and removes a param, keeping the rest', () => {
    expect(withQueryParam('https://x.io/tags?a=1#h', 'tag', 'a b').href).toBe('https://x.io/tags?a=1&tag=a+b#h')
    expect(withQueryParam('https://x.io/tags?tag=x&a=1', 'tag', '').href).toBe('https://x.io/tags?a=1')
    expect(withQueryParam('https://x.io/?page=2', 'page', '').href).toBe('https://x.io/')
  })
})

describe('onAfterRouteChange', () => {
  it('chains behind the previous hook, in order', async () => {
    const calls: string[] = []
    const host: any = { onAfterRouteChange: async (h: string) => void calls.push('prev ' + h) }
    onAfterRouteChange(host, (h) => calls.push('cb ' + h))
    await host.onAfterRouteChange('/a')
    expect(calls).toEqual(['prev /a', 'cb /a'])
  })
  it('falls back to the old hook name', async () => {
    const calls: string[] = []
    const host: any = { onAfterRouteChanged: () => void calls.push('old') }
    onAfterRouteChange(host, () => calls.push('cb'))
    await host.onAfterRouteChange('/a')
    expect(calls).toEqual(['old', 'cb'])
  })
  it('restores the previous hook on stop', () => {
    const prev = () => {}
    const host: any = { onAfterRouteChange: prev }
    const stop = onAfterRouteChange(host, () => {})
    stop()
    expect(host.onAfterRouteChange).toBe(prev)
    const bare: any = {}
    onAfterRouteChange(bare, () => {})()
    expect(bare.onAfterRouteChange).toBeUndefined()
  })
  it('keeps hooks installed on top of ours, but silences ours', async () => {
    const calls: string[] = []
    const host: any = {}
    const stop = onAfterRouteChange(host, () => calls.push('cb'))
    const ours = host.onAfterRouteChange
    host.onAfterRouteChange = async (h: string) => {
      await ours(h)
      calls.push('later')
    }
    stop()
    await host.onAfterRouteChange('/a')
    expect(calls).toEqual(['later'])
  })
})

describe('json-ld hardening', () => {
  it('escapes < so a title cannot close the script tag', () => {
    const out = postJsonLd({ relativePath: 'posts/a.md', frontmatter: { title: '</script><b>', date: '2024-01-02' } } as any, undefined)![2] as string
    expect(out).not.toContain('<')
    expect(JSON.parse(out).headline).toBe('</script><b>')
  })
  it('skips an invalid date instead of throwing', () => {
    expect(postJsonLd({ relativePath: 'posts/a.md', frontmatter: { title: 'A', date: 'nope' } } as any, undefined)).toBeUndefined()
  })
})

describe('vuemo new helpers', () => {
  it('rejects names that leave posts/', () => {
    for (const n of ['../x', 'a/b', 'a\\b', '..', 'a..b', '', ' ']) expect(validPostName(n), n).toBe(false)
    expect(validPostName('my-post')).toBe(true)
  })
  it('formats date and time from local components of one Date', () => {
    expect(localDateTime(new Date(2025, 0, 5, 3, 4, 9))).toBe('2025-01-05 03:04:09')
    expect(localDateTime(new Date(2025, 11, 31, 23, 59, 59))).toBe('2025-12-31 23:59:59')
  })
  it('quotes the title as a YAML string', () => {
    expect(yamlString('a: b # c "d"')).toBe('"a: b # c \\"d\\""')
    expect(postTemplate('note-x', new Date(2025, 0, 5, 1, 2, 3))).toContain('title: "Note x"\ndate: 2025-01-05 01:02:03\n')
    expect(postTemplate("it's: [odd]", new Date())).toContain('title: "It\'s: [odd]"')
  })
})
