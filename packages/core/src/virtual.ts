import { existsSync, watch } from 'node:fs'
import { join, sep } from 'node:path'
import { STANDARD_SLOTS, type VuemoPlugin } from './plugin'
import { DEFAULT_THEME_NAME, THEME_PREFIX, isExplicitThemePath, resolveThemeSource, type ThemeSource } from './theme-source'

export const VIRTUAL_ID = 'virtual:vuemo/plugins'
export const THEME_ID = 'virtual:vuemo/theme'

/** Source of the module that themes read through `useSlots` / `runEnhanceApps`. */
export function buildVirtualModule(plugins: VuemoPlugin[]): string {
  const imports: string[] = []
  const slots: Record<string, string[]> = Object.fromEntries(STANDARD_SLOTS.map((s) => [s, []]))
  const enhance: string[] = []
  const path = (p: string) => JSON.stringify(p.replace(/\\/g, '/'))

  plugins.forEach((plugin, i) => {
    for (const [slot, file] of Object.entries(plugin.slots ?? {})) {
      if (!file) continue
      if (!(slot in slots)) {
        console.warn(`[vuemo] plugin "${plugin.name}" uses unknown slot "${slot}"; ignored`)
        continue
      }
      imports.push(`import s${i}_${slots[slot].length}_${slot.replace(/-/g, '_')} from ${path(file)}`)
      slots[slot].push(`s${i}_${slots[slot].length}_${slot.replace(/-/g, '_')}`)
    }
    if (plugin.enhanceApp) {
      imports.push(`import e${i} from ${path(plugin.enhanceApp)}`)
      enhance.push(`e${i}`)
    }
  })

  const slotEntries = Object.entries(slots).map(([k, v]) => `${JSON.stringify(k)}: [${v.join(', ')}]`)
  return `${imports.join('\n')}
export const slots = { ${slotEntries.join(', ')} }
export const enhanceApps = [${enhance.join(', ')}]
`
}

/** What a theme is resolved with: just the two members of the plugin context that are needed (testable). */
export interface ThemeResolver {
  resolve(id: string, importer?: string): Promise<{ id: string } | null | undefined>
  error(message: string): never
  warn?(message: string): void
}

/** Module ids use `/` on every platform (a Windows path in `import` is also a string escape hazard for other tools). */
const moduleId = (id: string) => id.replace(/\\/g, '/')

export const themeShapeError = (theme: string, entry?: string) =>
  `[vuemo] theme "${theme}"${entry && entry !== theme ? ` (${entry})` : ''} does not default-export a VitePress theme ({ Layout, enhanceApp })`

/**
 * Source of the theme module. `theme` is what the user wrote (used in messages); `id` is what it resolved to.
 * The module throws when the default export is not a theme: it needs a `Layout`, directly or through `extends`.
 */
export function buildThemeModule(theme: string, id: string = theme): string {
  return `import theme from ${JSON.stringify(moduleId(id))}
let t = theme
for (let i = 0; i < 10 && t && typeof t === 'object' && !t.Layout; i++) t = t.extends
if (!t || typeof t !== 'object' || !t.Layout) throw new Error(${JSON.stringify(themeShapeError(theme, moduleId(id)))})
export default theme
`
}

/**
 * Resolves `theme` (see `resolveThemeSource`) and builds the theme module. A path or a folder in `themes/` is imported by its
 * absolute entry; an installed package is resolved like an import written in the user's project would be, so the bundler's
 * own resolution (symlinks, dedupe) applies, with the package file we found as the fallback.
 */
export async function loadThemeModule(ctx: ThemeResolver, theme: string, root: string, source: typeof resolveThemeSource = resolveThemeSource): Promise<string> {
  const found = source(theme, root)
  if (!found.ok) ctx.error(found.error)
  const s = found as Extract<ThemeSource, { ok: true }>
  for (const w of s.warnings ?? []) (ctx.warn ?? console.warn)(w)
  if (s.kind !== 'package') return buildThemeModule(theme, s.entry)
  const resolved = await ctx.resolve(s.packageName ?? theme, join(root, 'index.html'))
  return buildThemeModule(theme, resolved?.id ?? s.entry)
}

/** The places whose appearance or disappearance changes what `theme` resolves to (never a path: its file is in the module graph). */
export function themeWatchPaths(theme: string, root: string): string[] {
  if (typeof theme !== 'string' || isExplicitThemePath(theme) || !/^[A-Za-z0-9._~-]+$/.test(theme) && !theme.startsWith('@')) return []
  const modules = join(root, 'node_modules')
  const pkgs = theme === 'default' ? [DEFAULT_THEME_NAME] : theme.startsWith('@') || theme.startsWith(THEME_PREFIX) ? [theme] : [THEME_PREFIX + theme, theme]
  return [...(theme.startsWith('@') ? [] : [join(root, 'themes', theme)]), ...pkgs.map((p) => join(modules, p))]
}

/** What `theme` currently resolves to, as one comparable string (`none` when it does not resolve). */
export function themeSignature(theme: string, root: string, source: typeof resolveThemeSource = resolveThemeSource): string {
  const r = source(theme, root)
  return r.ok ? `${r.kind}:${r.entry}` : 'none'
}

const inside = (file: string, dir: string) => file === dir || file.startsWith(dir + sep) || file.startsWith(dir + '/')

/** Whether a changed `file` can change which theme is used: something at, above (`themes/`, `node_modules/`) or in a watched place. */
export function touchesTheme(file: string, targets: string[]): boolean {
  return targets.some((t) => inside(file, t) || inside(t, file))
}

interface DevServerLike {
  watcher: { add(paths: string[]): unknown; on(event: string, listener: (file: string) => void): unknown }
  moduleGraph: { getModuleById(id: string): unknown; invalidateModule(mod: any): void }
  ws: { send(payload: { type: 'full-reload' }): void }
  httpServer?: { once(event: 'close', listener: () => void): unknown } | null
}

export type WatchFn = typeof watch

export function virtualPlugin(plugins: VuemoPlugin[], theme: string, watchFn: WatchFn = watch) {
  const prefix = '\0'
  let root = process.cwd()
  let nodeModulesWatcher: ReturnType<WatchFn> | undefined
  return {
    name: 'vuemo:virtual',
    // Vite calls this when the dev server closes
    buildEnd() {
      nodeModulesWatcher?.close()
      nodeModulesWatcher = undefined
    },
    // VitePress's project root is `config.vitepress.root`; `config.root` is its srcDir (themes/ lives in the project root)
    configResolved(config: { root: string; vitepress?: { root?: string } }) {
      root = config.vitepress?.root ?? config.root
    },
    // in dev, a theme that appears (unzipped into themes/, npm installed) or disappears is picked up without a restart
    configureServer(server: DevServerLike) {
      const targets = themeWatchPaths(theme, root)
      if (!targets.length) return
      let last = themeSignature(theme, root)
      server.watcher.add(targets)
      const check = (file: string) => {
        if (typeof file !== 'string' || !touchesTheme(file, targets)) return
        const now = themeSignature(theme, root)
        if (now === last) return
        last = now
        const mod = server.moduleGraph.getModuleById(prefix + THEME_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      for (const event of ['add', 'addDir', 'unlink', 'unlinkDir']) server.watcher.on(event, check)
      // Vite's watcher ignores node_modules, so an `npm install` is watched directly (top level only; checked again a moment later,
      // because the package's files arrive after its folder)
      const modules = join(root, 'node_modules')
      if (existsSync(modules)) {
        try {
          const watcher = watchFn(modules, { persistent: false }, (_event, name) => {
            if (!name) return
            const file = join(modules, name.toString())
            if (!touchesTheme(file, targets)) return
            check(file)
            setTimeout(() => check(file), 1000).unref()
          })
          // do not leak the watcher when the dev server restarts (a config change) or stops
          server.httpServer?.once('close', () => watcher.close())
          nodeModulesWatcher?.close()
          nodeModulesWatcher = watcher
        } catch {
          // no file system watching here (some containers); the dev server then needs a restart for a new package
        }
      }
    },
    resolveId: (id: string) => (id === VIRTUAL_ID || id === THEME_ID ? prefix + id : undefined),
    async load(this: ThemeResolver, id: string) {
      if (id === prefix + VIRTUAL_ID) return buildVirtualModule(plugins)
      if (id === prefix + THEME_ID) return loadThemeModule(this, theme, root)
    }
  }
}
