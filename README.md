# Vuemo

**English** · [繁體中文](./README.zh-TW.md) · [简体中文](./README.zh-CN.md)

A lightweight blog framework built on [VitePress](https://vitepress.dev). Write posts in Markdown, pick a theme, turn on plugins, all from one config file.

VitePress stays the engine (Markdown, routing, build). Vuemo adds what a blog needs on top: a post model, a theme contract and a small plugin interface.

> **Alpha.** APIs may change. Packages are published with the `alpha` tag.

## Quick start

Requires Node.js 18.3 or later.

```sh
npm create vuemo@alpha my-blog
cd my-blog
npm install
npm run dev                  # open http://localhost:5173
npm run new my-first-post    # creates posts/my-first-post.md
```

`npm run build` writes the site to `.vitepress/dist`. See [Deployment](./docs/deployment.md) to publish it.

## Your project

```
my-blog/
├── posts/              # your posts
├── public/             # images and other static files
├── vuemo.config.ts     # every setting
└── .vitepress/         # generated boilerplate, never edited
```

```ts
// vuemo.config.ts
import { defineBlogConfig } from '@vuemo/core'

export default defineBlogConfig({
  title: 'My Blog',
  hostname: 'https://example.com',   // sitemap, RSS and JSON-LD
  theme: '@vuemo/theme-default',     // or 'trigger', after npm install vuemo-theme-trigger
  nav: [{ text: 'Home', link: '/' }],
  search: true,
  comments: { provider: 'giscus', repo: 'me/blog' /* ... */ },
  aiSummary: false
})
```

A post is a Markdown file with frontmatter:

```yaml
---
title: My first post
date: 2026-01-01 10:00:00
category: Notes
tags: [vuemo]
---
```

## Features

- Home with pagination, archive, tags, categories, previous and next post
- RSS, sitemap and JSON-LD, local full-text search
- Themes from npm or from a zip in `themes/`
- Official plugins: comments (Giscus, Utterances), AI summary (Cloudflare Workers AI), photo gallery (Cloudflare R2)
- Everything VitePress Markdown has: code highlighting, containers, math

## Documentation

| Guide | Topic |
| --- | --- |
| [Getting started](./docs/getting-started.md) | create a blog, everyday commands |
| [Configuration](./docs/configuration.md) | every option and the frontmatter |
| [Markdown](./docs/markdown.md) | containers, code blocks, math, footnotes |
| [Themes](./docs/themes.md) | install and switch themes |
| [Theme authoring](./docs/theme-authoring.md) | build a theme, the theme contract |
| [Plugins](./docs/plugins.md) | official features, write a plugin |
| [Gallery](./docs/gallery.md) | photo gallery with Cloudflare R2 |
| [Deployment](./docs/deployment.md) | GitHub Pages, AWS Amplify |

## Packages

| Package | What it does |
| --- | --- |
| [`@vuemo/core`](./packages/core) | posts loader, `defineBlogConfig`, composables for themes, the `vuemo` CLI |
| [`create-vuemo`](./packages/create-vuemo) | scaffolds a blog, or a theme with `--template theme` |
| [`@vuemo/theme-default`](./themes/default) | minimal default theme, the reference for the theme contract |
| [`@vuemo/plugin-comments`](./plugins/comments) | comments with Giscus or Utterances |
| [`@vuemo/plugin-ai-summary`](./plugins/ai-summary) | "Summarize" button backed by your Cloudflare Worker |
| [`@vuemo/plugin-gallery`](./plugins/gallery) | photo gallery and the `vuemo-gallery` upload CLI |

Themes outside this repo: [vuemo-theme-trigger](https://github.com/laplacetw/vuemo-theme-trigger).

## Development

```sh
corepack enable
pnpm install
pnpm build      # packages, then the example blog
pnpm test
pnpm dev        # the example blog in examples/blog
```

`pnpm verify` runs the build, the tests, the site test and the theme contract check.

## License

[MIT](./LICENSE)
