import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// A real `vitepress build` of a small blog whose theme is a folder in `themes/` (unzipped, with its README.md):
// the theme must render, and nothing under themes/ may become a page. The project lives inside examples/blog
// so that @vuemo/core, vitepress and vue resolve from its node_modules.
const tmp = resolve(__dirname, '..', '.e2e-themes-dir')
const put = (name: string, body: string) => {
  const file = join(tmp, name)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, body)
}

const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]))

describe('a blog with a theme in themes/<name>/', () => {
  it('renders the theme and emits no page for themes/**', { timeout: 120_000 }, async () => {
    rmSync(tmp, { recursive: true, force: true })
    try {
      put('.vitepress/config.ts', "import { defineBlogConfig } from '@vuemo/core'\nexport default defineBlogConfig({ title: 'T', theme: 'mini', rss: false })\n")
      put('.vitepress/theme/index.ts', "export { default } from '@vuemo/core/theme'\n")
      put('themes/mini/index.ts', "import { h } from 'vue'\nexport default { Layout: () => h('main', { class: 'mini' }, 'MINI-THEME-OK') }\n")
      put('themes/mini/README.md', '# Mini theme README\n\nTHEME-README-MARKER\n')
      put('themes/mini/docs/guide.md', '# Guide inside the theme\n')
      put('index.md', '---\nlayout: home\n---\n')
      put('posts/a.md', '---\ntitle: A\ndate: 2024-01-01\n---\nBody\n')

      const { build } = await import('vitepress')
      await build(tmp)

      const dist = join(tmp, '.vitepress/dist')
      expect(readFileSync(join(dist, 'index.html'), 'utf8')).toContain('MINI-THEME-OK')
      expect(readFileSync(join(dist, 'posts/a.html'), 'utf8')).toContain('MINI-THEME-OK')
      expect(existsSync(join(dist, 'themes'))).toBe(false)
      const html = walk(dist).filter((f) => f.endsWith('.html')).map((f) => f.slice(dist.length))
      expect(html.some((f) => f.includes('themes'))).toBe(false)
      for (const f of walk(dist).filter((f) => /\.(html|js)$/.test(f))) expect(readFileSync(f, 'utf8'), f).not.toContain('THEME-README-MARKER')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
