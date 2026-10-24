import type { MarkdownRenderer } from 'vitepress'

/** Layouts that list posts instead of holding content; indexing them would only duplicate the posts. */
const UNINDEXED_LAYOUTS = ['home', 'archive', 'tag', 'category']

/**
 * `_render` for VitePress's local search. VitePress drops the text before the first heading, and posts have
 * no `#` heading (the title is frontmatter), so the title is prepended as one. Pages that should not be
 * searchable (`search: false`, or a listing layout) render to an empty string.
 */
export function searchRender(src: string, env: Record<string, any>, md: Pick<MarkdownRenderer, 'render'>): string {
  const html = md.render(src, env)
  const fm = env.frontmatter ?? {}
  if (fm.search === false || UNINDEXED_LAYOUTS.includes(fm.layout)) return ''
  return typeof fm.title === 'string' && fm.title ? md.render('# ' + fm.title) + html : html
}
