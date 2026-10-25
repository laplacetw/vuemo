/** Static contract warnings from the theme's package.json and sources. Pure: callers read the files. */
import type { CheckResult } from './assert'

export interface PackageJsonLike {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export function checkPeerDeps(pkg: PackageJsonLike | undefined): CheckResult {
  const id = 'peer-deps'
  if (!pkg) return { id, status: 'warn', message: 'no package.json found next to the theme; it should list @vuemo/core and vitepress in peerDependencies' }
  const peers = pkg.peerDependencies ?? {}
  const missing = ['@vuemo/core', 'vitepress'].filter((n) => !(n in peers))
  if (missing.length) return { id, status: 'warn', message: `list ${missing.join(' and ')} in peerDependencies (the user's project provides them)` }
  if (pkg.dependencies && '@vuemo/core' in pkg.dependencies) {
    return { id, status: 'warn', message: '@vuemo/core must not be in dependencies; it is a peer dependency, otherwise the theme gets its own copy' }
  }
  return { id, status: 'pass', message: '@vuemo/core and vitepress are peer dependencies' }
}

const FS_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"](?:node:)?(?:fs|path|fs\/promises)['"]/

/** `sources`: file path → text, of the theme sources (the directory of the entry file). */
export function checkNoFs(sources: Record<string, string>): CheckResult {
  const id = 'no-fs'
  const offenders = Object.entries(sources)
    .filter(([, text]) => FS_IMPORT.test(text))
    .map(([file]) => file)
  return offenders.length
    ? { id, status: 'warn', message: `a theme must not touch the file system (node:fs, node:path); found in ${offenders.join(', ')}. Read data through @vuemo/core/client.` }
    : { id, status: 'pass', message: 'theme sources do not import node:fs or node:path' }
}

export function checkIsDark(sources: Record<string, string>): CheckResult {
  const id = 'is-dark'
  const text = Object.values(sources).join('\n')
  if (!/isDark|dark:|\.dark/.test(text)) {
    return { id, status: 'warn', message: 'no sign of dark mode support (isDark, dark: or .dark) in the theme sources; the theme must follow VitePress isDark' }
  }
  return { id, status: 'manual', message: 'verify that the theme follows VitePress isDark (toggle the appearance and check the theme and plugins follow)' }
}

export function staticChecks(pkg: PackageJsonLike | undefined, sources: Record<string, string>): CheckResult[] {
  return [checkPeerDeps(pkg), checkNoFs(sources), checkIsDark(sources)]
}
