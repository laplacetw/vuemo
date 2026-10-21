# Vuemo

A lightweight blog framework built on VitePress: pick a theme, add plugins, and write in Markdown.

Vuemo is a thin layer on top of [VitePress](https://vitepress.dev). VitePress stays the engine (Markdown, routing, build, HMR). Vuemo adds only what VitePress doesn't have: a post model, a theme contract and a small plugin interface.

> **Status: early development.** Nothing is published to npm yet. The packages below work inside this monorepo; the full documentation is still to come.

## Packages

| Path | Package | What it does |
| --- | --- | --- |
| `packages/core` | `@vuemo/core` | Posts loader, tags / categories / archives, pagination, prev/next, JSON-LD, `defineBlogConfig()`, `vuemo new` CLI |
| `themes/default` | `@vuemo/theme-default` | Minimal default theme (Tailwind CSS v4) and the reference implementation of the theme contract |
| `plugins/comments` | `@vuemo/plugin-comments` | Comments with Giscus or Utterances, synced with dark mode |
| `plugins/ai-summary` | `@vuemo/plugin-ai-summary` | "Summarize" button backed by your own Cloudflare Worker (Workers AI + AI Gateway) |
| `packages/create-vuemo` | `create-vuemo` | Project scaffolding (`npm create vuemo`) |
| `examples/blog` | — | Example blog used for development |

## What a blog looks like

```
my-blog/
├── posts/                    # Markdown posts
├── public/                   # static assets
└── .vitepress/
    ├── config.ts
    └── theme/index.ts        # export { default } from '@vuemo/theme-default'
```

```ts
// .vitepress/config.ts
import { defineBlogConfig } from '@vuemo/core'
import comments from '@vuemo/plugin-comments'
import aiSummary from '@vuemo/plugin-ai-summary'

export default defineBlogConfig({
  title: 'My Blog',
  hostname: 'https://example.com',
  themeConfig: { postsPerPage: 5 },
  plugins: [
    comments({
      provider: 'giscus',
      options: { repo: 'user/repo', repoId: '...', category: 'Announcements', categoryId: '...' }
    }),
    aiSummary({ api: 'https://your-worker.workers.dev' })
  ]
})
```

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
draft: false        # drafts are left out of lists in production builds
---
```

## Themes

A theme is a regular VitePress theme that consumes data from `@vuemo/core/client` (`usePosts`, `useTags`, `useCategories`, `useArchives`, `usePagination`, `usePrevNext`). To be usable with Vuemo plugins, a theme must:

- implement the layouts `home`, `post`, `archive`, `tag`, `category` and `page`
- provide these slots in the `post` layout: `post-before-content`, `post-after-content`, `post-comments`, rendered with `useSlots(name)`
- call `runEnhanceApps(ctx)` from its `enhanceApp`
- put the class `vuemo-content` on the post body
- reflect dark mode through VitePress's `isDark`

To customize a theme, use VitePress's own `extends` and slots.

## Plugins

A plugin is a function that returns an object. All fields are optional except `name`:

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

Requires Node.js >= 18 and pnpm (enabled through [Corepack](https://nodejs.org/api/corepack.html): `corepack enable`).

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
- [ ] Documentation: writing themes, framework plugins and theme plugins
- [ ] RSS

## License

[MIT](./LICENSE)
