# Changelog

## Unreleased

## 0.1.0-alpha.2

### Features
- `theme` is resolved by one pure function, `resolveThemeSource(theme, root)` (exported from `@vuemo/core`), in this order: a path (`./x`, `../x`, absolute; a file or a folder), `themes/<name>/` in the project (a single wrapping subfolder from a zip is entered), the installed package `vuemo-theme-<name>` (short names), the installed package `<name>` (also `@scope/name`). Entries come from `package.json` (`exports["."]`, `main`), then `index.*`, then `src/index.*`. A name with a `/` (other than a scope's) or a `..` segment is rejected: a path must start with `.` or be absolute. Errors list what was tried and how to fix it. `defineBlogConfig` bundles `vuemo-theme-<name>` for a short name.
- `vuemo check-theme trigger` accepts the same names, through the same function.
- docs: using a theme from npm or a zip in `themes/`, and how to ship a theme as a zip
- `create-vuemo --theme trigger`: a short name installs `vuemo-theme-trigger` and writes `theme: 'trigger'`; full and scoped names work as before (a name without `@` scope or `vuemo-theme-` prefix is now short). The generated config explains how to switch themes.
- theme starter: `pnpm package` writes `dist-zip/<name>-<version>.zip` (top-level folder named after the short name; Node only) for a GitHub Release
- `defineBlogConfig` always excludes `themes/**` from the pages (VitePress `srcExclude`), so a README.md inside an unzipped theme is not built as a page; a `srcExclude` of your own keeps that entry
- `theme: 'default'` is an alias of `@vuemo/theme-default` (also `create-vuemo --theme default`); a bare short name only falls back to a package named exactly `<name>` when `package.json` lists it; `vuemo check-theme themes/trigger` accepts a bare existing folder
- dev server: a theme folder created in `themes/` or a package installed while `dev` runs is picked up (the page reloads)
- the theme shape error names the resolved entry file
- theme starter: `pnpm package` follows `files`, skips dotfiles and symbolic links, fails when the entry is missing from the zip, and is reproducible (`SOURCE_DATE_EPOCH`, else 1980-01-01); `files` of the starter now lists `dist` too
- `create-vuemo`: the blog's `.gitignore` ignores `.vuemo-check`

### Fixes
- dev: `vitepress dev` showed a blank page (`Could not resolve "virtual:vuemo/theme"`, 504 on `@vuemo_theme-default.js`) when `@vuemo/*` packages were installed from a registry instead of linked in a workspace, because Vite's dependency optimizer pre-bundled them. `defineBlogConfig` now adds `@vuemo/core`, `@vuemo/theme-default`, `@vuemo/plugin-comments`, `@vuemo/plugin-ai-summary`, the installed theme package and the packages of plugin slot / `enhanceApp` files to `vite.optimizeDeps.exclude` (merged with your own, no duplicates)
- a theme in `themes/` whose entry imports a missing `../dist/...` file now warns that it looks like GitHub's "Source code (zip)" and to download the release asset

### Changed
- the error for a theme that cannot be found now reads `[vuemo] theme "X" was not found. Looked in: ...`; a missing path reads `theme path "X" does not exist`. Only the project's own `node_modules` is searched for theme packages (not the folders above it), and theme names follow the npm naming rules (a `themes/` folder name may have capitals)

### Breaking (new scaffolds only)
- `create-vuemo`: new projects keep all settings in `vuemo.config.ts` at the project root (`export default defineBlogConfig({...})`, with the plugin `/// <reference types>` lines); `.vitepress/config.ts` (`export { default } from '../vuemo.config'`) and `.vitepress/theme/index.ts` are generated one-line boilerplate, so users never need to open `.vitepress/`. The theme starter's `example/` follows the same layout, and the generated `tsconfig.json` includes `vuemo.config.ts`.
- Existing projects are unaffected: a `.vitepress/config.ts` that calls `defineBlogConfig` directly keeps working (covered by a build test).

## 0.1.0-alpha.1

### Features
- `@vuemo/plugin-ai-summary`: stable class hooks (`vuemo-ai-summary-button`, `-dots`, `-dot`, `-result`, `-error`), a three-dot loading indicator (respects `prefers-reduced-motion`), the new `resultPrefix` option, and a bordered-box-free, `:where()`-based base style that themes override; documented as the styling contract in the plugin README
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
- `vuemo check-theme [theme] [--keep]` and `@vuemo/core/check` (`checkTheme()`): build a fixture blog with a theme and check the theme contract (layouts, `vuemo-content`, standard slots, `runEnhanceApps`, peer dependencies, no file system access); exit code 1 on failure. The default theme runs it as `pnpm test:contract`
- `theme` accepts a package name or the absolute path of a theme entry file and is resolved from the project root; a theme that cannot be resolved, or whose default export has no `Layout`, fails with an explanation of the fix
- `create-vuemo --theme <package>[@range]` (and a "Theme package" prompt): scaffolds a blog with another theme instead of `@vuemo/theme-default`, writing the dependency (`latest` without a range) and an explicit `theme` line into the config; an invalid package name exits with code 1
- `create-vuemo --template theme` (and a "What do you want to create?" prompt): scaffolds a theme package (`vuemo-theme-<name>`) with the six layouts, the standard slots, a dark mode toggle in plain CSS, an example blog and a `test/contract.test.ts` that runs `checkTheme`; `pnpm check` runs `vuemo check-theme`
- `vuemo` rejects unknown flags with the usage text; `engines.node` is `>=18.3` (for `util.parseArgs`)
- docs: CLAUDE.md records the final status of every original Trigger feature and the contract friction found by the `vuemo-theme-trigger` 2.0.0-alpha rewrite (unknown layouts under `extends`; resolved by relaxing the dispatch rule)

### Fixes
- **Breaking:** `usePrevNext()` follows reading order: `prev` is the older post and `next` the newer one (it was the other way round). Themes that only render `prev`/`next` need no change.
- types: `@vuemo/core/client` and `@vuemo/core/theme` reference the `virtual:vuemo/*` declarations, and the client code no longer pulls in `@types/node` (`NavItem`, `SocialLink`, `FooterConfig`, `VuemoThemeConfig` moved to a node-free module; the public exports are unchanged); `core`, `plugin-comments` and `plugin-ai-summary` also set top-level `types`
- `create-vuemo` blogs get a `tsconfig.json`; project names must be lowercase valid npm names; the starter post has math in its excerpt; the `vue` peer range is `^3.5.0` (VitePress 1.6 depends on `^3.5.13`); `engines.node` is `>=18.3`
- JSON-LD: `<` is escaped as `\u003c` so a title cannot close the script tag; an invalid `date` omits the JSON-LD instead of failing the build
- `vuemo new`: date and time come from the same local clock, names with path separators or `..` are rejected, and the title is quoted safely in YAML
- AI summary: a request per page that is aborted on navigation, times out after 30 s and never shows a stale result; the box is `aria-live="polite"`; README notes that CORS does not protect your quota from non-browser clients
- comments: the Utterances `issue-term: title` embed waits for the page title to update before it mounts
- `@vuemo/theme-default` builds its CSS on `prepack`
- sitemap URLs include the site `base` (`https://example.com/vuemo/posts/a`), like the feed and the JSON-LD; before, `base` was dropped and the listed URLs returned 404 under a sub-path
- `defineBlogConfig` no longer warns about a missing RSS feed on every build of a blog without `hostname`; it warns only when `rss` (`true` or `{ limit }`, now allowed in the type) was set without a `hostname`
- default theme: search keeps keystrokes typed right after opening (the modal chunk is preloaded when the page is idle, and characters typed before it mounts are handed to it), and a result no longer repeats a heading that equals its title ("Second post | Second post")
- `create-vuemo` writes the blog title as a single-quoted, escaped string, like the rest of the generated config

### Theme contract
Changes that theme authors must know. While Vuemo is 0.x, a change of the contract is a core minor release, and a theme's `@vuemo/core` peer range is the contract version it supports.
- **Breaking**: `footer` is always `{ message?, copyright? }` in `themeConfig` (a string option becomes `{ message }`); read `footer.message`
- **Breaking**: themes dispatch on `frontmatter.layout` only (a missing layout is `page`; handling of values outside the six is theme-defined); core gives pages under `posts/` the layout `post`
- the dispatch rule is relaxed: the six layouts are required and a missing layout is `page`, but handling of other values is theme-defined (a theme built on plain VitePress `extends` cannot fall back); `vuemo check-theme` gets a warn-level `unknown-layout` check
- the `vitepress` peer range is `^1.6.0` for themes and plugins; `@vuemo/core` is a peer dependency of a theme, never a `dependency`
- `themeConfig.summary` and `themeConfig.paths` are always written; `search` and `lastUpdated` only when the option is on; theme-specific options go at the top level of `themeConfig` and must not reuse the names core owns (`nav`, `footer`, `logo`, `socialLinks`, `postsPerPage`, `summary`, `paths`, `search`, `lastUpdated`)
- new composables in `@vuemo/core/client`: `usePost`, `useQueryParam`, `useTaxonomyLinks`
- tooling for theme authors: `vuemo check-theme`, `create-vuemo --template theme`, and the guide `docs/theme-authoring.md`
