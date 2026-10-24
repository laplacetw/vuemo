import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Post-build checks on the example blog. Run `pnpm build` first.
const root = resolve(__dirname, '..')
const dist = resolve(root, '.vitepress/dist')
const themeCss = resolve(root, '../../themes/default/dist/style.css')
// the workflow builds with BASE=/vuemo/; link assertions must follow it
const base = process.env.BASE ?? '/'

if (!existsSync(dist)) {
  throw new Error('examples/blog/.vitepress/dist is missing: run pnpm build first')
}

const page = (file: string) => readFileSync(resolve(dist, file), 'utf8')
const css = existsSync(themeCss) ? readFileSync(themeCss, 'utf8') : ''

describe('home page', () => {
  const html = page('index.html')

  it('lists excerpts and a Read more link', () => {
    expect(html).toContain('vuemo-excerpt')
    expect(html).toContain('Read more')
    expect(html).toContain(`href="${base}posts/markdown-features"`)
  })

  it('keeps archive lists to title and date', () => {
    for (const file of ['archives.html', 'tags.html', 'category.html']) {
      expect(page(file), file).not.toContain('vuemo-excerpt')
      expect(page(file), file).not.toContain('Read more')
    }
  })
})

describe('footer', () => {
  it('renders the message and the copyright', () => {
    const html = page('index.html')
    expect(html).toMatch(/vuemo-footer-message[^>]*>Powered by <a href="https:\/\/vitepress.dev">VitePress<\/a> · Vuemo/)
    expect(html).toMatch(/vuemo-footer-copyright[^>]*>Copyright © 2025 Vuemo Blog/)
  })
})

describe('taxonomy links', () => {
  const html = page('posts/hello-vuemo.html')

  it('links the tags and the category of a post to their pages', () => {
    expect(html).toContain(`href="${base}tags?tag=vuemo"`)
    expect(html).toContain(`href="${base}category?category=Notes"`)
  })

  it('has the tag and category pages', () => {
    expect(page('tags.html')).toMatch(/<h1[^>]*>Tags<\/h1>/)
    expect(page('category.html')).toMatch(/<h1[^>]*>Category<\/h1>/)
    expect(readFileSync(resolve(root, 'tags.md'), 'utf8')).toContain('layout: tag')
    expect(readFileSync(resolve(root, 'category.md'), 'utf8')).toContain('layout: category')
  })
})

describe('markdown features', () => {
  const html = page('posts/markdown-features.html')

  it('renders VitePress markdown extensions and the Badge component', () => {
    expect(html).toContain('custom-block github-alert')
    expect(html).toContain('vp-code-group')
    expect(html).toContain('vuemo-badge')
  })

  it('renders line numbers when markdown.lineNumbers is on', () => {
    expect(html).toContain('line-numbers-wrapper')
  })

  it('serves the post under the configured base', () => {
    expect(html).toContain(`href="${base}assets/`)
  })
})

describe('dark mode toggle', () => {
  it('renders both icons so the markup does not depend on isDark', () => {
    const html = page('index.html')
    expect(html).toContain('<span class="dark:hidden">🌙</span>')
    expect(html).toContain('<span class="hidden dark:inline">☀️</span>')
  })
})

describe('theme css', () => {
  it('was built', () => {
    expect(css.length, 'run pnpm build first').toBeGreaterThan(0)
  })

  it('styles the markdown selectors', () => {
    for (const selector of [
      '.custom-block',
      '.github-alert',
      '.vp-code-group',
      '.diff',
      '.has-focused-lines',
      '.header-anchor',
      '.vuemo-badge'
    ]) {
      expect(css, selector).toContain(selector)
    }
  })

  it('does not hide the line number gutter', () => {
    expect(css).not.toMatch(/line-numbers-wrapper\s*\{\s*display\s*:\s*none/)
  })

  it('defines every --color-* variable it uses', () => {
    const used = new Set([...css.matchAll(/var\(--(color-[\w-]+)/g)].map((m) => m[1]))
    for (const name of used) {
      expect(css, `--${name} is used but never defined`).toMatch(new RegExp(`--${name}\\s*:`))
    }
  })
})

describe('search', () => {
  // the theme owns minisearch: load the index with the very same copy the browser uses
  const require = createRequire(resolve(root, '../../themes/default/package.json'))
  const loaded = require('minisearch')
  const MiniSearch = loaded.default ?? loaded

  const chunks = resolve(dist, 'assets/chunks')
  const file = readdirSync(chunks).find((f) => /^@localSearchIndexroot\..+\.js$/.test(f))

  it('ships the index chunk', () => {
    expect(file).toBeTruthy()
  })

  const options = { fields: ['title', 'titles', 'text'], storeFields: ['title', 'titles'] }
  const load = async () => {
    // the chunk is `export default "<serialized MiniSearch index>"`
    const json: string = (await import(/* @vite-ignore */ pathToFileURL(resolve(chunks, file!)).href)).default
    return { json, index: MiniSearch.loadJSON(json, options) }
  }

  it('finds text that comes before the first heading', async () => {
    const { index } = await load()
    const hits = index.search('zebrafish', { fuzzy: 0.2, prefix: true })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].id).toBe(`${base}posts/second-post#second-post`)
    expect(hits[0].title).toBe('Second post')
  })

  it('prefixes every document id with the base', async () => {
    const { json } = await load()
    const ids: string[] = Object.values(JSON.parse(json).documentIds)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(id.startsWith(base), id).toBe(true)
  })

  it('does not index the listing pages', async () => {
    const { json } = await load()
    const ids: string[] = Object.values(JSON.parse(json).documentIds)
    for (const path of ['', 'archives', 'tags', 'category']) {
      expect(ids.some((id) => id === `${base}${path}` || id.startsWith(`${base}${path}#`)), path).toBe(false)
    }
    expect(ids.some((id) => id.startsWith(`${base}posts/hello-vuemo`))).toBe(true)
  })

  it('renders the search button on the server', () => {
    for (const f of ['index.html', 'posts/hello-vuemo.html', 'about.html']) {
      expect(page(f), f).toContain('aria-haspopup="dialog"')
    }
  })
})
