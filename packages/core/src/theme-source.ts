import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

/** Short names (`trigger`) are installed as `vuemo-theme-trigger`. */
export const THEME_PREFIX = 'vuemo-theme-'

export type ThemeSourceKind = 'path' | 'local' | 'package'

export type ThemeSource =
  | {
      ok: true
      kind: ThemeSourceKind
      /** Absolute path of the theme entry file. */
      entry: string
      /** Every place that was looked at, in order (for messages and tests). */
      tried: string[]
      /** `package` only: the installed package's name (`vuemo-theme-trigger` for `theme: 'trigger'`). */
      packageName?: string
    }
  | { ok: false; error: string; tried: string[] }

const ENTRY_NAMES = ['index.ts', 'index.mts', 'index.js', 'index.mjs']
const isFile = (p: string) => existsSync(p) && statSync(p).isFile()
const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory()

/** `exports["."]` (or `exports` itself when it is a string / a conditions object): `import` and `default` first, never `types` or `require`. */
function pickExport(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>
  for (const key of ['import', 'default', ...Object.keys(o).filter((k) => !['import', 'default', 'types', 'require'].includes(k))]) {
    const found = pickExport(o[key])
    if (found) return found
  }
  return undefined
}

/**
 * The entry file of a theme folder or package folder. Order: `package.json` `exports["."]`, `main`,
 * then `index.{ts,mts,js,mjs}`, then `src/index.*`. A declared file that does not exist (an unbuilt `dist/`) is
 * skipped and the probing goes on. Every candidate is added to `tried`.
 */
export function probeEntry(dir: string, tried: string[] = []): string | undefined {
  const candidates: string[] = []
  const pkgFile = join(dir, 'package.json')
  if (isFile(pkgFile)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
      const exp = pkg.exports
      const isMap = exp && typeof exp === 'object' && !Array.isArray(exp)
      // `exports` is a subpath map ({ ".": ... }), or the entry / a conditions object itself
      const dot = isMap && Object.keys(exp).some((k) => k.startsWith('.')) ? exp['.'] : exp
      for (const declared of [pickExport(dot), typeof pkg.main === 'string' ? pkg.main : undefined]) if (declared) candidates.push(resolve(dir, declared))
    } catch {
      tried.push(`${pkgFile} (not valid JSON)`)
    }
  }
  for (const name of ENTRY_NAMES) candidates.push(join(dir, name))
  for (const name of ENTRY_NAMES) candidates.push(join(dir, 'src', name))
  for (const c of candidates) {
    tried.push(c)
    if (isFile(c)) return c
  }
  return undefined
}

/** Explicit path forms: `./x`, `../x`, `.`, `..` and absolute paths (POSIX or Windows drive/UNC). Everything else is a name. */
export const isExplicitThemePath = (theme: string) => theme.startsWith('.') || isAbsolute(theme)

const hasDotSegment = (theme: string) => theme.split(/[\\/]/).some((s) => s === '..' || s === '.')

/** `name` or `@scope/name`. */
const isPackageName = (theme: string) => /^(?:@[^/\\\s]+\/)?[^/\\@\s.][^/\\\s]*$/.test(theme)

const fix = (theme: string) => {
  const short = theme.startsWith(THEME_PREFIX) ? theme.slice(THEME_PREFIX.length) : theme
  return [
    'To fix it, do one of:',
    `  - install the theme: npm install ${theme.startsWith('@') || theme.startsWith(THEME_PREFIX) ? theme : THEME_PREFIX + theme}`,
    `  - download the theme and unzip it into themes/${short}/ (the theme's package.json or index.ts must sit directly inside that folder; if the zip added one more folder level, move its contents up)`,
    '  - correct the name in `theme` (vuemo.config.ts)'
  ].join('\n')
}

const list = (tried: string[]) => tried.map((t) => `  - ${t}`).join('\n')

const fail = (error: string, tried: string[]): ThemeSource => ({ ok: false, error, tried })

/** The theme folders of a project are `themes/<name>/`; a zip that wrapped its folder once more gets one level looked into. */
function localEntry(dir: string, tried: string[]): string | undefined {
  const direct = probeEntry(dir, tried)
  if (direct) return direct
  const subs = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== '__MACOSX' && d.name !== 'node_modules')
  if (subs.length === 1) return probeEntry(join(dir, subs[0].name), tried)
  return undefined
}

/** Walks `node_modules` from `root` upwards, like Node does, looking for `name`. */
function findPackageDir(name: string, root: string, tried: string[]): string | undefined {
  for (let d = resolve(root); ; d = dirname(d)) {
    const dir = join(d, 'node_modules', name)
    tried.push(dir)
    if (isDir(dir)) return dir
    if (dirname(d) === d) return undefined
  }
}

/**
 * Where does `theme` (what the user wrote in `defineBlogConfig`) come from? Only the file system is read.
 *
 * 1. A path: `./x`, `../x`, `.`, `..` or an absolute path; a file is the entry, a folder is probed for one.
 * 2. `<root>/themes/<theme>/` (a folder that holds exactly one subfolder and no entry itself uses the subfolder).
 * 3. The installed package `vuemo-theme-<theme>` (short names only).
 * 4. The installed package `<theme>` itself (`name` or `@scope/name`).
 *
 * Anything else with a `/` (`a/b`, `@s/n/x`) or a `..` segment is rejected: a path must start with `.` or be absolute.
 */
export function resolveThemeSource(theme: string, root: string): ThemeSource {
  const tried: string[] = []
  if (typeof theme !== 'string' || !theme.trim()) return fail('[vuemo] `theme` is empty. Use a theme name such as \'trigger\', or remove the option for the default theme.', tried)

  if (isExplicitThemePath(theme)) {
    const target = resolve(root, theme)
    tried.push(target)
    if (!existsSync(target)) return fail(`[vuemo] theme path "${theme}" does not exist (looked for ${target}). Fix the path in the \`theme\` option.`, tried)
    if (isFile(target)) return { ok: true, kind: 'path', entry: target, tried }
    const entry = probeEntry(target, tried)
    if (entry) return { ok: true, kind: 'path', entry, tried }
    return fail(`[vuemo] theme folder "${theme}" has no entry file. Looked for:\n${list(tried)}\nPoint \`theme\` at the entry file, or add \`exports["."]\` / \`main\` to its package.json, or an index.ts.`, tried)
  }

  if (hasDotSegment(theme) || !isPackageName(theme)) {
    return fail(
      `[vuemo] "${theme}" is not a valid theme name. Use a short name ('trigger'), a package name ('vuemo-theme-trigger', '@scope/name'), ` +
        `or a path that starts with './', '../' or is absolute ('./my-themes/x/src/index.ts').`,
      tried
    )
  }

  // 2. themes/<name>/
  if (!theme.startsWith('@')) {
    const dir = join(root, 'themes', theme)
    tried.push(dir + '/')
    if (isDir(dir)) {
      const entry = localEntry(dir, tried)
      if (entry) return { ok: true, kind: 'local', entry, tried }
      return fail(
        `[vuemo] the folder themes/${theme}/ exists but holds no theme entry. Looked for:\n${list(tried)}\n` +
          `Put the theme's files directly in themes/${theme}/ (package.json or index.ts at its top level). A zip often adds one more folder level: ` +
          `move its contents up so that themes/${theme}/package.json exists.`,
        tried
      )
    }
  }

  // 3./4. installed packages
  const names = [...(!theme.startsWith('@') && !theme.startsWith(THEME_PREFIX) ? [THEME_PREFIX + theme] : []), theme]
  for (const name of names) {
    const dir = findPackageDir(name, root, tried)
    if (!dir) continue
    const entry = probeEntry(dir, tried)
    if (entry) return { ok: true, kind: 'package', entry, tried, packageName: name }
    return fail(`[vuemo] the package "${name}" is installed (${dir}) but has no theme entry. Looked for:\n${list(tried)}\nReinstall it, or ask its author for an entry (exports["."], main, or index.ts).`, tried)
  }

  return fail(`[vuemo] theme "${theme}" was not found. Looked in:\n${list(tried)}\n${fix(theme)}`, tried)
}

/** `resolveThemeSource` for callers that just want the source or an `Error`. */
export function requireThemeSource(theme: string, root: string): Extract<ThemeSource, { ok: true }> {
  const r = resolveThemeSource(theme, root)
  if (!r.ok) throw new Error(r.error)
  return r
}
