import { describe, expect, it } from 'vitest'
import { parsePost } from '../src/schema'
import { groupByTag, groupByYear, groupByCategory } from '../src/group'
import { findPost, findPrevNext, paginate } from '../src/pagination'
import { postJsonLd } from '../src/seo'
import { taxonomyHref } from '../src/taxonomy'
import { searchRender } from '../src/search'
import { normalizeBase } from '../src/base'

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
    expect(findPrevNext(posts, '/posts/p2.html')).toEqual({ prev: posts[0], next: posts[2] })
    expect(findPrevNext(posts, '/nope')).toEqual({})
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

import { buildThemeModule, buildVirtualModule } from '../src/virtual'
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
    expect(buildThemeModule('@x/theme')).toBe('export { default } from "@x/theme"\n')
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
