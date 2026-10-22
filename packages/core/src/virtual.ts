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

export function buildThemeModule(theme: string): string {
  return `export { default } from ${JSON.stringify(theme)}\n`
}

export function virtualPlugin(plugins: VuemoPlugin[], theme: string) {
  const prefix = '\0'
  return {
    name: 'vuemo:virtual',
    resolveId: (id: string) => (id === VIRTUAL_ID || id === THEME_ID ? prefix + id : undefined),
    load(id: string) {
      if (id === prefix + VIRTUAL_ID) return buildVirtualModule(plugins)
      if (id === prefix + THEME_ID) return buildThemeModule(theme)
    }
  }
}
