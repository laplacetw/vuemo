import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { VuemoPlugin } from '../plugin'
import { runAssertions, type CheckResult, type PageHtml } from './assert'
import { FIXTURE_DIR, FIXTURE_PAGES, writeFixture } from './fixture'
import { staticChecks, type PackageJsonLike } from './static'
import { isExplicitThemePath, probeEntry, requireThemeSource } from '../theme-source'

export type { CheckResult } from './assert'

export interface CheckOptions {
  /** Anything `theme` accepts in `defineBlogConfig`, resolved from `cwd`: a path, a folder in `themes/`, a short name, a package name. Default: the package in `cwd`. */
  theme?: string
  /** Where the fixture is written and the theme is resolved from. Default: `process.cwd()`. */
  cwd?: string
  /** Keep the fixture (`<cwd>/.vuemo-check`) after the check. */
  keep?: boolean
}

/** The probe components live next to the sources: `src/check/probes` (from dist/ they are one level up). */
function probe(file: string): string {
  const local = new URL(`./probes/${file}`, import.meta.url)
  return fileURLToPath(existsSync(local) ? local : new URL(`../src/check/probes/${file}`, import.meta.url))
}

/** A plugin that fills the three standard slots with marker elements and registers `<VuemoCheckEnhance />`. */
export function probePlugin(): VuemoPlugin {
  return {
    name: 'vuemo:check-probes',
    slots: {
      'post-before-content': probe('Before.vue'),
      'post-after-content': probe('After.vue'),
      'post-comments': probe('Comments.vue')
    },
    enhanceApp: probe('enhance.ts')
  }
}

/** An absolute path to the theme entry file. Without `theme`, the package in `cwd` itself is the theme. */
function resolveTheme(theme: string | undefined, cwd: string): string {
  if (!theme) {
    const entry = probeEntry(cwd)
    if (!entry) throw new Error(`no theme given and ${cwd} has no theme entry (package.json exports["."] / main, index.ts or src/index.ts)`)
    return entry
  }
  // a file that exists relative to cwd is a path even without `./` (`src/index.ts`)
  const asPath = resolve(cwd, theme)
  if (!isExplicitThemePath(theme) && existsSync(asPath) && statSync(asPath).isFile()) return asPath
  return requireThemeSource(theme, cwd).entry
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'test', 'tests', 'example', 'examples'])

function readSources(dir: string, out: Record<string, string> = {}): Record<string, string> {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue
    const file = join(dir, name)
    if (statSync(file).isDirectory()) readSources(file, out)
    else if (/\.(test|spec)\./.test(name)) continue
    else if (['.ts', '.js', '.mjs', '.vue', '.css'].includes(extname(name))) out[file] = readFileSync(file, 'utf8')
  }
  return out
}

/** The nearest package.json; for a local theme inside the project it never looks above the project (`cwd`). */
function nearestPackageJson(dir: string, cwd: string): PackageJsonLike | undefined {
  const rel = relative(cwd, dir)
  const local = !rel.startsWith('..') && !isAbsolute(rel) && !rel.split(sep).includes('node_modules')
  for (let d = dir; ; d = dirname(d)) {
    const file = join(d, 'package.json')
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
    if ((local && d === cwd) || dirname(d) === d) return undefined
  }
}

const firstLines = (e: unknown) => String((e as Error)?.message ?? e).split('\n').slice(0, 6).join('\n')

/** Builds a fixture blog with the theme and checks the theme contract against the HTML. */
export async function checkTheme(options: CheckOptions = {}): Promise<{ results: CheckResult[]; ok: boolean }> {
  const cwd = resolve(options.cwd ?? process.cwd())
  const results: CheckResult[] = []
  const finish = () => ({ results, ok: !results.some((r) => r.status === 'fail') })

  let entry: string
  try {
    entry = resolveTheme(options.theme, cwd)
  } catch (e) {
    results.push({ id: 'theme', status: 'fail', message: firstLines(e) })
    return finish()
  }

  const root = join(cwd, FIXTURE_DIR)
  try {
    await writeFixture(root, entry)
    // imported here so `vuemo new` does not load VitePress
    const { build } = await import('vitepress')
    await build(root)
    const dist = join(root, '.vitepress/dist')
    const pages = {} as PageHtml
    for (const [key, file] of Object.entries(FIXTURE_PAGES)) {
      pages[key as keyof PageHtml] = await readFile(join(dist, file), 'utf8').catch(() => '')
    }
    results.push(...runAssertions(pages))
  } catch (e) {
    results.push({ id: 'build', status: 'fail', message: `the fixture blog failed to build with this theme:\n${firstLines(e)}` })
  } finally {
    if (!options.keep) await rm(root, { recursive: true, force: true })
  }

  const sources = readSources(dirname(entry))
  results.push(...staticChecks(nearestPackageJson(dirname(entry), cwd), sources))
  return finish()
}
