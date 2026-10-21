import { fileURLToPath } from 'node:url'
import type { VuemoPlugin } from '@vuemo/core'

export interface AiSummaryOptions {
  /** URL of your Cloudflare Worker. */
  api: string
  /** Default: `🤖 AI Summary`. */
  buttonText?: string
}

export default function aiSummary(options: AiSummaryOptions): VuemoPlugin {
  if (!options?.api) throw new Error('[vuemo] plugin-ai-summary: "api" is required')
  const client = { api: options.api, buttonText: options.buttonText ?? '🤖 AI Summary' }
  return {
    name: '@vuemo/plugin-ai-summary',
    vite: { define: { __VUEMO_AI_SUMMARY__: JSON.stringify(client) } },
    slots: { 'post-before-content': fileURLToPath(new URL('../src/Summary.vue', import.meta.url)) }
  }
}
