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
  footer: { message: 'Powered by Vuemo', copyright: 'Copyright © 2025 Me' },

  comments: { provider: 'utterances', repo: 'user/comments-repo' },
  aiSummary: false
})
```

## Vuemo options

| Option | Description |
| --- | --- |
| `theme` | Theme package. Default `@vuemo/theme-default`. See [Themes](./themes.md). |
| `hostname` | Site origin. Used by the sitemap, the JSON-LD of posts and the RSS feed. |
| `nav` | `{ text, link }[]` navigation links. Becomes `themeConfig.nav`. |
| `footer` | HTML for the footer: a string (the message) or `{ message?, copyright? }`. Becomes `themeConfig.footer`, always as an object (a string turns into `{ message }`). |
| `logo` | Path of an image in `public/`, shown next to the site title. Becomes `themeConfig.logo`. |
| `socialLinks` | `{ icon, link, ariaLabel? }[]` links shown in the footer. `icon` is a text label (e.g. `'github'`) or `{ svg: '<svg>...</svg>' }`. Becomes `themeConfig.socialLinks`. |
| `postsPerPage` | Posts per page on the home layout. Default 5. Becomes `themeConfig.postsPerPage`. |
| `summary` | What the home page shows under each post: `'excerpt'` (default) or `'description'`. With `'excerpt'`, a post without an excerpt falls back to its `description`, and shows nothing if it has neither; with `'description'` the excerpt is never used. Every entry gets a "Read more" link. Tag, category and archive lists show only the title and date. Becomes `themeConfig.summary`. |
| `paths` | `{ tag?, category? }`: the pages that use the `tag` and `category` layouts. Defaults `/tags` and `/category`. Themes link post tags and categories there. Becomes `themeConfig.paths`. |
| `search` | Full-text search over your posts and pages, with a search box in the header. Off by default; `true` turns it on, or pass VitePress's [local search options](https://vitepress.dev/reference/default-theme-search#local-search) (for example `{ miniSearch: { searchOptions: { fuzzy: 0.1 } }, translations: { button: { buttonText: 'Find' } } }`). Becomes `themeConfig.search = { provider: 'local', options }`. See below. |
| `rss` | RSS feed at `/feed.xml` with the newest posts (`{ limit?: number }`, default 20). On whenever `hostname` is set, because feeds need absolute links; use `rss: false` to turn it off. |
| `comments` | Enable comments. See below. |
| `aiSummary` | Enable the AI summary. See below. |
| `plugins` | Your own or third-party plugins. See [Plugins](./plugins.md). |

`nav`, `footer`, `logo`, `socialLinks`, `postsPerPage`, `summary`, `paths` and `search` are shortcuts for `themeConfig`. If you also set `themeConfig` yourself (VitePress's own mechanism, or a theme's own options), your `themeConfig` wins.

## Search

`search: true` indexes the full text of every page at build time (VitePress's local search, nothing is sent to a server). Because posts have no `#` heading, Vuemo adds the post title as one, so text before the first heading is searchable too. The home, archive, tag and category pages are not indexed, and any page can opt out with `search: false` in its frontmatter. Options are passed to VitePress as they are, including `miniSearch` (MiniSearch `options` and `searchOptions`); your own `_render` replaces Vuemo's. Results show the page title and heading path.

The index and the search library are only downloaded when the search box opens. In `vitepress dev` the first open may make Vite optimize dependencies and reload the page once; this is expected and does not happen in a production build.

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

An excerpt is the part of the post before the first `---` line in its body (VitePress's excerpt separator). Put `---` on its own line, with blank lines around it, after the paragraphs you want on the home page.

`@vuemo/core` also writes JSON-LD (`BlogPosting`) into every post. It includes `dateModified` when VitePress has a last-updated time for the file (`lastUpdated` enabled and the file committed in git).

A post without a valid `title` or `date` is skipped with a warning.
