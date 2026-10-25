import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, VERSIONS, configTs, packageJson, parseThemeSpec, quote, validName } from '../src/generate'

const base = { name: 'b', title: 'My "Blog"', comments: 'none', aiSummary: false } as const

describe('generate', () => {
  it('writes every setting into one config and always installs the official plugins', () => {
    const off = configTs(base)
    expect(off).toContain('comments: false')
    expect(off).toContain('aiSummary: false')
    expect(Object.keys(JSON.parse(packageJson(base)).dependencies)).toEqual(
      expect.arrayContaining(['@vuemo/plugin-comments', '@vuemo/plugin-ai-summary'])
    )
  })
  it('references the plugin types so the feature keys type-check in the user config', () => {
    const cfg = configTs(base)
    expect(cfg.startsWith('/// <reference types="@vuemo/plugin-comments" />\n/// <reference types="@vuemo/plugin-ai-summary" />\n')).toBe(true)
  })
  it('turns math and search on and installs the math plugin', () => {
    const cfg = configTs(base)
    expect(cfg).toContain('math: true')
    expect(cfg).toContain('search: true')
    const deps = JSON.parse(packageJson(base)).dependencies
    expect(deps).toHaveProperty('markdown-it-mathjax3')
  })
  it('turns on the chosen features', () => {
    const on = configTs({ ...base, comments: 'giscus', aiSummary: true })
    expect(on).toContain("provider: 'giscus'")
    expect(on).toContain("api: 'https://YOUR-WORKER.workers.dev'")
    expect(configTs({ ...base, comments: 'utterances' })).toContain("comments: { provider: 'utterances'")
  })
  it('escapes the title and validates names', () => {
    expect(configTs(base)).toContain(`title: 'My "Blog"',`)
    expect(configTs({ ...base, title: "Tom's \\ blog" })).toContain("title: 'Tom\\'s \\\\ blog',")
    expect(validName('my-blog')).toBe(true)
    expect(validName('../x')).toBe(false)
  })
})

describe('quote', () => {
  it('writes a single-quoted literal that evaluates back to the text', () => {
    for (const text of ['plain', 'My "Blog"', "it's", 'back\\slash', 'a\nb\r\nc', 'x\u2028y\u2029z', "'\\'"]) {
      expect(quote(text)).toMatch(/^'/)
      expect(new Function(`return ${quote(text)}`)()).toBe(text)
    }
  })
})

describe('parseThemeSpec', () => {
  it('splits a version or range at the last @ after index 0', () => {
    expect(parseThemeSpec('vuemo-theme-x')).toEqual({ name: 'vuemo-theme-x', range: 'latest' })
    expect(parseThemeSpec('vuemo-theme-x@latest')).toEqual({ name: 'vuemo-theme-x', range: 'latest' })
    expect(parseThemeSpec('vuemo-theme-x@^1.0.0')).toEqual({ name: 'vuemo-theme-x', range: '^1.0.0' })
    expect(parseThemeSpec('@scope/vuemo-theme-x')).toEqual({ name: '@scope/vuemo-theme-x', range: 'latest' })
    expect(parseThemeSpec('@scope/vuemo-theme-x@^1.2.0')).toEqual({ name: '@scope/vuemo-theme-x', range: '^1.2.0' })
    expect(parseThemeSpec('@scope/x@2.0.0-alpha.1')).toEqual({ name: '@scope/x', range: '2.0.0-alpha.1' })
  })
  it('rejects invalid package names and empty ranges', () => {
    for (const spec of ['', 'Upper', '@scope', '@scope/', 'a b', '../x', '/abs', '_x', '.x', 'x@', '@scope/x@', 'x@1 2', 'http://x/y']) {
      expect(() => parseThemeSpec(spec), spec).toThrow()
    }
    expect(() => parseThemeSpec('a'.repeat(215))).toThrow()
  })
})

describe('theme option', () => {
  const deps = (a: Parameters<typeof packageJson>[0]) => JSON.parse(packageJson(a)).dependencies
  it('keeps the default output when no theme or the default theme is chosen', () => {
    expect(deps(base)['@vuemo/theme-default']).toBe(VERSIONS.theme)
    expect(packageJson({ ...base, theme: DEFAULT_THEME })).toBe(packageJson(base))
    expect(configTs({ ...base, theme: DEFAULT_THEME })).toBe(configTs(base))
    expect(configTs(base)).toContain("  // theme\n  theme: '@vuemo/theme-default',\n  postsPerPage: 5,")
  })
  it('replaces the default theme dependency with the chosen theme', () => {
    const d = deps({ ...base, theme: '@scope/vuemo-theme-x@^1.2.0' })
    expect(d).not.toHaveProperty('@vuemo/theme-default')
    expect(d['@scope/vuemo-theme-x']).toBe('^1.2.0')
    expect(Object.keys(d)[1]).toBe('@scope/vuemo-theme-x')
    expect(d['@vuemo/core']).toBe(VERSIONS.core)
    expect(deps({ ...base, theme: 'vuemo-theme-y' })['vuemo-theme-y']).toBe('latest')
  })
  it('writes an explicit theme line only for another theme', () => {
    const cfg = configTs({ ...base, theme: 'vuemo-theme-y@^1.0.0' })
    expect(cfg).toContain("  // theme\n  theme: 'vuemo-theme-y',\n  postsPerPage: 5,")
    expect(cfg).not.toContain('@vuemo/theme-default')
  })
})
