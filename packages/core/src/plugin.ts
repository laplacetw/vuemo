import type { HeadConfig, MarkdownRenderer, UserConfig } from 'vitepress'
import type { Post } from './schema'

/** Standard slots every Vuemo theme provides in its `post` layout. */
export const STANDARD_SLOTS = ['post-before-content', 'post-after-content', 'post-comments'] as const
export type StandardSlot = (typeof STANDARD_SLOTS)[number]

export interface VuemoPlugin {
  name: string
  /** → markdown.config */
  markdown?: (md: MarkdownRenderer) => void
  /** → merged into the vite config. Use `define` to hand options to client components. */
  vite?: UserConfig['vite']
  /** → site `head` */
  head?: HeadConfig[]
  /** → posts data loader. Return a new post, or mutate and return nothing. */
  transformPost?: (post: Post) => Post | void
  /** Absolute path of a module whose default export is `(ctx: EnhanceAppContext) => void`. */
  enhanceApp?: string
  /** Standard slot name → absolute path of a Vue component to render there. */
  slots?: Partial<Record<StandardSlot, string>>
}
