# Configuration

All settings live in `vuemo.config.ts` at the project root, in a single `defineBlogConfig()` call. It accepts every VitePress option (`title`, `description`, `lang`, `base`, `head`, `markdown`, `vite`, ...) and works like `defineConfig`, plus the options below. See the config of [`examples/blog`](../examples/blog/vuemo.config.ts) for a working file.

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
| `theme` | The theme: a short name (`'trigger'` finds `themes/trigger/` in the project, else the installed `vuemo-theme-trigger`), a package name (`'@vuemo/theme-default'`, `'@scope/name'`), or a path that starts with `./`, `../` or is absolute (a file or a folder). Default `@vuemo/theme-default`. See [Themes](./themes.md) for the lookup order. The `themes/` folder is reserved for themes: pages under it are always excluded from the build (`themes/**` is added to `srcExclude`, also when you set your own `srcExclude`), so a theme's README.md never becomes a page. A theme that cannot be resolved or is not a VitePress theme fails the build with an explanation; see [Themes](./themes.md). |
| `hostname` | Site origin. Used by the sitemap, the JSON-LD of posts and the RSS feed; the site `base` is added to every URL. |
| `nav` | `{ text, link }[]` navigation links. Becomes `themeConfig.nav`. |
| `footer` | HTML for the footer: a string (the message) or `{ message?, copyright? }`. Becomes `themeConfig.footer`, always as an object (a string turns into `{ message }`). |
| `logo` | Path of an image in `public/`, shown next to the site title. Becomes `themeConfig.logo`. |
| `socialLinks` | `{ icon, link, ariaLabel? }[]` links shown in the footer. `icon` is a text label (e.g. `'github'`) or `{ svg: '<svg>...</svg>' }`. Becomes `themeConfig.socialLinks`. |
| `postsPerPage` | Posts per page on the home layout. Default 5. Becomes `themeConfig.postsPerPage`. |
| `summary` | What the home page shows under each post: `'excerpt'` (default) or `'description'`. With `'excerpt'`, a post without an excerpt falls back to its `description`, and shows nothing if it has neither; with `'description'` the excerpt is never used. Every entry gets a "Read more" link. Tag, category and archive lists show only the title and date. Becomes `themeConfig.summary`. |
| `paths` | `{ tag?, category? }`: the pages that use the `tag` and `category` layouts. Defaults `/tags` and `/categories`. Themes link post tags and categories there. Becomes `themeConfig.paths`. |
| `search` | Full-text search over your posts and pages, with a search box in the header. Off by default; `true` turns it on, or pass VitePress's [local search options](https://vitepress.dev/reference/default-theme-search#local-search) (for example `{ miniSearch: { searchOptions: { fuzzy: 0.1 } }, translations: { button: { buttonText: 'Find' } } }`). Becomes `themeConfig.search = { provider: 'local', options }`. See below. |
| `lastUpdated` | Show "Updated YYYY-MM-DD" on posts, taken from git history. `true` or `{ text?: string }` (default text `Updated`); off by default. It only shows when the date differs from the publish date, and a post can opt out with `lastUpdated: false` in its frontmatter. Needs full git history in CI (`fetch-depth: 0`); files git does not know yet show nothing. Also adds `dateModified` to the post's JSON-LD. Becomes VitePress's `lastUpdated: true` and `themeConfig.lastUpdated` (`{ text }` when you set one; the theme supplies the default `Updated`). |
| `rss` | RSS feed at `/feed.xml` with the newest posts (`{ limit?: number }`, default 20). On whenever `hostname` is set, because feeds need absolute links; use `rss: false` to turn it off. `rss: true` or `rss: { limit }` also asks for the feed explicitly: without `hostname` the build then warns that there is no feed. A blog that never sets `rss` or `hostname` gets no feed and no warning. |
| `comments` | Enable comments. See below. |
| `aiSummary` | Enable the AI summary. See below. |
| `gallery` | Enable the photo gallery (`<VuemoGallery />`). See [Gallery](./gallery.md). |
| `plugins` | Your own or third-party plugins. See [Plugins](./plugins.md). |

`nav`, `footer`, `logo`, `socialLinks`, `postsPerPage`, `summary`, `paths`, `search` and `lastUpdated` are shortcuts for `themeConfig`. If you also set `themeConfig` yourself (VitePress's own mechanism, or a theme's own options), your `themeConfig` wins.

## Search

`search: true` indexes the full text of every page at build time (VitePress's local search, nothing is sent to a server). Because posts have no `#` heading, Vuemo adds the post title as one, so text before the first heading is searchable too. The home, archive, tag and category pages are not indexed, and any page can opt out with `search: false` in its frontmatter. Options are passed to VitePress as they are, including `miniSearch` (MiniSearch `options` and `searchOptions`); your own `_render` replaces Vuemo's. Results show the page title and heading path.

The index and the search library are only downloaded when the search box opens. In `vitepress dev` the first open may make Vite optimize dependencies and reload the page once; this is expected and does not happen in a production build.

## Features

Official features are switched on in the config and need no import: **set the key to enable, remove it or use `false` to disable.**

```ts
comments: { provider: 'utterances', repo: 'user/comments-repo' }
// comments: { provider: 'giscus', repo: 'user/repo', repoId: '...', category: '...', categoryId: '...' }
aiSummary: { api: 'https://your-worker.workers.dev' }
gallery: { baseUrl: 'https://img.example.com' }
```

### Types of the feature keys

VitePress bundles the config with esbuild, so builds never type-check it. For `tsc`, `vue-tsc` and your editor, the types of `comments`, `aiSummary` and `gallery` come from the plugin packages, which TypeScript only loads when something refers to them. Put these lines at the top of `vuemo.config.ts` (`create-vuemo` writes them for you):

```ts
/// <reference types="@vuemo/plugin-comments" />
/// <reference types="@vuemo/plugin-ai-summary" />
/// <reference types="@vuemo/plugin-gallery" />   // only if you use the gallery
```

If you remove a plugin package from `package.json`, also remove its `/// <reference types="..." />` line, or `tsc` fails with TS2688 ("Cannot find type definition file"). The generated `tsconfig.json` covers `vuemo.config.ts` and `.vitepress/**/*.ts`, so `npx tsc` checks the config.

Without them an editor reports the keys as unknown properties, although the build works.

A feature's package must be installed for its key to work. `create-vuemo` installs `@vuemo/plugin-comments` and `@vuemo/plugin-ai-summary`; install `@vuemo/plugin-gallery` yourself. Options: [comments](../plugins/comments/README.md), [AI summary](../plugins/ai-summary/README.md), [gallery](./gallery.md#config).

## Frontmatter

Defined by `@vuemo/core` ([`schema.ts`](../packages/core/src/schema.ts)); themes and plugins only depend on this.

| Field | Description |
| --- | --- |
| `title` | Required. |
| `date` | Required, e.g. `2025-01-01 10:00:00`. |
| `category` | Optional, one per post. |
| `tags` | Optional list. |
| `description` | Optional summary. |
| `lastUpdated` | Set to `false` to hide "Updated" on this post (see the `lastUpdated` option). |
| `search` | Set to `false` to keep this page out of the search index (see Search). |
| `layout` | Layout of the page; posts default to `post`, other pages to `page`. See [Themes](./themes.md#layouts). |

An excerpt is the part of the post before the first `---` line in its body (VitePress's excerpt separator). Put `---` on its own line, with blank lines around it, after the paragraphs you want on the home page.

`@vuemo/core` also writes JSON-LD (`BlogPosting`) into every post. It includes `dateModified` when VitePress has a last-updated time for the file (`lastUpdated` enabled and the file committed in git).

A post without a valid `title` or `date` is skipped with a warning.
