/**
 * Theme-specific options go at the top level of `themeConfig` (set in `defineBlogConfig({ themeConfig: { ... } })`).
 * Do not reuse the names core owns: nav, footer, logo, socialLinks, postsPerPage, summary, paths, search, lastUpdated.
 */
export interface MyThemeConfig {
  /** Made-up example option: the label of the "read more" link on the home page. */
  readMoreText?: string
}
