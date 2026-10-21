import { STANDARD_SLOTS, type VuemoPlugin } from './plugin'

export const VIRTUAL_ID = 'virtual:vuemo/plugins'

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

export function virtualPlugin(plugins: VuemoPlugin[]) {
  const resolved = '\0' + VIRTUAL_ID
  return {
    name: 'vuemo:plugins',
    resolveId: (id: string) => (id === VIRTUAL_ID ? resolved : undefined),
    load: (id: string) => (id === resolved ? buildVirtualModule(plugins) : undefined)
  }
}
