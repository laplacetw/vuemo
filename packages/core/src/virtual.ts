import { isAbsolute, join } from 'node:path'
import { STANDARD_SLOTS, type VuemoPlugin } from './plugin'

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
}

export const themeResolveError = (theme: string, root: string) =>
  isAbsolute(theme)
    ? `[vuemo] theme file "${theme}" does not exist. Fix the path in the \`theme\` option.`
    : `[vuemo] theme "${theme}" could not be resolved from ${root}. Install it (npm i ${theme} / pnpm add ${theme}) or fix the \`theme\` option.`

export const themeShapeError = (theme: string) =>
  `[vuemo] theme "${theme}" does not default-export a VitePress theme ({ Layout, enhanceApp })`

/**
 * Source of the theme module. `theme` is what the user wrote (used in messages); `id` is what it resolved to.
 * The module throws when the default export is not a theme: it needs a `Layout`, directly or through `extends`.
 */
export function buildThemeModule(theme: string, id: string = theme): string {
  return `import theme from ${JSON.stringify(id)}
let t = theme
for (let i = 0; i < 10 && t && typeof t === 'object' && !t.Layout; i++) t = t.extends
if (!t || typeof t !== 'object' || !t.Layout) throw new Error(${JSON.stringify(themeShapeError(theme))})
export default theme
`
}

/** Resolves `theme` like an import written in the user's project would be, and builds the theme module. */
export async function loadThemeModule(ctx: ThemeResolver, theme: string, root: string): Promise<string> {
  const resolved = await ctx.resolve(theme, join(root, 'index.html'))
  if (!resolved) ctx.error(themeResolveError(theme, root))
  return buildThemeModule(theme, resolved!.id)
}

export function virtualPlugin(plugins: VuemoPlugin[], theme: string) {
  const prefix = '\0'
  let root = process.cwd()
  return {
    name: 'vuemo:virtual',
    configResolved(config: { root: string }) {
      root = config.root
    },
    resolveId: (id: string) => (id === VIRTUAL_ID || id === THEME_ID ? prefix + id : undefined),
    async load(this: ThemeResolver, id: string) {
      if (id === prefix + VIRTUAL_ID) return buildVirtualModule(plugins)
      if (id === prefix + THEME_ID) return loadThemeModule(this, theme, root)
    }
  }
}
