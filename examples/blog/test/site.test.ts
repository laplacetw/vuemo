import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
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

// The posts the loader accepts (a title and a valid date), newest first, as the loader would normalize them.
// posts/bad-frontmatter.md has neither and is skipped with a warning.
const postsDir = resolve(root, 'posts')
const validPosts = readdirSync(postsDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(resolve(postsDir, f), 'utf8'))?.[1] ?? ''
    const title = /^title:\s*(.+)$/m.exec(fm)?.[1]?.trim()
    const raw = /^date:\s*(.+)$/m.exec(fm)?.[1]?.trim()
    const time = raw ? +new Date(raw) : NaN
    return { slug: f.replace(/\.md$/, ''), title, time, date: Number.isNaN(time) ? '' : new Date(time).toISOString().slice(0, 10) }
  })
  .filter((p) => p.title && p.date)
  .sort((a, b) => b.time - a.time)

// A check that cannot run here (no git history) must not pass silently: loud locally, a failure in CI.
function unavailable(reason: string) {
  const message = `[site test] skipped: ${reason}`
  if (process.env.CI) throw new Error(message)
  console.warn(message)
}

describe('home page', () => {
  const html = page('index.html')

  it('lists excerpts and a Read more link', () => {
    expect(html).toContain('vuemo-excerpt')
    expect(html).toContain('Read more')
    // the first page lists the newest posts (postsPerPage is 2 in the example config)
    for (const post of validPosts.slice(0, 2)) expect(html).toContain(`href="${base}posts/${post.slug}"`)
  })

  it('gives each Read more link the post title as an accessible name', () => {
    const links = [...html.matchAll(/Read more →<span class="sr-only">: ([^<]+)<\/span>/g)].map((m) => m[1])
    expect(links.length).toBeGreaterThan(0)
    for (const title of links) expect(validPosts.map((p) => p.title)).toContain(title)
    expect(css).toContain('.sr-only')
  })

  it('names the search modal close button', () => {
    const assets = resolve(dist, 'assets/chunks')
    const chunks = readdirSync(assets).filter((f) => f.endsWith('.js')).map((f) => readFileSync(resolve(assets, f), 'utf8'))
    expect(chunks.some((c) => c.includes('Close search'))).toBe(true)
  })

  it('keeps archive lists to title and date', () => {
    for (const file of ['archives.html', 'tags.html', 'category.html']) {
      expect(page(file), file).not.toContain('vuemo-excerpt')
      expect(page(file), file).not.toContain('Read more')
    }
  })
})

describe('sitemap', () => {
  it('lists every page under the origin plus the base', () => {
    const origin = 'https://example.com' + base.replace(/\/$/, '')
    const locs = [...page('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(locs.length).toBeGreaterThan(0)
    for (const loc of locs) expect(loc.startsWith(origin + '/'), loc).toBe(true)
    expect(locs).toContain(`${origin}/posts/hello-vuemo`)
    // the base is neither doubled nor missing
    for (const loc of locs) expect(loc.slice('https://'.length), loc).not.toContain('//')
  })
})

describe('layouts', () => {
  it('renders every built post with the post layout, without a layout in its frontmatter', () => {
    for (const p of validPosts) expect(page(`posts/${p.slug}.html`), p.slug).toContain('vuemo-content')
  })
  it('renders a page without a layout as a plain page', () => {
    expect(readFileSync(resolve(root, 'about.md'), 'utf8')).not.toMatch(/^layout:/m)
    expect(page('about.html')).not.toContain('vuemo-content')
  })
})

describe('footer', () => {
  it('renders the message and the copyright', () => {
    const html = page('index.html')
    expect(html).toMatch(/vuemo-footer-message[^>]*>Powered by <a href="https:\/\/vitepress.dev">VitePress<\/a> · <a href="https:\/\/github.com\/laplacetw\/vuemo">Vuemo<\/a>/)
    expect(html).toMatch(new RegExp(`vuemo-footer-copyright[^>]*>Copyright © ${new Date().getFullYear()} Vuemo Blog`))
  })
})

describe('archives', () => {
  const html = page('archives.html')
  const years: Record<string, number> = {}
  for (const p of validPosts) years[p.date.slice(0, 4)] = (years[p.date.slice(0, 4)] ?? 0) + 1

  it('shows the post count', () => {
    expect(validPosts.length).toBeGreaterThan(1)
    expect(html).toContain(`>${validPosts.length} posts<`)
  })

  it('has a heading with the right count for every year, and no other', () => {
    const headings = [...html.matchAll(/<h2[^>]*>\s*(\d{4})\s*<span[^>]*>\((\d+)\)<\/span>/g)].map((m) => [m[1], Number(m[2])])
    expect(Object.fromEntries(headings)).toEqual(years)
    expect(headings.length).toBe(Object.keys(years).length)
  })

  it('lists a compact MM-DD row for every post', () => {
    for (const p of validPosts) expect(html, p.slug).toMatch(new RegExp(`<time class="shrink-0 [^"]*" datetime="${p.date}">${p.date.slice(5)}</time>`))
  })
})

describe('previous and next links', () => {
  it('link to the neighbours of a post, under any base', () => {
    // valid posts are sorted newest first: the middle one has both neighbours
    const [newer, mid, older] = validPosts
    const html = page(`posts/${mid.slug}.html`)
    expect(html).toContain(`href="${base}posts/${newer.slug}"`)
    expect(html).toContain(`href="${base}posts/${older.slug}"`)
  })
})

describe('inline math', () => {
  it('keeps inline math inline despite the preflight svg { display: block }', () => {
    expect(page('posts/math.html')).toContain('<mjx-container class="MathJax" jax="SVG"')
    expect(css).toMatch(/\.prose mjx-container:not\(\[display=["']?true["']?\]\) svg\s*\{\s*display:\s*inline/)
  })
})

describe('last updated', () => {
  // git day (UTC) of a post's last commit, or undefined when git cannot tell (no checkout, untracked or edited file)
  const gitDay = (slug: string) => {
    try {
      const file = `posts/${slug}.md`
      const cwd = root
      if (execFileSync('git', ['status', '--porcelain', '--', file], { cwd, encoding: 'utf8' }).trim()) return undefined
      const out = execFileSync('git', ['log', '-1', '--format=%ct', '--', file], { cwd, encoding: 'utf8' }).trim()
      return out ? new Date(Number(out) * 1000).toISOString().slice(0, 10) : undefined
    } catch {
      return undefined
    }
  }
  const committed = validPosts.map((p) => ({ ...p, day: gitDay(p.slug) })).filter((p) => p.day)

  it('puts dateModified into the JSON-LD of a committed post', () => {
    if (!committed.length) return unavailable('no committed example post, so dateModified cannot be checked')
    const html = page(`posts/${committed[0].slug}.html`)
    const ld = /<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)
    expect(ld).toBeTruthy()
    const data = JSON.parse(ld![1])
    expect(Date.parse(data.dateModified)).toBeGreaterThanOrEqual(Date.parse(data.datePublished))
  })

  it('shows the Updated line exactly when the git day is after the publish day', () => {
    const later = committed.filter((p) => p.day! > p.date)
    if (!later.length) return unavailable('no committed post was updated after its publish date')
    for (const p of committed) {
      const html = page(`posts/${p.slug}.html`)
      if (p.day! > p.date) expect(html, p.slug).toMatch(new RegExp(`vuemo-updated[^>]*>· Updated ${p.day}<`))
      else expect(html, p.slug).not.toContain('vuemo-updated')
    }
  })

  it('never renders an invalid date, not even on the skipped post', () => {
    for (const f of ['posts/hello-vuemo.html', 'posts/second-post.html', 'posts/old-post.html', 'posts/bad-frontmatter.html']) {
      // visible text only: scripts carry serialized data
      const text = page(f).replace(/<script[\s\S]*?<\/script>/g, '')
      expect(text, f).not.toMatch(/\b(undefined|Invalid|NaN)\b/)
    }
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

describe('math', () => {
  it('renders inline and display formulas on the post page', () => {
    const html = page('posts/math.html')
    expect(html).toContain('<mjx-container')
    expect(html).toMatch(/<mjx-container[^>]*display="true"/)
  })

  it('renders the formula in the excerpt on the home page', () => {
    expect(page('index.html')).toMatch(/vuemo-excerpt[\s\S]*?<mjx-container/)
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
    // the title section has no anchor: its id is the page's own
    expect(hits[0].id).toBe(`${base}posts/second-post`)
    expect(hits[0].title).toBe('Second post')
  })

  it('indexes a post whose title equals one of its own headings, as two sections', async () => {
    // posts/second-post.md has `## Second post`: this used to fail the build with "duplicate ID"
    const { index } = await load()
    const title = index.search('zebrafish', { prefix: true })[0]
    const heading = index.search('narwhal', { prefix: true })[0]
    expect(title.id).toBe(`${base}posts/second-post`)
    expect(heading.id).toBe(`${base}posts/second-post#second-post`)
    expect(heading.titles).toEqual(['Second post'])
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
