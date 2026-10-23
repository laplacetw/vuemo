import { describe, expect, it } from 'vitest'
import { parsePost } from '../src/schema'
import { groupByTag, groupByYear, groupByCategory } from '../src/group'
import { findPrevNext, paginate } from '../src/pagination'
import { postJsonLd } from '../src/seo'

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

describe('seo', () => {
  it('emits JSON-LD only for posts', () => {
    const page: any = { relativePath: 'posts/a.md', frontmatter: { title: 'A', date: '2024-01-02' } }
    expect(postJsonLd(page, 'https://x.com', '/b/')![2]).toContain('"url":"https://x.com/b/posts/a"')
    expect(postJsonLd({ ...page, relativePath: 'about.md' }, undefined)).toBeUndefined()
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
      nav: [{ text: 'Home', link: '/' }],
      footer: 'f',
      logo: '/logo.svg',
      socialLinks: [{ icon: 'github', link: 'https://github.com/x' }],
      postsPerPage: 9,
      custom: true
    })
    expect(cfg.nav).toBeUndefined()
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

describe('defineBlogConfig rss', () => {
  it('adds the feed link when hostname is set and not when rss is false', async () => {
    const on: any = await defineBlogConfig({ hostname: 'https://x.com', base: '/b/' })
    expect(on.head).toContainEqual(['link', { rel: 'alternate', type: 'application/rss+xml', href: '/b/feed.xml' }])
    const off: any = await defineBlogConfig({ hostname: 'https://x.com', rss: false })
    expect(off.head).toEqual([])
  })
})
