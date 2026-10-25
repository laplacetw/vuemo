import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { scaffoldBlog, scaffoldTheme } from '../src/scaffold'

const templates = (name: string) => fileURLToPath(new URL(`../${name}`, import.meta.url))
const tmp = () => mkdtempSync(join(tmpdir(), 'create-vuemo-'))

function files(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n)
    return statSync(f).isDirectory() ? files(f, base) : [f.slice(base.length + 1)]
  })
}

describe('theme starter template', () => {
  const target = join(tmp(), 'my-theme')
  scaffoldTheme(templates('template-theme'), target, '@me/vuemo-theme-x')

  it('contains every file of the starter', () => {
    for (const f of [
      'package.json',
      'README.md',
      '.gitignore',
      'src/index.ts',
      'src/Layout.vue',
      'src/style.css',
      'src/types.ts',
      'src/env.d.ts',
      'src/components/PluginSlot.vue',
      ...['Home', 'Post', 'Archive', 'Tag', 'Category', 'Page'].map((n) => `src/layouts/${n}.vue`),
      'example/.vitepress/config.ts',
      'example/.vitepress/theme/index.ts',
      ...['index', 'archives', 'tags', 'category', 'about'].map((n) => `example/${n}.md`),
      'test/contract.test.ts'
    ]) {
      expect(existsSync(join(target, f)), f).toBe(true)
    }
    expect(files(join(target, 'example/posts')).length).toBe(2)
  })
  it('restores .gitignore and writes the package name into package.json and README', () => {
    expect(existsSync(join(target, '_gitignore'))).toBe(false)
    expect(readFileSync(join(target, '.gitignore'), 'utf8')).toContain('.vuemo-check')
    expect(JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')).name).toBe('@me/vuemo-theme-x')
    const readme = readFileSync(join(target, 'README.md'), 'utf8')
    expect(readme).toContain("theme: '@me/vuemo-theme-x'")
    expect(readme).not.toContain('__NAME__')
  })
  it('keeps the contract points in the source', () => {
    const src = (f: string) => readFileSync(join(target, f), 'utf8')
    expect(src('src/layouts/Post.vue')).toContain('vuemo-content')
    for (const slot of ['post-before-content', 'post-after-content', 'post-comments']) {
      expect(src('src/layouts/Post.vue')).toContain(`<PluginSlot name="${slot}" />`)
    }
    expect(src('src/index.ts')).toContain('runEnhanceApps(ctx)')
  })
})

describe('blog template', () => {
  it('restores .gitignore and writes package.json and config', () => {
    const target = join(tmp(), 'blog')
    scaffoldBlog(templates('template'), target, { name: 'blog', title: 'T', comments: 'none', aiSummary: false })
    expect(existsSync(join(target, '.gitignore'))).toBe(true)
    expect(existsSync(join(target, '_gitignore'))).toBe(false)
    expect(readFileSync(join(target, '.vitepress/config.ts'), 'utf8')).toContain("title: 'T'")
    expect(JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')).name).toBe('blog')
  })
})
