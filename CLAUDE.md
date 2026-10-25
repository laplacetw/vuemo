# CLAUDE.md — Vuemo

## Overview

**Vuemo** (Vue + memo) is a lightweight blog framework built on VitePress. Like Hexo, it should make it easy to apply a theme, build a theme and use plugins.

- It evolved from [vitepress-theme-trigger](https://github.com/laplacetw/vitepress-theme-trigger). That project was a "clone and modify" blog theme where theme, features and content lived in one repo.
- **VitePress is the engine**: Markdown, routing, build and HMR are left to VitePress. Vuemo only adds what VitePress lacks: a post model, a theme contract and a plugin interface.
- Do not reinvent a static site generator. If a VitePress mechanism solves the problem, use it.

## Design principles

1. **Thin**: Vuemo is a layer on top of VitePress, not a replacement for it.
2. **Simple first**: do not copy Hexo's whole generator / filter / helper / injector system. Open as few hooks as possible and add more only when there is a real need.
3. **Easy to understand and use**: a user's project should only have `posts/`, `public/` and one config file. **All settings live in `defineBlogConfig`** (site info, theme, theme options, features), without touching how VitePress's own settings work. The only other file is the boilerplate theme entry `.vitepress/theme/index.ts`, which users never edit.
4. **Separation of concerns**: core owns data and logic (no UI), a theme only renders (it never touches the file system), plugins extend through a fixed interface.
5. **Do not redo what VitePress already does**: for example, GitHub-style alerts and math are built-in VitePress Markdown features (math via `markdown-it-mathjax3`, an optional peer), so they are not wrapped as plugins.
6. **Every stage works**: while refactoring, the maintainer's own blog must keep building and deploying.

## Target architecture (pnpm monorepo)

```
packages/
  core/                 @vuemo/core            blog logic, no UI
    src/check/          theme contract check (`vuemo check-theme`, `@vuemo/core/check`)
  create-vuemo/         create-vuemo           project scaffolding (npm create vuemo)
    template/           blog template
    template-theme/     theme starter (`--template theme`)
themes/
  default/              @vuemo/theme-default   minimal default theme (Tailwind CSS, like the default theme Hexo ships)
    plugins/            theme-specific plugins (only for the default theme)
plugins/
  comments/             @vuemo/plugin-comments   framework plugin (works with any theme)
  ai-summary/           @vuemo/plugin-ai-summary
examples/
  blog/                 example blog used for development and verification
```

### Two kinds of plugins

| | Framework plugin | Theme plugin |
| --- | --- | --- |
| Location | `plugins/<name>/` | `themes/<theme>/plugins/<name>/` |
| Scope | any theme that follows the theme contract | only the theme it belongs to |
| Dependencies | only `@vuemo/core` and the theme contract (slots, composables) | may depend on the theme's components and styles |
| Package name | `@vuemo/plugin-<name>` | `@vuemo/theme-<theme>-plugin-<name>`, or not published separately |

Rule of thumb: if a feature still makes sense after switching themes, it is a framework plugin; if it exists only for one theme's UI or interaction, it is a theme plugin. Both kinds use the same `VuemoPlugin` interface.

### Default theme

- `@vuemo/theme-default` is a brand-new, minimal theme. It works out of the box and is the reference implementation of the theme contract.
- It should implement every required layout and standard slot, but it does not chase rich visuals. Stylistic needs are left to other themes.
- The original Trigger theme is **not** the default theme. It was rewritten as an independent Vuemo theme, `vuemo-theme-trigger` 2.0.0-alpha, which lives outside this repo (`/Users/laplacetw/proj/vuomo-theme-trigger`, branch `vuemo`).
- It deliberately does **not** `extends` VitePress's default theme. That theme is a documentation-site theme: its layout, `themeConfig` schema, global CSS and content markup (`VPDoc` renders the post body, so a theme cannot put a class on it) come with it, and its internals are not a stable API. A reference implementation of the Vuemo contract should depend on the contract only. The price is that features the default theme gives for free (search, Markdown extension styles, ...) are implemented in the theme itself; `@localSearchIndex` and `minisearch` make search feasible without pulling in its CSS.
- The contract does not forbid other themes from using `extends: DefaultTheme`. The known friction is `vuemo-content`: such a theme cannot add the class to the post body element. The Trigger rewrite (which does `extends: DefaultTheme`) was the check that the contract stays neutral; see the friction recorded under "Where the original Trigger features went".

### @vuemo/core

Responsible for:
- the posts data loader (based on VitePress `createContentLoader`)
- tags, categories, archives, pagination, previous/next links
- JSON-LD, sitemap, RSS
- frontmatter schema definition and validation
- `defineBlogConfig()`: wraps VitePress `defineConfig`; one place for site info, theme choice, theme options (`nav`, `footer`, `logo`, `socialLinks`, `postsPerPage`, `summary`, `paths`, `search`, `lastUpdated`) and feature switches (`comments`, `aiSummary`). Plain VitePress options keep working as they do in `defineConfig`
- CLI: `vuemo new <filename>` (replaces the old `npm run new`) and `vuemo check-theme [theme] [--keep]` (builds a fixture blog with a theme and checks the theme contract; also `checkTheme()` from `@vuemo/core/check`)

Composables provided to themes: `usePosts()`, `useTags()`, `useCategories()`, `useArchives()`, `usePagination()`, `usePrevNext()`, `usePost()`, `useTaxonomyLinks()`, `useQueryParam()`.

### Theme contract

- A theme is a VitePress theme that only consumes data provided by core.
- A theme must implement these layouts: `home`, `post`, `archive`, `tag`, `category`, `page`. A theme dispatches on `frontmatter.layout` only, a missing layout is treated as `page`, and handling of a value outside the six is theme-defined (a theme built on plain VitePress `extends` may render nothing for it, so authors should not use unknown layout values with themes they have not checked); core gives pages under `posts/` without a layout the layout `post`.
- A theme must provide these standard slots in the `post` layout, so framework plugins can inject content without knowing the theme's internals:
  - `post-before-content`: before the post content (for example an AI summary)
  - `post-after-content`: after the post content
  - `post-comments`: the comments area
- A theme must put the class `vuemo-content` on the post body element in the `post` layout, so plugins (for example the AI summary) can read the article text without knowing the theme's internals.
- A theme must render the components registered by plugins with `useSlots(name)` from `@vuemo/core/client`, and call `runEnhanceApps(ctx)` in its `enhanceApp`.
- A theme must reflect dark mode through VitePress `isDark`, so plugins (for example comments) can sync their appearance.
- `@vuemo/core` is a peer dependency of a theme, never a `dependency`; its range is the contract version the theme supports (while 0.x, a contract change is a core minor release; see the "Theme contract" section of CHANGELOG.md). `vitepress` is a peer dependency with range `^1.6.0`.
- Theme-specific options go at the top level of `themeConfig`, must not reuse the names core owns (`nav`, `footer`, `logo`, `socialLinks`, `postsPerPage`, `summary`, `paths`, `search`, `lastUpdated`), and are typed and validated (`console.warn`) by the theme itself; core has no API for them.
- `vuemo check-theme` checks the contract against a fixture build; `docs/theme-authoring.md` is the guide for theme authors.
- To customize a theme, use VitePress's native `extends` plus slots. Do not invent a custom inheritance mechanism.

### Plugin interface

A plugin is a function that returns an object with these fields:

```ts
interface VuemoPlugin {
  name: string
  markdown?: (md: MarkdownRenderer) => void    // → VitePress markdown.config
  vite?: UserConfig['vite']                    // → merged into the vite config
  head?: HeadConfig[]                          // → site head
  transformPost?: (post: Post) => Post | void  // → posts data loader
  enhanceApp?: string                          // path of a client-side enhanceApp module
  slots?: Partial<Record<StandardSlot, string>> // component paths injected into the theme's standard slots
}
```

`defineBlogConfig` merges these fields into existing VitePress hooks: `markdown.config`, `head`, `vite`, and the theme's `enhanceApp`.

Example user config. Everything is set in `.vitepress/config.ts`:

```ts
// .vitepress/config.ts
import { defineBlogConfig } from '@vuemo/core'

export default defineBlogConfig({
  // site (plain VitePress options)
  title: 'My Blog',
  description: 'Notes',
  lang: 'en',
  hostname: 'https://example.com',

  // theme
  theme: '@vuemo/theme-default',   // default; resolved through a virtual module, no VitePress internals
  postsPerPage: 5,
  nav: [{ text: 'Home', link: '/' }],

  // official features: set a key to enable it, remove it or use `false` to disable it
  comments: { provider: 'utterances', repo: 'user/comments-repo' },
  aiSummary: false,

  plugins: [],                     // third-party and theme plugins (VuemoPlugin objects)
})

// .vitepress/theme/index.ts: boilerplate generated by create-vuemo, never edited
export { default } from '@vuemo/core/theme'
```

Official features are plugins that core loads by their config key. Core has no dependency on them, not even an optional one, because the plugins depend on core. It imports them from the user's project when the key is set, and each plugin adds its key and types to `OfficialFeatures` by module augmentation.

### Frontmatter schema (defined by core)

`title`, `date`, `tags`, `category`, `description`. Themes and plugins depend only on this schema.

## Official framework plugins

### @vuemo/plugin-comments

- The original Trigger theme only supported Utterances. At the framework level, **one plugin supports several comment systems**, selected with `provider`.
- **Giscus** and **Utterances** are supported out of the box.
- Each provider is an adapter that implements the same interface (mount, unmount, switch light/dark theme, reload on page change).
- The old "Utterances follows dark mode" behavior is now shared by all providers (it relies on the theme contract's `isDark`).
- Injected into the `post-comments` slot.

### @vuemo/plugin-ai-summary

- It was meant to be exclusive to the Trigger theme; it is now an official framework plugin that works with any theme, and a showcase feature for the framework.
- It uses Cloudflare Workers AI with AI Gateway. Users create their own Worker and put its API URL in the config.
- Injected into the `post-before-content` slot.
- The docs must include an example Worker and CORS setup instructions.

## Where the original Trigger features went

The rewrite is `vuemo-theme-trigger` 2.0.0-alpha (outside this repo; it builds on VitePress's default theme via `extends`). Its README has the user-facing 1.x to 2.0 migration table.

| Original Trigger feature | Final status |
| --- | --- |
| CLI for new posts | done, core: `vuemo new <name>` |
| JSON-LD | done, core: emitted at build time (with `dateModified`) instead of client-side |
| sitemap | done, core: reuses the VitePress sitemap, `hostname` and `base` are applied |
| RSS | new, core: `feed.xml` when `hostname` is set |
| Pagination (History API) | done: core gives the data (`usePagination`, `useQueryParam`), the theme renders the UI; state lives in `?page=`, `?tag=`, `?category=` so it can be linked |
| Previous/next links | done, core |
| Tailwind styles, layout UI | moved into the Trigger theme; Tailwind is compiled into the theme (`dist/style.css`), users install nothing |
| `archives.md` / `tags.md` / `category.md` page bodies (`<Archives />` ...) | replaced by `layout: archive`, `tag`, `category` in the frontmatter |
| Local search | done: `search: true` in `defineBlogConfig`; the VitePress search UI shows it |
| Footer, nav, logo, social links, last updated | done: flat options; the VitePress default theme parts render them |
| Utterances comments (with dark mode sync) | done, plugin-comments: `comments: { provider: 'utterances', ... }`, dark mode follows `isDark` |
| AI instant summary | done, plugin-ai-summary: `aiSummary: { api }` |
| `mdMath`, `mdLineNums` | done: VitePress `markdown: { math, lineNumbers }` |
| MathJax mobile optimization | **removed**: VitePress improved this in later versions |
| markdown-it-footnote | **kept as a plain Markdown plugin**: the user opts in via `markdown.config` (`md.use(footnote)`), as the theme's example does; built into VitePress only from 2.0 |
| `.vitepress/theme/index.ts` with the theme code, `theme/config.ts` | removed: the fixed one-liner `export { default } from '@vuemo/core/theme'` and `defineBlogConfig` |
| `README_CH.md`, the Pages workflow | removed; use Vuemo's deployment guide |
| About avatar and quote (hard-coded) | theme option `themeConfig.about { avatar, quote }` |

**Contract friction found by the rewrite**: a theme that does `extends: DefaultTheme` cannot fall back to `page` for an unknown `frontmatter.layout`, because VitePress renders `<component :is="layout">` (Trigger registers its layouts as global components). Resolution: the contract was adjusted, not the theme. The six layouts are required and a missing layout is `page`, but handling of other values is theme-defined; `vuemo check-theme` has a warn-level `unknown-layout` check. `vuemo-content` caused no friction in practice.

**Validation principle**: if every existing feature can be rewritten as an official plugin without friction, the plugin interface is right. When a rewrite is awkward, revisit the interface first instead of working around it inside the plugin.

## Migration stages

1. **Core and default theme** (done): create the monorepo, extract Trigger's data logic (post loading, tags, pagination, previous/next, JSON-LD) into `@vuemo/core`, and build a minimal `@vuemo/theme-default` so that `examples/blog` works.
2. **Plugins** (done): implement `defineBlogConfig`, the plugin interface and the theme's standard slots; finish plugin-comments (Giscus, Utterances) and plugin-ai-summary.
3. **Scaffolding** (done): build `create-vuemo`, which generates a clean project with only `posts/`, `public/` and the config.
4. **Documentation** (done): guides for getting started, configuration, building themes, writing plugins and deployment, in `docs/`.
5. **Foundation and theme ecosystem** (done): the default theme styles VitePress Markdown extensions and has local search, summaries, taxonomy links, last updated and a compact archive; `theme` accepts a package name or an entry path with actionable errors; pages under `posts/` default to the `post` layout; `vuemo check-theme`; `create-vuemo --theme` and `--template theme` (theme starter); `docs/theme-authoring.md`. Not part of this stage: the Trigger rewrite.

Do one stage at a time, and verify that build and deployment still work at the end of each stage.

## Tech stack

- Node.js >= 18.3 (core and create-vuemo; for `util.parseArgs`), pnpm
- VitePress, Vue 3, TypeScript
- Default theme styling: Tailwind CSS v4 (compiled to CSS when the theme is built)
- Deployment: GitHub Pages (workflow in `.github/workflows`), AWS Amplify

## Conventions

- Before adding a feature, check whether VitePress already has a native mechanism for it.
- Do not add plugin hooks or theme slots unless there is a concrete use case the existing ones cannot cover.
- Core must not import any theme component; a theme must not read the file system directly.
- Framework plugins must not depend on a specific theme; anything that needs theme cooperation goes through the theme contract.
- Update CHANGELOG.md for public API changes.
