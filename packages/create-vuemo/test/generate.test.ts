import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, VERSIONS, configTs, hasThemePrefix, themeTarget, themeInstall, packageJson, parseThemeSpec, quote, themePackageJson, validName, validPackageName } from '../src/generate'

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
    expect(validName('MyBlog')).toBe(false)
    expect(validName('@s/blog')).toBe(false)
    expect(validName('.hidden')).toBe(false)
    expect(validName('a'.repeat(215))).toBe(false)
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
    expect(parseThemeSpec('x@>=1.0.0 <2.0.0')).toEqual({ name: 'x', range: '>=1.0.0 <2.0.0' })
    expect(parseThemeSpec('  x@^1  ')).toEqual({ name: 'x', range: '^1' })
    expect(parseThemeSpec('@scope/x@2.0.0-alpha.1')).toEqual({ name: '@scope/x', range: '2.0.0-alpha.1' })
  })
  it('trims a theme spec in the generated files', () => {
    const deps = (a: Parameters<typeof packageJson>[0]) => JSON.parse(packageJson(a)).dependencies
    expect(deps({ ...base, theme: ' vuemo-theme-y@^1.0.0 ' })['vuemo-theme-y']).toBe('^1.0.0')
    expect(deps({ ...base, theme: ` ${DEFAULT_THEME} ` })[DEFAULT_THEME]).toBe(VERSIONS.theme)
  })
  it('rejects invalid package names and empty ranges', () => {
    for (const spec of ['', 'Upper', '@scope', '@scope/', 'a b', '../x', '/abs', '_x', '.x', 'x@', '@scope/x@', 'x@\u00001', 'x@1\n2', 'http://x/y']) {
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
    expect(configTs(base)).toContain("  // theme\n  // to switch: npm install vuemo-theme-<name> (or unzip a theme into themes/), then change this name\n  theme: '@vuemo/theme-default',\n  postsPerPage: 5,")
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
    expect(cfg).toContain("  theme: 'vuemo-theme-y',\n  postsPerPage: 5,")
    expect(cfg).not.toContain('@vuemo/theme-default')
  })
})

describe('short theme names', () => {
  const base = { name: 'b', title: 'B', comments: 'none', aiSummary: false } as const
  const deps = (theme: string) => JSON.parse(packageJson({ ...base, theme })).dependencies
  it('parses a short name with and without a range', () => {
    expect(parseThemeSpec('trigger')).toEqual({ name: 'trigger', range: 'latest' })
    expect(parseThemeSpec('trigger@^2')).toEqual({ name: 'trigger', range: '^2' })
  })
  it('installs vuemo-theme-<name> and writes the short name', () => {
    expect(deps('trigger')['vuemo-theme-trigger']).toBe('latest')
    expect(deps('trigger@^2')['vuemo-theme-trigger']).toBe('^2')
    expect(deps('trigger')).not.toHaveProperty('trigger')
    expect(deps('trigger')).not.toHaveProperty('@vuemo/theme-default')
    expect(configTs({ ...base, theme: 'trigger@^2' })).toContain("  theme: 'trigger',\n  postsPerPage: 5,")
  })
  it('keeps full and scoped names as written', () => {
    expect(deps('vuemo-theme-trigger@^2')['vuemo-theme-trigger']).toBe('^2')
    expect(configTs({ ...base, theme: 'vuemo-theme-trigger' })).toContain("  theme: 'vuemo-theme-trigger',")
    expect(deps('@scope/trigger')['@scope/trigger']).toBe('latest')
    expect(configTs({ ...base, theme: '@scope/trigger' })).toContain("  theme: '@scope/trigger',")
    expect(deps('@vuemo/theme-default')['@vuemo/theme-default']).toBe(VERSIONS.theme)
  })
  it('rejects an invalid short name', () => {
    expect(() => parseThemeSpec('Trigger')).toThrow()
    expect(() => parseThemeSpec('a/b')).toThrow()
  })
})

describe('themePackageJson', () => {
  const pkg = JSON.parse(themePackageJson({ name: '@me/vuemo-theme-x' }))
  it('is a publishable theme package', () => {
    expect(pkg).toMatchObject({
      name: '@me/vuemo-theme-x',
      version: '0.0.0',
      type: 'module',
      exports: { '.': './src/index.ts' },
      files: ['src', 'dist'],
      keywords: ['vuemo-theme']
    })
    expect(Object.keys(pkg.scripts)).toEqual(['dev', 'build:example', 'check', 'package', 'test'])
    expect(pkg.scripts.check).toBe('vuemo check-theme ./src/index.ts')
    expect(pkg.scripts.package).toBe('node scripts/package.mjs')
  })
  it('has core, vitepress and vue as peers (and dev dependencies), never as dependencies', () => {
    expect(pkg.peerDependencies).toEqual({ '@vuemo/core': VERSIONS.core, vitepress: '^1.6.0', vue: '^3.5.0' })
    expect(pkg.devDependencies).toMatchObject(pkg.peerDependencies)
    expect(pkg.devDependencies).toHaveProperty('vitest')
    expect(pkg.dependencies).toBeUndefined()
  })
  it('suggests the vuemo-theme- prefix', () => {
    expect(hasThemePrefix('vuemo-theme-x')).toBe(true)
    expect(hasThemePrefix('@me/vuemo-theme-x')).toBe(true)
    expect(hasThemePrefix('my-theme')).toBe(false)
    expect(hasThemePrefix('vuemo-theme-')).toBe(false)
    expect(validPackageName('@me/vuemo-theme-x')).toBe(true)
    expect(validPackageName('My Theme')).toBe(false)
  })
})

describe('themeTarget', () => {
  it('takes a package name or a path', () => {
    expect(themeTarget('vuemo-theme-x')).toEqual({ name: 'vuemo-theme-x', dir: 'vuemo-theme-x' })
    expect(themeTarget('@me/vuemo-theme-x')).toEqual({ name: '@me/vuemo-theme-x', dir: 'vuemo-theme-x' })
    expect(themeTarget('./themes/vuemo-theme-x/')).toEqual({ name: 'vuemo-theme-x', dir: './themes/vuemo-theme-x' })
    expect(themeTarget('/abs/dir/vuemo-theme-x')).toEqual({ name: 'vuemo-theme-x', dir: '/abs/dir/vuemo-theme-x' })
    expect(validPackageName(themeTarget('./Bad Name').name)).toBe(false)
  })
})

describe('default alias and the install notice', () => {
  const deps = (a: Parameters<typeof packageJson>[0]) => JSON.parse(packageJson(a)).dependencies
  it('`default` is @vuemo/theme-default, with its own version unless a range is given', () => {
    expect(parseThemeSpec('default')).toEqual({ name: DEFAULT_THEME, range: 'latest' })
    expect(parseThemeSpec('default@^1')).toEqual({ name: DEFAULT_THEME, range: '^1' })
    expect(deps({ ...base, theme: 'default' })).not.toHaveProperty('vuemo-theme-default')
    expect(deps({ ...base, theme: 'default' })[DEFAULT_THEME]).toBe(VERSIONS.theme)
    expect(packageJson({ ...base, theme: 'default' })).toBe(packageJson(base))
    expect(configTs({ ...base, theme: 'default' })).toBe(configTs(base))
    expect(deps({ ...base, theme: 'default@^1' })[DEFAULT_THEME]).toBe('^1')
  })
  it('themeInstall names the package a short name installs, and nothing otherwise', () => {
    expect(themeInstall('trigger')).toEqual({ name: 'trigger', pkg: 'vuemo-theme-trigger' })
    expect(themeInstall('trigger@^2')).toEqual({ name: 'trigger', pkg: 'vuemo-theme-trigger' })
    for (const spec of [undefined, '', 'default', 'vuemo-theme-x', '@s/n', DEFAULT_THEME]) expect(themeInstall(spec), String(spec)).toBeUndefined()
  })
  it('the config explains how to switch themes, also with another theme', () => {
    const comment = '  // to switch: npm install vuemo-theme-<name> (or unzip a theme into themes/), then change this name\n'
    expect(configTs({ ...base, theme: 'trigger' })).toContain(`  // theme\n${comment}  theme: 'trigger',\n`)
    expect(configTs({ ...base, theme: '@s/vuemo-theme-x' })).toContain(comment)
  })
})
