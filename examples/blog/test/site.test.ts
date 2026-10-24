import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
