import type { MarkdownRenderer } from 'vitepress'

/** Layouts that list posts instead of holding content; indexing them would only duplicate the posts. */
const UNINDEXED_LAYOUTS = ['home', 'archive', 'tag', 'category']

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ESCAPES[c])

/**
 * `_render` for VitePress's local search. VitePress drops the text before the first heading, and posts have
 * no `#` heading (the title is frontmatter), so the title is prepended as one. It is built by hand with an empty
 * anchor: VitePress then indexes it under the plain page id, which cannot clash with a body heading of the same
 * text (a rendered heading would get the same slug as that heading and MiniSearch would reject the duplicate id).
 * Pages that should not be
 * searchable (`search: false`, or a listing layout) render to an empty string.
 */
export function searchRender(src: string, env: Record<string, any>, md: Pick<MarkdownRenderer, 'render'>): string {
  const html = md.render(src, env)
  const fm = env.frontmatter ?? {}
  if (fm.search === false || UNINDEXED_LAYOUTS.includes(fm.layout)) return ''
  return typeof fm.title === 'string' && fm.title ? `<h1>${escapeHtml(fm.title)}<a class="header-anchor" href="#"></a></h1>` + html : html
}
