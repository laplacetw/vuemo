import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isExplicitThemePath, probeEntry, requireThemeSource, resolveThemeSource } from '../src/theme-source'

const project = () => mkdtempSync(join(tmpdir(), 'vuemo-ts-'))
/** Writes files (relative paths with `/`) under `root`. */
const put = (root: string, files: Record<string, string>) => {
  for (const [name, body] of Object.entries(files)) {
    const file = join(root, ...name.split('/'))
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, body)
  }
  return root
}
const pkg = (o: object) => JSON.stringify(o)
const ok = (theme: string, root: string) => {
  const r = resolveThemeSource(theme, root)
  if (!r.ok) throw new Error(r.error)
  return r
}
const bad = (theme: string, root: string) => {
  const r = resolveThemeSource(theme, root)
  if (r.ok) throw new Error(`expected a failure, got ${r.entry}`)
  return r
}

describe('probeEntry', () => {
  it('reads exports["."] with nested conditions, preferring import and skipping types', () => {
    const d = put(project(), {
      'package.json': pkg({ exports: { '.': { types: './t.d.ts', import: { types: './x.d.ts', default: './lib/a.mjs' }, default: './lib/b.js' } } }),
      'lib/a.mjs': '',
      'lib/b.js': ''
    })
    expect(probeEntry(d)).toBe(join(d, 'lib', 'a.mjs'))
  })
  it('accepts exports as a string or a bare conditions object', () => {
    expect(probeEntry(put(project(), { 'package.json': pkg({ exports: './e.js' }), 'e.js': '' }))).toMatch(/e\.js$/)
    expect(probeEntry(put(project(), { 'package.json': pkg({ exports: { default: './e.js' } }), 'e.js': '' }))).toMatch(/e\.js$/)
  })
  it('falls back to main, then index.*, then src/index.*', () => {
    expect(probeEntry(put(project(), { 'package.json': pkg({ main: 'm.js' }), 'm.js': '', 'index.ts': '' }))).toMatch(/m\.js$/)
    expect(probeEntry(put(project(), { 'index.mjs': '', 'src/index.ts': '' }))).toMatch(/index\.mjs$/)
    expect(probeEntry(put(project(), { 'src/index.ts': '' }))).toMatch(/src[\\/]index\.ts$/)
  })
  it('skips a declared entry that does not exist (an unbuilt dist) and keeps probing', () => {
    const d = put(project(), { 'package.json': pkg({ exports: './dist/index.js' }), 'src/index.ts': '' })
    const tried: string[] = []
    expect(probeEntry(d, tried)).toBe(join(d, 'src', 'index.ts'))
    expect(tried[0]).toBe(join(d, 'dist', 'index.js'))
  })
  it('survives a broken package.json', () => {
    const d = put(project(), { 'package.json': '{ nope', 'index.js': '' })
    expect(probeEntry(d)).toBe(join(d, 'index.js'))
  })
  it('returns undefined when there is nothing', () => {
    expect(probeEntry(project())).toBeUndefined()
  })
})

describe('resolveThemeSource: paths', () => {
  it('takes a file, relative or absolute', () => {
    const root = put(project(), { 'my/theme.ts': '' })
    expect(ok('./my/theme.ts', root)).toMatchObject({ kind: 'path', entry: join(root, 'my', 'theme.ts') })
    expect(ok(join(root, 'my', 'theme.ts'), root)).toMatchObject({ kind: 'path', entry: join(root, 'my', 'theme.ts') })
  })
  it('probes a folder for its entry', () => {
    const root = put(project(), { 'my/package.json': pkg({ main: './m.js' }), 'my/m.js': '' })
    expect(ok('./my', root)).toMatchObject({ kind: 'path', entry: join(root, 'my', 'm.js') })
  })
  it('allows ../ only as an explicit path, resolved from root', () => {
    const base = put(project(), { 'shared/theme/index.ts': '', 'blog/.keep': '' })
    expect(ok('../shared/theme', join(base, 'blog'))).toMatchObject({ kind: 'path', entry: join(base, 'shared', 'theme', 'index.ts') })
    expect(ok('.', join(base, 'shared', 'theme'))).toMatchObject({ kind: 'path' })
  })
  it('reports a missing path with the place it looked', () => {
    const root = project()
    const r = bad('./nope.ts', root)
    expect(r.error).toContain('theme path "./nope.ts" does not exist')
    expect(r.error).toContain(resolve(root, 'nope.ts'))
    expect(r.tried).toEqual([resolve(root, 'nope.ts')])
  })
  it('reports a folder without an entry', () => {
    const root = put(project(), { 'x/README.md': '' })
    expect(bad('./x', root).error).toContain('has no entry file')
  })
  it('never treats a path-like name as a package or a themes/ folder', () => {
    const root = put(project(), { 'themes/a/b/index.ts': '' })
    for (const name of ['a/b', 'a\\b', '@s/n/x', 'a/../b', 'themes/../x', '@s/../x']) {
      expect(bad(name, root).error, name).toContain('is not a valid theme name')
    }
  })
  it('rejects an empty name', () => {
    expect(bad('  ', project()).error).toContain('`theme` is empty')
  })
})

describe('resolveThemeSource: order', () => {
  it('prefers themes/<name>/ over installed packages', () => {
    const root = put(project(), {
      'themes/trigger/index.ts': '',
      'node_modules/vuemo-theme-trigger/index.ts': '',
      'node_modules/trigger/index.ts': ''
    })
    expect(ok('trigger', root)).toMatchObject({ kind: 'local', entry: join(root, 'themes', 'trigger', 'index.ts') })
  })
  it('prefers vuemo-theme-<name> over a package named <name>', () => {
    const root = put(project(), { 'node_modules/vuemo-theme-trigger/index.ts': '', 'node_modules/trigger/index.ts': '' })
    expect(ok('trigger', root)).toMatchObject({ kind: 'package', packageName: 'vuemo-theme-trigger' })
  })
  it('falls back to a package named exactly <name> only when package.json lists it', () => {
    const files = { 'node_modules/trigger/index.ts': '' }
    expect(bad('trigger', put(project(), files)).error).toContain('was not found')
    expect(bad('trigger', put(project(), { ...files, 'package.json': pkg({ dependencies: { other: '1' } }) })).error).toContain('was not found')
    for (const field of ['dependencies', 'devDependencies']) {
      const listed = put(project(), { ...files, 'package.json': pkg({ [field]: { trigger: '^1' } }) })
      expect(ok('trigger', listed)).toMatchObject({ packageName: 'trigger' })
    }
    const root = put(project(), { ...files, 'package.json': pkg({ dependencies: { trigger: '^1' } }) })
    expect(ok('trigger', root)).toMatchObject({ kind: 'package', packageName: 'trigger', entry: join(root, 'node_modules', 'trigger', 'index.ts') })
  })
  it('does not add the prefix to full or scoped names', () => {
    const root = put(project(), {
      'node_modules/vuemo-theme-x/src/index.ts': '',
      'node_modules/@vuemo/theme-default/package.json': pkg({ exports: { '.': './src/index.ts' } }),
      'node_modules/@vuemo/theme-default/src/index.ts': ''
    })
    const full = ok('vuemo-theme-x', root)
    expect(full.packageName).toBe('vuemo-theme-x')
    expect(full.tried.some((t) => t.includes('vuemo-theme-vuemo-theme-x'))).toBe(false)
    const scoped = ok('@vuemo/theme-default', root)
    expect(scoped).toMatchObject({ kind: 'package', packageName: '@vuemo/theme-default' })
    expect(scoped.tried.some((t) => t.includes(`vuemo-theme-@`))).toBe(false)
  })
  it('does not look in node_modules above the project root', () => {
    const base = put(project(), { 'node_modules/vuemo-theme-up/index.js': '', 'apps/blog/.keep': '' })
    const r = bad('up', join(base, 'apps', 'blog'))
    expect(r.tried.every((t) => t.startsWith(join(base, 'apps', 'blog')))).toBe(true)
    expect(ok('up', base).kind).toBe('package')
  })
  it('aliases default to @vuemo/theme-default, but a themes/default/ folder wins', () => {
    const files = { 'node_modules/@vuemo/theme-default/index.ts': '', 'node_modules/vuemo-theme-default/index.ts': '' }
    expect(ok('default', put(project(), files))).toMatchObject({ kind: 'package', packageName: '@vuemo/theme-default' })
    expect(ok('default', put(project(), { ...files, 'themes/default/index.ts': '' })).kind).toBe('local')
  })
  it('a themes/ folder is not looked at for scoped names', () => {
    const root = put(project(), { 'themes/@s/n/index.ts': '', 'node_modules/@s/n/index.ts': '' })
    expect(ok('@s/n', root).kind).toBe('package')
  })
  it('a package without an entry says so instead of moving on', () => {
    const root = put(project(), { 'node_modules/vuemo-theme-empty/README.md': '' })
    const r = bad('empty', root)
    expect(r.error).toContain('"vuemo-theme-empty" is installed')
    expect(r.error).toContain('has no theme entry')
  })
})

describe('resolveThemeSource: themes/ folders', () => {
  it('probes the folder with the entry rules', () => {
    const root = put(project(), { 'themes/t/package.json': pkg({ exports: { '.': { import: './src/index.ts' } } }), 'themes/t/src/index.ts': '' })
    expect(ok('t', root).entry).toBe(join(root, 'themes', 't', 'src', 'index.ts'))
  })
  it('goes one level down into a single subfolder when the folder has no entry', () => {
    const root = put(project(), { 'themes/trigger/trigger/package.json': pkg({ main: 'src/index.ts' }), 'themes/trigger/trigger/src/index.ts': '' })
    const r = ok('trigger', root)
    expect(r).toMatchObject({ kind: 'local', entry: join(root, 'themes', 'trigger', 'trigger', 'src', 'index.ts') })
  })
  it('ignores __MACOSX, dot folders and loose files when counting subfolders', () => {
    const root = put(project(), { 'themes/t/__MACOSX/x': '', 'themes/t/.git/x': '', 'themes/t/README.md': '', 'themes/t/inner/index.ts': '' })
    expect(ok('t', root).entry).toBe(join(root, 'themes', 't', 'inner', 'index.ts'))
  })
  it('does not guess among several subfolders, nor look two levels down', () => {
    const several = put(project(), { 'themes/t/a/index.ts': '', 'themes/t/b/index.ts': '' })
    expect(bad('t', several).error).toContain('themes/t/ exists but holds no theme entry')
    const deep = put(project(), { 'themes/t/a/b/index.ts': '' })
    expect(bad('t', deep).error).toContain('exists but holds no theme entry')
  })
  it('does not fall through to a package when the folder exists but is empty', () => {
    const root = put(project(), { 'themes/t/README.md': '', 'node_modules/vuemo-theme-t/index.ts': '' })
    expect(bad('t', root).error).toContain('exists but holds no theme entry')
  })
  it('prefers its own entry over a single subfolder', () => {
    const root = put(project(), { 'themes/t/index.ts': '', 'themes/t/docs/index.ts': '' })
    expect(ok('t', root).entry).toBe(join(root, 'themes', 't', 'index.ts'))
  })
})

describe('resolveThemeSource: not found', () => {
  it('lists what was tried and how to fix it', () => {
    const root = project()
    const r = bad('trigger', root)
    expect(r.error).toContain('[vuemo] theme "trigger" was not found. Looked in:')
    expect(r.error).toContain(join(root, 'themes', 'trigger'))
    expect(r.error).toContain(join(root, 'node_modules', 'vuemo-theme-trigger'))
    expect(r.error).not.toContain(join(root, 'node_modules', 'trigger'))
    expect(r.error).toContain('check the package name')
    expect(r.error).toContain('not GitHub\'s "Source code (zip)"')
    expect(r.error).toContain('npm install vuemo-theme-trigger')
    expect(r.error).toContain('unzip it into themes/trigger/')
    expect(r.error).toContain('one more folder level')
    expect(r.error).toContain('correct the name')
    expect(r.tried.length).toBe(2)
  })
  it('suggests the scoped name as written and the short name for a prefixed one', () => {
    const root = project()
    expect(bad('@s/theme', root).error).toContain('npm install @s/theme')
    const full = bad('vuemo-theme-trigger', root).error
    expect(full).toContain('npm install vuemo-theme-trigger')
    expect(full).toContain('themes/trigger/')
  })
  it('lists the existing folders of themes/', () => {
    const root = put(project(), { 'themes/alpha/index.ts': '', 'themes/beta/index.ts': '', 'themes/.hidden/x': '', 'themes/README.md': '' })
    expect(bad('gamma', root).error).toContain('Folders in themes/: alpha, beta.')
    expect(bad('gamma', project()).error).not.toContain('Folders in themes/')
  })
  it('requireThemeSource throws the same message', () => {
    const root = project()
    expect(() => requireThemeSource('nope', root)).toThrow('theme "nope" was not found')
  })
})

describe('separators', () => {
  it('builds every path with the platform separator', () => {
    const root = put(project(), { 'themes/t/index.ts': '' })
    const r = ok('t', root)
    expect(r.entry.split(sep).slice(-3)).toEqual(['themes', 't', 'index.ts'])
    expect(r.tried[0].startsWith(join(root, 'themes'))).toBe(true)
  })
  it('treats a backslash name as not a name and a Windows-style relative path as a path only with a leading dot', () => {
    const root = put(project(), { 'my/theme.ts': '' })
    expect(bad('my\\theme.ts', root).error).toContain('not a valid theme name')
    expect(isExplicitThemePath('.\\my\\theme.ts')).toBe(true)
  })
})

describe('resolveThemeSource: names', () => {
  const root = project()
  it.each(['x?raw', 'a:b', '@../x', '../x/y/..', 'a b', 'a\\b', 'a/b', '@s/n/x', '.hidden', 'x#y', 'a%2fb'])('rejects %s', (name) => {
    const r = resolveThemeSource(name, root)
    expect(r.ok).toBe(false)
  })
  it('says why for a name that is not a path and not a name', () => {
    expect(bad('x?raw', root).error).toContain('not a valid theme name')
    expect(bad('.hidden', root).error).toContain('not a valid theme name')
    expect(bad('a:b', root).error).toContain('not a valid theme name')
  })
  it('treats only ./, ../, . , .. and absolute paths as paths', () => {
    for (const p of ['.', '..', './x', '../x', '.\\x', '..\\x', resolve('/x')]) expect(isExplicitThemePath(p), p).toBe(true)
    for (const p of ['.hidden', '..x', 'x']) expect(isExplicitThemePath(p), p).toBe(false)
  })
  it('accepts capitals in a themes/ folder name but not in a package name', () => {
    const r = put(project(), { 'themes/MyTheme/index.ts': '', 'node_modules/vuemo-theme-mytheme/index.ts': '' })
    expect(ok('MyTheme', r)).toMatchObject({ kind: 'local', entry: join(r, 'themes', 'MyTheme', 'index.ts') })
    // no package lookup for a name with capitals
    const none = bad('Other', project())
    expect(none.tried.some((t) => t.includes('node_modules'))).toBe(false)
  })
  it('accepts a symlinked themes/<name>', () => {
    const base = put(project(), { 'real/index.ts': '' })
    mkdirSync(join(base, 'themes'))
    symlinkSync(join(base, 'real'), join(base, 'themes', 'linked'), 'dir')
    expect(ok('linked', base)).toMatchObject({ kind: 'local' })
    expect(bad('gamma', base).error).toContain('Folders in themes/: linked.')
  })
  it('warns about a folder that differs only in case, and still uses it', () => {
    const r = put(project(), { 'themes/Trigger/index.ts': '' })
    const found = ok('trigger', r)
    expect(found.kind).toBe('local')
    expect(found.entry).toBe(join(r, 'themes', 'Trigger', 'index.ts'))
    expect(found.warnings?.[0]).toContain('themes/Trigger/')
    expect(ok('Trigger', r).warnings).toBeUndefined()
  })
  it('lists a themes/ folder with a trailing separator', () => {
    expect(bad('zzz', project()).tried[0].endsWith(sep)).toBe(true)
  })
})
