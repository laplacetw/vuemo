# Themes

> Vuemo is under development. APIs may change.

## Using a theme

Set `theme` in `vuemo.config.ts` (default `@vuemo/theme-default`). The name is looked up in this order, and the first match wins:

1. **A path**: `./x`, `../x` or an absolute path, to the theme's entry file or to its folder (handy while you develop a theme: `theme: './my-theme/src/index.ts'`). A path must start with `./`, `../` or be absolute; a name with a `/` that does not (`a/b`) is rejected, and so is a name with a `..` segment.
2. **A folder in your project**: `themes/<name>/` next to `posts/`.
3. **An installed package** `vuemo-theme-<name>`: the short name, so `theme: 'trigger'` finds `vuemo-theme-trigger`.
4. **An installed package** named exactly `<name>`, a full or scoped name (`'@vuemo/theme-default'`, `'@scope/my-theme'`). For a short name this step only applies when `<name>` is listed in your `package.json` `dependencies` or `devDependencies`, so a stray package that happens to have that name is never loaded.

`theme: 'default'` is the theme that ships with Vuemo (`@vuemo/theme-default`); a `themes/default/` folder of your own wins over it. Only your project's own `node_modules` is searched, never the folders above the project. A theme name follows the npm rules (lowercase letters, digits, `-`, `.`, `_`, `~`); a `themes/` folder name may also have capitals, and if it differs from `theme` only in case, Vuemo uses it and warns you to rename it.

Only your files and `node_modules` are read; nothing is downloaded when the blog builds. The settings live in `vuemo.config.ts` at the project root. The files in `.vitepress/` are VitePress's own entries; `create-vuemo` writes them as one-line boilerplate (`.vitepress/config.ts` re-exports `../vuemo.config`), so you never open that folder. The theme entry is:

```ts
export { default } from '@vuemo/core/theme'
```

Behind the scenes `theme` is resolved through a Vite virtual module, so no VitePress internals are involved. The theme's own imports (`vue`, `vitepress`, `@vuemo/core/client`) are resolved from your project's `node_modules`.

### Switching themes

There are two ways to get a theme; both end with changing one line.

**A. From npm (recommended).** Install the package and use its short name:

```sh
npm install vuemo-theme-trigger          # or: pnpm add vuemo-theme-trigger
```

```ts
// vuemo.config.ts
export default defineBlogConfig({
  theme: 'trigger',
  // ...
})
```

Check the package name before you install: `npm install` runs a stranger's code, so install only a theme you trust. Update it like any package: `npm install vuemo-theme-trigger@latest`. (A theme that only has prereleases needs its tag or range: `npm install vuemo-theme-trigger@alpha`.)

**B. From a zip file.** Download the theme's zip from its GitHub Release page (the file attached under "Assets"; **not** GitHub's "Source code (zip)", which has no compiled files), unzip it into a `themes/` folder in your project, and use the folder's name:

```
my-blog/
├── posts/
├── public/
├── themes/
│   └── trigger/              # the unzipped theme, named after the theme
│       ├── package.json
│       ├── src/
│       │   └── index.ts
│       ├── dist/             # precompiled styles, no build step for you
│       └── README.md
└── vuemo.config.ts           # theme: 'trigger'
```

`themes/trigger/` must hold the theme's `package.json` (or `index.ts`) directly. If your unzip tool added one more folder (`themes/trigger/trigger/package.json`) and that is the only folder, Vuemo looks one level down for you; anything deeper does not work. A theme in `themes/` takes precedence over an installed package of the same name. Markdown files inside `themes/` (the theme's README) are never built as pages: `themes/**` is always in VitePress's `srcExclude`.

Then, for both ways, read the theme's README for its own options (they go in `themeConfig`) and check it with `npx vuemo check-theme trigger`.

For a new blog, `create-vuemo` does both steps for the npm way:

```sh
npm create vuemo@alpha my-blog -- --theme trigger
npm create vuemo@alpha my-blog -- --theme vuemo-theme-trigger@^2.0.0
npm create vuemo@alpha my-blog -- --theme @scope/vuemo-theme-x@^1.2.0
```

`--theme <name>[@version-or-range]` puts the package into the dependencies instead of `@vuemo/theme-default`: a short name (`trigger`) installs `vuemo-theme-trigger` and writes `theme: 'trigger'`; a full name is installed as written and written as is. Without a version it is `latest` (`latest` needs a stable `latest` dist-tag: a theme that only has prerelease versions needs an explicit range, `--theme trigger@^2.0.0-alpha.0`). For a scoped name the version is what follows the last `@` after the first character. An invalid package name exits with code 1. The prompt "Theme" asks for it too.

Your posts, the flat options (`nav`, `footer`, `search`, ...) and the plugins keep working, because they belong to Vuemo and not to the theme. `themeConfig` keys that belonged to the old theme stay in your config and are ignored by the new one. Whether the new theme supports every flat option is up to it: see its README.

### Theme errors

| Message or symptom | Cause and fix |
| --- | --- |
| `[vuemo] theme "X" was not found. Looked in: ...` | None of the places has it. The message lists each place it looked and the existing folders of `themes/`. Install it (`npm install vuemo-theme-X`), unzip it into `themes/X/`, or fix the name. |
| `the folder themes/X/ exists but holds no theme entry` | The folder has no `package.json` with an entry, no `index.ts` and no `src/index.ts`: the zip was unzipped one level too deep, or into the wrong place, or the folder is empty. Move the theme's files up so that `themes/X/package.json` exists. Two or more subfolders are never guessed at. |
| `themes/X/X/package.json` (the zip nested one level too deep) | Works by itself when the inner folder is the only one. With extra folders beside it, or two levels, move the files up. |
| `theme path "./x" does not exist` | The path starts with `.` or is absolute and nothing is there. It is relative to the project root (where `vuemo.config.ts` is). |
| `"a/b" is not a valid theme name` | A name with a `/` (other than a scope's), a `..` segment or characters outside the npm rules (`x?raw`, `a:b`, a leading `.`) is not looked up. A path to a theme must start with `./`, `../` or be absolute. |
| `theme entry ... imports ../dist/style.css, which does not exist` (a warning, then the page fails to build) | You unzipped GitHub's "Source code (zip)" (the folder is often named `X-main` or `X-master`): it has no compiled `dist/`. Delete it and download the release asset (the .zip under "Assets" on the theme's Releases page). |
| `the package "vuemo-theme-X" is installed but has no theme entry` | The package has no usable `exports["."]` / `main` / `index.*` (for example an unbuilt `dist/`). Reinstall it, or ask the author. |
| A new `themes/X/` folder or a freshly installed package is not picked up while the dev server runs | The dev server watches `themes/X/` and `node_modules/vuemo-theme-X` and reloads when the theme starts or stops resolving. If it does not, restart `npm run dev`. A change of `theme` in `vuemo.config.ts` restarts the server by itself. |
| `theme "X" matched the folder themes/Y/ that differs in case` (a warning) | Rename the folder to `themes/X/`; Linux and macOS may treat the two names differently. |
| `[vuemo] theme "X" (/path/to/entry) does not default-export a VitePress theme ({ Layout, enhanceApp })` | The module (the message shows the file) was found, but its default export is not a theme: it has no `Layout`, not even through an `extends` chain. Check that the entry file does `export default { Layout, enhanceApp }` (or `{ extends, ... }`), and that `theme` points at that file rather than at some other module. |

`themeConfig` keys that belong to a theme you switched away from stay in your config and are ignored by the new one.

To customize a theme, use VitePress's native `extends` and slots in that file instead:

```ts
import Theme from '@vuemo/core/theme'
import MyLayout from './MyLayout.vue'

export default { extends: Theme, Layout: MyLayout }
```

## Layouts

A page picks its layout with `layout:` in its frontmatter. Core gives every page under `posts/` that has no `layout` the layout `post` (in `transformPageData`, after your own `transformPageData` hook if you have one), so a theme never looks at file paths. A page outside `posts/` without a `layout` has none.

The dispatch rule of the theme contract: **a theme chooses its layout from `frontmatter.layout` only, and a missing layout is rendered as `page`.** What a theme does with a value outside the seven is its own choice (a theme built on plain VitePress `extends` may render nothing), so do not use unknown layout values with a theme you have not checked.

`home` · `post` · `archive` · `tag` · `category` · `about` · `page`

`about` is for the About page (`about.md` gets `layout: about` from `create-vuemo`). The default theme renders it as a plain page; another theme may add an avatar or a profile to it, so switching themes needs no change to the page.

## Writing a theme

The full guide, including the starter template, `vuemo check-theme` and a publish checklist, is [Theme authoring](./theme-authoring.md). In short, a theme is a VitePress theme (default export `{ Layout, enhanceApp? }`) that only consumes data from `@vuemo/core/client`. `@vuemo/theme-default` is the reference implementation; its `Layout.vue` shows the layout dispatch and `layouts/Post.vue` the slots.

The contract, which lets framework plugins work with any theme:

- implement the seven layouts above, and dispatch on `frontmatter.layout` only: a missing layout is treated as `page` (unknown values are theme-defined)
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
| `paths` | `{ tag: string; category: string }` | always, both keys (defaults `/tags` and `/categories`) |
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
| `usePrevNext(url?)` | `{ prev, next }` for the current post (`prev` = older, `next` = newer) |
| `useTaxonomyLinks()` | `{ tagLink(name), categoryLink(name) }`: URLs of the tag and category pages (`themeConfig.paths`, with `base`) that preselect the item through `?tag=` / `?category=`. The tag and category layouts read that query and re-read it when the route changes |
| `useSlots(name)` | components plugins registered for a slot |
| `runEnhanceApps(ctx)` | runs the plugins' `enhanceApp` modules |

The home page renders each post's excerpt (the part before `---`) as HTML, so it keeps heading ids, anchors and relative image paths; keep excerpts to plain paragraphs. A theme that lists excerpts should do the same, or use `summary: 'description'`.

`Post` is `{ title, url, date: { time, string }, category?, tags, description?, excerpt?, words }` (`words` is the body length for reading time: a CJK character is one word); see [`schema.ts`](../packages/core/src/schema.ts).

Themes are free to use any CSS approach. `@vuemo/theme-default` uses Tailwind CSS v4 compiled at build time to `dist/style.css`, so users don't need Tailwind.
