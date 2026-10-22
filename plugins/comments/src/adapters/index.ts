import { giscus } from './giscus'
import { utterances } from './utterances'
import type { CommentsAdapter, CommentsConfig } from './types'

export function createAdapter(config: CommentsConfig): CommentsAdapter {
  switch (config.provider) {
    case 'giscus':
      return giscus(config)
    case 'utterances':
      return utterances(config)
    default:
      throw new Error(`[vuemo] unknown comments provider: ${(config as any).provider}`)
  }
}
