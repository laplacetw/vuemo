import { fileURLToPath } from 'node:url'
import type { VuemoPlugin } from '@vuemo/core'
import type { CommentsConfig } from './adapters/types'

export type { CommentsConfig, GiscusOptions, UtterancesOptions } from './adapters/types'

export default function comments(config: CommentsConfig): VuemoPlugin {
  return {
    name: '@vuemo/plugin-comments',
    vite: { define: { __VUEMO_COMMENTS__: JSON.stringify(config) } },
    slots: { 'post-comments': fileURLToPath(new URL('../src/Comments.vue', import.meta.url)) }
  }
}

declare module '@vuemo/core' {
  interface OfficialFeatures {
    /** Comments below each post. Remove or set to `false` to disable. */
    comments?: CommentsConfig | false
  }
}
