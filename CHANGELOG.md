# Changelog

## Unreleased

### Features
- monorepo scaffold: `@vuemo/core`, `@vuemo/theme-default`, `examples/blog`
- `defineBlogConfig` has no `theme` option; themes are enabled with `.vitepress/theme/index.ts` (`export { default } from '@vuemo/theme-default'`), VitePress's native mechanism (superseded below: the `theme` option exists again, resolved through a virtual module, and the entry file is `export { default } from '@vuemo/core/theme'`)
- `VuemoPlugin` interface and `defineBlogConfig({ plugins })`: merges `markdown`, `vite`, `head`, `transformPost` (posts loader), `enhanceApp` and `slots`
- theme contract: `useSlots()` / `runEnhanceApps()` from `@vuemo/core/client`; post body must carry class `vuemo-content`
- `@vuemo/plugin-comments` (Giscus, Utterances) and `@vuemo/plugin-ai-summary`
- `create-vuemo`: scaffolds a blog with `posts/`, `public/`, config and theme entry; optional comments / AI summary plugins
- default theme: hide VitePress code block language label and copy button (superseded below: the language label and the copy button are shown and styled)
- `defineBlogConfig` is now async and the single place for settings: `theme` (resolved through a virtual module, entry file is `export { default } from '@vuemo/core/theme'`), flat `nav` / `footer` / `postsPerPage`, and official feature switches `comments` / `aiSummary` (no imports; `false` disables)
- `@vuemo/plugin-comments` config is flat: `{ provider, repo, ... }` instead of `{ provider, options }`
- `create-vuemo` always installs the official plugins and writes feature switches into the config
- docs: getting started, configuration, themes, plugins, deployment
- default theme: readable code blocks in light mode
- removed the `draft` frontmatter field: a post you don't want published should not be committed
- RSS: `defineBlogConfig` writes `feed.xml` at build time and links it from every page when `hostname` is set (`rss: false` disables it)
- site options `logo` and `socialLinks` (mapped into `themeConfig`); the default theme shows them in the header and footer
- npm publishing prep: package metadata, version 0.1.0-alpha.0 published under the `alpha` tag, `create-vuemo` depends on the matching release versions, `RELEASING.md`
- default theme: styles for VitePress Markdown extensions (containers, alerts, code blocks with copy button, code groups, anchors, tables), a global `Badge` component, `docs/markdown.md`; the example blog gets post-build checks (`pnpm test:site`, `pnpm verify`) that run in CI
- default theme: code block line numbers (`markdown.lineNumbers`, opt out per block with `:no-line-numbers`) are shown and aligned instead of hidden
- default theme: the dark mode toggle renders both icons and switches them with CSS, which fixes a hydration mismatch when the stored appearance is dark
- `summary` option (`'excerpt'` default, or `'description'`): the default theme's home page shows each post's excerpt (the part before `---`) or description, with a "Read more" link
- `paths` option and `useTaxonomyLinks()`: the default theme links the category and tags of a post to the category and tag pages, which preselect the item from `?category=` / `?tag=`
- `@vuemo/core`: post JSON-LD includes `dateModified` when VitePress has a valid last-updated time (never earlier than the publish date)
- `search` option: full-text local search (VitePress's local search with `searchRender`, which makes the text before a post's first heading searchable); the default theme gets a search button and an accessible modal (`/`, Ctrl/Cmd+K), loading MiniSearch and the index only when it opens
- `footer` accepts `string | { message, copyright }`; core always writes an object to `themeConfig.footer` (a string becomes `{ message }`), and the default theme renders both parts. **Breaking for themes that read `themeConfig.footer` as a string**: read `footer.message` (and `footer.copyright`) instead
- default theme: the archive page shows the total post count, a count per year and compact `MM-DD` rows with one-line titles
- `lastUpdated` option (`boolean | { text? }`): turns on VitePress's git-based last updated time; the default theme shows "Updated YYYY-MM-DD" on posts when it differs from the publish date (`lastUpdated: false` in frontmatter hides it), and the JSON-LD gets `dateModified`
- math on by default for new blogs: `create-vuemo` installs `markdown-it-mathjax3` and sets `markdown: { math: true }` and `search: true`; example post `math.md`
- `VuemoThemeConfig` and `FooterConfig` are exported from `@vuemo/core`: `VuemoThemeConfig` is exactly what `defineBlogConfig` writes into `themeConfig`, so themes can use `useData<VuemoThemeConfig>()`; `themeConfig.summary` and `themeConfig.paths` (both keys) are always written
- `useQueryParam(key, { history? })` in `@vuemo/core/client`: a ref that follows the URL's `?key=`, also on same-path link navigation and Back/Forward. `usePagination` is built on it, which fixes the page staying on `?page=2` after clicking the nav "Home" link and a `popstate` listener that was never removed; the tag and category layouts use it (the theme-local `useQuerySelection` is gone)
- `@vuemo/plugin-comments`: the container no longer uses the Tailwind class `mt-10` (it only worked because the default theme happened to emit it); its spacing is a scoped style, so the plugin does not depend on theme CSS
- the generated config and `examples/blog` start with `/// <reference types="@vuemo/plugin-comments" />` and `/// <reference types="@vuemo/plugin-ai-summary" />`, so `comments` / `aiSummary` type-check under `tsc`, `vue-tsc` and the editor (the module augmentation of `OfficialFeatures` only loads when the plugin package is referenced); documented in configuration.md and plugins.md
- peer dependency `vitepress` is `^1.6.0` (was `>=1.6.0`, which would accept 2.x with different internals) in core, the default theme and the official plugins
- default theme: no longer uses VitePress's internal `__VP_LOCAL_SEARCH__` flag (`themeConfig.search.provider === 'local'` decides whether the search button shows); `SearchModal.vue` references `env.d.ts` so `vue-tsc` over the shipped sources finds `@localSearchIndex`
- default theme: muted text (`text-zinc-500`, placeholder) gets `dark:text-zinc-400` for contrast on the dark background; the search modal's Esc button has `aria-label="Close search"`; each "Read more" link carries the post title for screen readers; docs: keep excerpts to plain paragraphs
- `usePost(url?)` in `@vuemo/core/client` (the normalized post at the current route); `searchRender` is exported from `@vuemo/core`

### Fixes
- sitemap URLs include the site `base` (`https://example.com/vuemo/posts/a`), like the feed and the JSON-LD; before, `base` was dropped and the listed URLs returned 404 under a sub-path
