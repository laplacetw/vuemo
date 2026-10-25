# Vuemo

A lightweight blog framework built on VitePress: pick a theme, add plugins, and write in Markdown.

Vuemo is a thin layer on top of [VitePress](https://vitepress.dev). VitePress stays the engine (Markdown, routing, build, HMR). Vuemo adds only what VitePress doesn't have: a post model, a theme contract and a small plugin interface.

> **Status: early development (alpha).** APIs may change. Packages are published with the `alpha` tag: `npm create vuemo@alpha my-blog`. See [docs/](./docs/README.md) for guides.

## Packages

| Path | Package | What it does |
| --- | --- | --- |
| `packages/core` | `@vuemo/core` | Posts loader, tags / categories / archives, pagination, prev/next, JSON-LD, RSS, `defineBlogConfig()`, `vuemo new` and `vuemo check-theme` CLI |
| `themes/default` | `@vuemo/theme-default` | Minimal default theme (Tailwind CSS v4) and the reference implementation of the theme contract |
| `plugins/comments` | `@vuemo/plugin-comments` | Comments with Giscus or Utterances, synced with dark mode |
| `plugins/ai-summary` | `@vuemo/plugin-ai-summary` | "Summarize" button backed by your own Cloudflare Worker (Workers AI + AI Gateway) |
| `packages/create-vuemo` | `create-vuemo` | Project scaffolding (`npm create vuemo`): a blog (any theme with `--theme`) or a theme starter (`--template theme`) |
| `examples/blog` | — | Example blog used for development |

## What a blog looks like

```
my-blog/
├── posts/                    # Markdown posts
├── public/                   # static assets
└── .vitepress/
    ├── config.ts             # all settings live here
    └── theme/index.ts        # boilerplate: export { default } from '@vuemo/core/theme'
```

All settings are in one place, `defineBlogConfig`. VitePress options keep working as usual.

```ts
// .vitepress/config.ts
import { defineBlogConfig } from '@vuemo/core'

export default defineBlogConfig({
  // site
  title: 'My Blog',
  description: 'Notes',
  hostname: 'https://example.com',

  // theme
  theme: '@vuemo/theme-default',
  postsPerPage: 5,
  nav: [{ text: 'Home', link: '/' }],

  // features: set a key to enable it, remove it or use `false` to disable it
  comments: { provider: 'utterances', repo: 'user/comments-repo' },
  aiSummary: false
})
```

Notes for new users: `create-vuemo` turns on `search: true` and `markdown: { math: true }` for you (both are off in plain `defineBlogConfig`); code block line numbers are opt-in (`markdown: { lineNumbers: true }`); the RSS feed at `/feed.xml` is written whenever `hostname` is set (`rss: false` turns it off). See [Configuration](./docs/configuration.md).

### Writing posts

```sh
vuemo new my-first-post   # creates posts/my-first-post.md
```

Frontmatter is defined by `@vuemo/core`; themes and plugins only depend on this:

```yaml
---
title: My first post
date: 2025-01-01 10:00:00
category: Notes
tags:
  - vuemo
description: Optional summary
---
```

## Themes

A theme is a regular VitePress theme that consumes data from `@vuemo/core/client` (`usePosts`, `useTags`, `useCategories`, `useArchives`, `usePagination`, `usePrevNext`, `usePost`, `useTaxonomyLinks`, `useQueryParam`). To be usable with Vuemo plugins, a theme must:

- implement the layouts `home`, `post`, `archive`, `tag`, `category` and `page`, chosen from `frontmatter.layout` only (missing or unknown is `page`; core gives `posts/` pages the layout `post`)
- provide these slots in the `post` layout: `post-before-content`, `post-after-content`, `post-comments`, rendered with `useSlots(name)`
- call `runEnhanceApps(ctx)` from its `enhanceApp`
- put the class `vuemo-content` on the post body
- reflect dark mode through VitePress's `isDark`

To customize a theme, use VitePress's own `extends` and slots.

Switch themes with the `theme` option (`create-vuemo --theme <package>` for a new blog); see [Themes](./docs/themes.md). To build your own, start from `npm create vuemo@alpha vuemo-theme-mine -- --template theme`, check it with `vuemo check-theme`, and read [Theme authoring](./docs/theme-authoring.md).

## Plugins

Official features (`comments`, `aiSummary`) are switched on in the config. Your own plugins go in `plugins: []`. A plugin is a function that returns an object; all fields are optional except `name`:

```ts
interface VuemoPlugin {
  name: string
  markdown?: (md: MarkdownRenderer) => void   // → markdown.config
  vite?: UserConfig['vite']                   // → merged into the vite config
  head?: HeadConfig[]                         // → site head
  transformPost?: (post: Post) => Post | void // → posts loader
  enhanceApp?: string                         // path of a client-side enhanceApp module
  slots?: Partial<Record<StandardSlot, string>> // component paths for the standard slots
}
```

Plugins that work with any theme live in `plugins/`. Plugins that only make sense for one theme live in `themes/<theme>/plugins/`. Both use the same interface.

## Development

Requires Node.js >= 18.3 and pnpm (enabled through [Corepack](https://nodejs.org/api/corepack.html): `corepack enable`).

```sh
pnpm install
pnpm build                 # core, theme, plugins, then the example blog
pnpm test
pnpm --filter blog dev     # run the example blog
```

Build the packages once before starting the example (`pnpm build`); the default theme ships precompiled CSS.

## Roadmap

- [x] Core and default theme
- [x] Plugin interface, comments and AI summary plugins
- [x] `create-vuemo` scaffolding
- [x] Documentation: see [docs/](./docs/README.md)
- [x] RSS

## License

[MIT](./LICENSE)
