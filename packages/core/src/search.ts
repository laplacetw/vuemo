import type { DefaultTheme, MarkdownRenderer } from 'vitepress'

/**
 * The local search options for `search`: Vuemo's `_render`, results with the matching text (`detailedView`), CJK
 * tokenizing and results that match every word of the query. The user's options win; `miniSearch.options` and
 * `miniSearch.searchOptions` are merged key by key, so setting one MiniSearch option keeps the others.
 */
export function searchOptions(user: DefaultTheme.LocalSearchOptions): DefaultTheme.LocalSearchOptions {
  return {
    _render: searchRender,
    detailedView: true,
    ...user,
    miniSearch: {
      ...user.miniSearch,
      options: { tokenize: searchTokenize, ...user.miniSearch?.options },
      searchOptions: { combineWith: 'AND', ...user.miniSearch?.searchOptions }
    }
  }
}

/** Layouts that list posts instead of holding content; indexing them would only duplicate the posts. */
const UNINDEXED_LAYOUTS = ['home', 'archive', 'tag', 'category']

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ESCAPES[c])

/**
 * MiniSearch `tokenize` for the local search, used for the index and for queries. Like MiniSearch's default it splits
 * on spaces and punctuation; a run of Chinese, Japanese or Korean characters, which has no spaces between words, then
 * becomes overlapping pairs (一卡通 → 一卡, 卡通), so a word in the middle of a sentence is found.
 * VitePress serializes it into the site data with `toString()`: it must not use anything outside its own body.
 */
export function searchTokenize(text: string): string[] {
  const cjk = /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+)/u
  const tokens: string[] = []
  for (const word of text.split(/[\n\r\p{Z}\p{P}]+/u)) {
    // the capturing group keeps the CJK runs in the result, at odd indices
    word.split(cjk).forEach((part, i) => {
      if (!part) return
      if (i % 2 === 0) return void tokens.push(part)
      const chars = Array.from(part)
      if (chars.length === 1) tokens.push(part)
      for (let j = 0; j < chars.length - 1; j++) tokens.push(chars[j] + chars[j + 1])
    })
  }
  return tokens
}

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
