import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { VuemoPlugin } from './plugin'

/**
 * Settings of official features, keyed by feature name (`comments`, `aiSummary`).
 * Each official plugin package adds its own key by augmenting this interface.
 */
export interface OfficialFeatures {}

export const OFFICIAL_FEATURES: Record<string, string> = {
  comments: '@vuemo/plugin-comments',
  aiSummary: '@vuemo/plugin-ai-summary'
}

type PluginFactory = (options: any) => VuemoPlugin
export type Importer = (pkg: string) => Promise<{ default: PluginFactory }>

const isNotFound = (e: any) => e?.code === 'ERR_MODULE_NOT_FOUND' || e?.code === 'MODULE_NOT_FOUND'

/** Plugins are optional peers of core, so import them from the user's project. */
const importFromProject: Importer = async (pkg) => {
  try {
    return await import(pkg)
  } catch (e) {
    if (!isNotFound(e)) throw e
    const resolved = createRequire(join(process.cwd(), 'noop.js')).resolve(pkg)
    return import(pathToFileURL(resolved).href)
  }
}

/** Turns enabled features (`comments: {...}`) into plugins. `false` / missing means disabled. */
export async function loadFeatures(config: Record<string, unknown>, importer: Importer = importFromProject): Promise<VuemoPlugin[]> {
  const plugins: VuemoPlugin[] = []
  for (const [key, pkg] of Object.entries(OFFICIAL_FEATURES)) {
    const options = config[key]
    if (!options) continue
    let mod
    try {
      mod = await importer(pkg)
    } catch (e) {
      if (!isNotFound(e)) throw e
      throw new Error(`[vuemo] "${key}" is enabled but ${pkg} is not installed. Run: pnpm add ${pkg}`)
    }
    plugins.push(mod.default(options === true ? {} : options))
  }
  return plugins
}
