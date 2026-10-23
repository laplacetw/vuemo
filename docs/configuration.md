# Configuration

> Vuemo is under development. APIs may change.

All settings live in `.vitepress/config.ts`, in a single `defineBlogConfig()` call. It accepts every VitePress option (`title`, `description`, `lang`, `base`, `head`, `markdown`, `vite`, ...) and works like `defineConfig`, plus the options below. See the config of [`examples/blog`](../examples/blog/.vitepress/config.ts) for a working file.

```ts
import { defineBlogConfig } from '@vuemo/core'

export default defineBlogConfig({
  title: 'My Blog',
  description: 'Notes',
  hostname: 'https://example.com',

  theme: '@vuemo/theme-default',
  postsPerPage: 5,
  nav: [{ text: 'Home', link: '/' }],
  footer: 'Powered by Vuemo',

  comments: { provider: 'utterances', repo: 'user/comments-repo' },
  aiSummary: false
})
```

## Vuemo options

| Option | Description |
| --- | --- |
| `theme` | Theme package. Default `@vuemo/theme-default`. See [Themes](./themes.md). |
| `hostname` | Site origin. Used by the sitemap and the JSON-LD of posts. |
| `nav` | `{ text, link }[]` navigation links. Becomes `themeConfig.nav`. |
| `footer` | HTML for the footer. Becomes `themeConfig.footer`. |
| `postsPerPage` | Posts per page on the home layout. Default 5. Becomes `themeConfig.postsPerPage`. |
| `comments` | Enable comments. See below. |
| `aiSummary` | Enable the AI summary. See below. |
| `plugins` | Your own or third-party plugins. See [Plugins](./plugins.md). |

`nav`, `footer` and `postsPerPage` are shortcuts for `themeConfig`. If you also set `themeConfig` yourself (VitePress's own mechanism, or a theme's own options), your `themeConfig` wins.

## Features

Official features are switched on in the config and need no import: **set the key to enable, remove it or use `false` to disable.**

```ts
comments: { provider: 'utterances', repo: 'user/comments-repo' }
// comments: { provider: 'giscus', repo: 'user/repo', repoId: '...', category: '...', categoryId: '...' }
aiSummary: { api: 'https://your-worker.workers.dev' }
```

Their packages (`@vuemo/plugin-comments`, `@vuemo/plugin-ai-summary`) must be installed; `create-vuemo` installs both. Options are documented in the plugin READMEs: [comments](../plugins/comments/README.md), [AI summary](../plugins/ai-summary/README.md).

## Frontmatter

Defined by `@vuemo/core` ([`schema.ts`](../packages/core/src/schema.ts)); themes and plugins only depend on this.

| Field | Description |
| --- | --- |
| `title` | Required. |
| `date` | Required, e.g. `2025-01-01 10:00:00`. |
| `category` | Optional, one per post. |
| `tags` | Optional list. |
| `description` | Optional summary. |

A post without a valid `title` or `date` is skipped with a warning.
