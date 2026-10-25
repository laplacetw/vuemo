import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { VuemoPlugin } from '../plugin'
import { runAssertions, type CheckResult, type PageHtml } from './assert'
import { FIXTURE_DIR, FIXTURE_PAGES, writeFixture } from './fixture'
import { staticChecks, type PackageJsonLike } from './static'

export type { CheckResult } from './assert'

export interface CheckOptions {
  /** Path to the theme entry, or a package name resolvable from `cwd`. Default: the `exports['.']` / `main` of `cwd`'s package.json. */
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

function entryOf(pkgDir: string): string {
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  const dot = pkg.exports?.['.'] ?? pkg.exports
  const pick = (v: unknown): string | undefined =>
    typeof v === 'string' ? v : v && typeof v === 'object' ? pick((v as any).default ?? (v as any).import) : undefined
  const entry = pick(dot) ?? pkg.main
  if (!entry) throw new Error(`no theme given and ${join(pkgDir, 'package.json')} has neither exports["."] nor main`)
  return resolve(pkgDir, entry)
}

/** An absolute path to the theme entry file. */
function resolveTheme(theme: string | undefined, cwd: string): string {
  if (!theme) return entryOf(cwd)
  const asPath = resolve(cwd, theme)
  if ((theme.startsWith('.') || isAbsolute(theme)) || existsSync(asPath)) {
    if (!existsSync(asPath)) throw new Error(`theme entry ${asPath} does not exist`)
    return asPath
  }
  try {
    return createRequire(join(cwd, 'package.json')).resolve(theme)
  } catch {
    throw new Error(`theme "${theme}" is neither a file nor a package resolvable from ${cwd}`)
  }
}

function readSources(dir: string, out: Record<string, string> = {}): Record<string, string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const file = join(dir, name)
    if (statSync(file).isDirectory()) readSources(file, out)
    else if (['.ts', '.js', '.mjs', '.vue', '.css'].includes(extname(name))) out[file] = readFileSync(file, 'utf8')
  }
  return out
}

function nearestPackageJson(dir: string): PackageJsonLike | undefined {
  for (let d = dir; ; d = dirname(d)) {
    const file = join(d, 'package.json')
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
    if (dirname(d) === d) return undefined
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
  results.push(...staticChecks(nearestPackageJson(dirname(entry)), sources))
  return finish()
}
