# Changelog

## Unreleased

### Features
- monorepo scaffold: `@vuemo/core`, `@vuemo/theme-default`, `examples/blog`
- `defineBlogConfig` has no `theme` option; themes are enabled with `.vitepress/theme/index.ts` (`export { default } from '@vuemo/theme-default'`), VitePress's native mechanism
- `VuemoPlugin` interface and `defineBlogConfig({ plugins })`: merges `markdown`, `vite`, `head`, `transformPost` (posts loader), `enhanceApp` and `slots`
- theme contract: `useSlots()` / `runEnhanceApps()` from `@vuemo/core/client`; post body must carry class `vuemo-content`
- `@vuemo/plugin-comments` (Giscus, Utterances) and `@vuemo/plugin-ai-summary`
- `create-vuemo`: scaffolds a blog with `posts/`, `public/`, config and theme entry; optional comments / AI summary plugins
- default theme: hide VitePress code block language label and copy button
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
