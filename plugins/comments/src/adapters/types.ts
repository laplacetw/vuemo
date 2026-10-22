export interface GiscusOptions {
  repo: string
  repoId: string
  category: string
  categoryId: string
  /** How a post maps to a discussion. Default: `pathname`. */
  mapping?: string
  lang?: string
  /** Giscus theme names. Defaults: `light` / `dark`. */
  light?: string
  dark?: string
}

export interface UtterancesOptions {
  repo: string
  /** Default: `title`. */
  issueTerm?: string
  /** Utterances theme names. Defaults: `github-light` / `github-dark`. */
  light?: string
  dark?: string
}

export type CommentsConfig = ({ provider: 'giscus' } & GiscusOptions) | ({ provider: 'utterances' } & UtterancesOptions)

/** Every provider implements this; Comments.vue drives it from page changes and `isDark`. */
export interface CommentsAdapter {
  mount(el: HTMLElement, isDark: boolean): void
  unmount(el: HTMLElement): void
  setTheme(isDark: boolean): void
}
