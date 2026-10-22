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
