# Themes

> Vuemo is under development. APIs may change.

## Using a theme

Set `theme` in `defineBlogConfig` (default `@vuemo/theme-default`) and install the package. The file `.vitepress/theme/index.ts` is VitePress's own theme entry; Vuemo makes it a fixed one-liner, so you never edit it:

```ts
export { default } from '@vuemo/core/theme'
```

Behind the scenes `theme` is resolved through a Vite virtual module, so no VitePress internals are involved.

To customize a theme, use VitePress's native `extends` and slots in that file instead:

```ts
import Theme from '@vuemo/core/theme'
import MyLayout from './MyLayout.vue'

export default { extends: Theme, Layout: MyLayout }
```

## Layouts

A page picks its layout with `layout:` in its frontmatter. Pages under `posts/` default to `post`, everything else to `page`.

`home` · `post` · `archive` · `tag` · `category` · `page`

## Writing a theme

A theme is a VitePress theme (default export `{ Layout, enhanceApp? }`) that only consumes data from `@vuemo/core/client`. `@vuemo/theme-default` is the reference implementation; its `Layout.vue` shows the layout dispatch and `layouts/Post.vue` the slots.

The contract, which lets framework plugins work with any theme:

- implement the six layouts above
- in the `post` layout provide the slots `post-before-content`, `post-after-content` and `post-comments`, and render the components plugins registered for each with `useSlots(name)`
- put the class `vuemo-content` on the post body (the AI summary reads the article text from it)
- call `runEnhanceApps(ctx)` in `enhanceApp`
- reflect dark mode through VitePress's `isDark`
- never read the file system; everything comes from the composables

### Composables (`@vuemo/core/client`)

| Function | Returns |
| --- | --- |
| `usePosts()` | all posts, newest first |
| `useTags()` | `{ [tag]: Post[] }`, sorted by tag |
| `useCategories()` | `{ [category]: Post[] }` |
| `useArchives()` | `{ year, posts }[]`, newest year first |
| `usePagination(perPage?)` | `{ page, goPage }`; the page number lives in `?page=` |
| `usePrevNext(url?)` | `{ prev, next }` for the current post (`prev` = newer, `next` = older) |
| `useSlots(name)` | components plugins registered for a slot |
| `runEnhanceApps(ctx)` | runs the plugins' `enhanceApp` modules |

`Post` is `{ title, url, date: { time, string }, category?, tags, description?, excerpt?, draft }`; see [`schema.ts`](../packages/core/src/schema.ts).

Themes are free to use any CSS approach. `@vuemo/theme-default` uses Tailwind CSS v4 compiled at build time to `dist/style.css`, so users don't need Tailwind.
