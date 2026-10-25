# Themes

> Vuemo is under development. APIs may change.

## Using a theme

Set `theme` in `defineBlogConfig` (default `@vuemo/theme-default`) and install the package. `theme` is a package name or the absolute path of a theme entry file (handy while you develop a theme: `theme: '/path/to/my-theme/src/index.ts'`). The file `.vitepress/theme/index.ts` is VitePress's own theme entry; Vuemo makes it a fixed one-liner, so you never edit it:

```ts
export { default } from '@vuemo/core/theme'
```

Behind the scenes `theme` is resolved through a Vite virtual module, from your project's root as an `import` written in your project would be, so no VitePress internals are involved.

### Switching themes

1. Install the new theme: `pnpm add vuemo-theme-x` (a theme is a package; `@vuemo/theme-default` can stay installed or be removed).
2. Set it in `defineBlogConfig`: `theme: 'vuemo-theme-x'`.
3. Read the theme's README for its own options; they go in `themeConfig`.

For a new blog, `create-vuemo` does both steps:

```sh
npm create vuemo@alpha my-blog -- --theme vuemo-theme-x
npm create vuemo@alpha my-blog -- --theme @scope/vuemo-theme-x@^1.2.0
```

`--theme <package>[@version-or-range]` puts that package into the dependencies instead of `@vuemo/theme-default` (without a version it is `latest`) and writes `theme: '<package>'` into `.vitepress/config.ts`. For a scoped name the version is what follows the last `@` after the first character. An invalid package name exits with code 1. The prompt "Theme package" asks for it too.

Your posts, the flat options (`nav`, `footer`, `search`, ...) and the plugins keep working, because they belong to Vuemo and not to the theme. `themeConfig` keys that belonged to the old theme stay in your config and are ignored by the new one. Whether the new theme supports every flat option is up to it: see its README.

### Theme errors

| Message | Cause and fix |
| --- | --- |
| ``[vuemo] theme "X" could not be resolved from <root>. Install it (pnpm add X) or fix the `theme` option.`` | The package is not installed in your project (or the name or path in `theme` is wrong). Run `pnpm add X`, or correct the option. A path must be absolute and point at the theme's entry file. |
| `[vuemo] theme "X" does not default-export a VitePress theme ({ Layout, enhanceApp })` | The module was found, but its default export is not a theme: it has no `Layout`, not even through an `extends` chain. Check that the entry file does `export default { Layout, enhanceApp }` (or `{ extends, ... }`), and that `theme` points at that file rather than at some other module. |

`themeConfig` keys that belong to a theme you switched away from stay in your config and are ignored by the new one.

To customize a theme, use VitePress's native `extends` and slots in that file instead:

```ts
import Theme from '@vuemo/core/theme'
import MyLayout from './MyLayout.vue'

export default { extends: Theme, Layout: MyLayout }
```

## Layouts

A page picks its layout with `layout:` in its frontmatter. Core gives every page under `posts/` that has no `layout` the layout `post` (in `transformPageData`, after your own `transformPageData` hook if you have one), so a theme never looks at file paths. A page outside `posts/` without a `layout` has none.

The dispatch rule of the theme contract: **a theme chooses its layout from `frontmatter.layout` only, and a missing or unknown layout is rendered as `page`.**

`home` · `post` · `archive` · `tag` · `category` · `page`

## Writing a theme

The full guide, including the starter template, `vuemo check-theme` and a publish checklist, is [Theme authoring](./theme-authoring.md). In short, a theme is a VitePress theme (default export `{ Layout, enhanceApp? }`) that only consumes data from `@vuemo/core/client`. `@vuemo/theme-default` is the reference implementation; its `Layout.vue` shows the layout dispatch and `layouts/Post.vue` the slots.

The contract, which lets framework plugins work with any theme:

- implement the six layouts above, and dispatch on `frontmatter.layout` only: a missing or unknown layout is treated as `page`
- in the `post` layout provide the slots `post-before-content`, `post-after-content` and `post-comments`, and render the components plugins registered for each with `useSlots(name)`
- put the class `vuemo-content` on the post body (the AI summary reads the article text from it)
- call `runEnhanceApps(ctx)` in `enhanceApp`
- reflect dark mode through VitePress's `isDark`
- never read the file system; everything comes from the composables

The site options reach the theme as `useData<VuemoThemeConfig>().theme.value.<name>` (see the reference below). Support for them is up to the theme; `@vuemo/theme-default` supports all of them.

### themeConfig reference

`VuemoThemeConfig` (exported from `@vuemo/core`) is exactly what `defineBlogConfig` writes into `themeConfig`. Other `themeConfig` keys that users set pass through untouched, so the type has an index signature (`unknown`) for theme-specific keys.

```ts
import { useData } from 'vitepress'
import type { VuemoThemeConfig } from '@vuemo/core'

const { theme } = useData<VuemoThemeConfig>()
```

| Key | Type | Written |
| --- | --- | --- |
| `nav` | `NavItem[]` (`{ text, link }`) | when set |
| `footer` | `FooterConfig` (`{ message?, copyright? }`, HTML in both) | when set; always an object, core turns the string form of the option into `{ message }` |
| `logo` | `string`, a file in `public/` | when set |
| `socialLinks` | `SocialLink[]` | when set |
| `postsPerPage` | `number` | when set; the theme picks its own default |
| `summary` | `'excerpt' \| 'description'` | always (`'excerpt'` by default) |
| `paths` | `{ tag: string; category: string }` | always, both keys (defaults `/tags` and `/category`) |
| `search` | `{ provider: 'local', options }` | when the `search` option is on |
| `lastUpdated` | `{ text?: string }` | when the `lastUpdated` option is on |

Search is optional for a theme. When `search` is set, core writes `themeConfig.search = { provider: 'local', options: { _render, ...userOptions } }`, the same shape as VitePress's default theme, so a theme that extends it gets its search box for free. A theme that renders its own box reads that object and imports the module `@localSearchIndex`, which VitePress itself provides when `provider` is `'local'` (a map of locale to `() => import(...)` of a serialized MiniSearch index; load it with `MiniSearch.loadJSON`, using the same `minisearch` major as VitePress). Document ids already contain `base`, so navigate to them without `withBase`. `searchRender` is exported from `@vuemo/core` for themes that set up search themselves. `@vuemo/theme-default` loads MiniSearch and the index only when the box opens. A theme that ignores `search` simply has no search. With `search` off, `@vuemo/theme-default` still ships the modal and MiniSearch chunks in the build; they are never requested.

The default theme's `archive` layout shows the post count, a count per year and one compact `MM-DD` row per post (`useArchives()` provides the data; any markup works).

### Composables (`@vuemo/core/client`)

| Function | Returns |
| --- | --- |
| `usePosts()` | all posts, newest first |
| `useTags()` | `{ [tag]: Post[] }`, sorted by tag |
| `useCategories()` | `{ [category]: Post[] }` |
| `useArchives()` | `{ year, posts }[]`, newest year first |
| `usePagination(perPage?)` | `{ page, goPage }`; the page number lives in `?page=` (built on `useQueryParam`, so links to the same path and Back/Forward are followed) |
| `usePost(url?)` | the normalized `Post` at the current route, or `undefined` for pages that are not posts |
| `useQueryParam(key, { history? })` | a writable ref that follows the URL's `?key=` (`''` when absent): read on mount, on link navigation, also to the same path, and on Back/Forward. Assigning updates the URL with `history.replaceState` (`history: 'push'` adds an entry; `''` removes the param). Empty on the server; its listener is removed on unmount. The default theme's tag and category layouts use it |
| `usePrevNext(url?)` | `{ prev, next }` for the current post (`prev` = newer, `next` = older) |
| `useTaxonomyLinks()` | `{ tagLink(name), categoryLink(name) }`: URLs of the tag and category pages (`themeConfig.paths`, with `base`) that preselect the item through `?tag=` / `?category=`. The tag and category layouts read that query and re-read it when the route changes |
| `useSlots(name)` | components plugins registered for a slot |
| `runEnhanceApps(ctx)` | runs the plugins' `enhanceApp` modules |

The home page renders each post's excerpt (the part before `---`) as HTML, so it keeps heading ids, anchors and relative image paths; keep excerpts to plain paragraphs. A theme that lists excerpts should do the same, or use `summary: 'description'`.

`Post` is `{ title, url, date: { time, string }, category?, tags, description?, excerpt? }`; see [`schema.ts`](../packages/core/src/schema.ts).

Themes are free to use any CSS approach. `@vuemo/theme-default` uses Tailwind CSS v4 compiled at build time to `dist/style.css`, so users don't need Tailwind.
