# Theme authoring

A Vuemo theme is a regular VitePress theme (`{ Layout, enhanceApp? }`) that renders the data `@vuemo/core` provides. This page is the full guide: the contract, the options core hands to a theme, how to start, how to check your work and what to do before you publish. For using a theme, see [Themes](./themes.md).

Fastest start:

```sh
npm create vuemo@alpha vuemo-theme-mine -- --template theme
cd vuemo-theme-mine
pnpm install
pnpm dev
pnpm check
```

[`@vuemo/theme-default`](../themes/default) is the reference implementation of everything below.

## The contract

A theme works with every framework plugin if it does these things.

### Layouts

Implement seven layouts: `home`, `post`, `archive`, `tag`, `category`, `about` and `page`. `about` is the About page (`layout: about`); rendering it as `page` is enough, but it lets a theme give that page its own look (an avatar, a profile from your theme options) without the author editing the page.

**Dispatch on `frontmatter.layout` only.** A missing layout is rendered as `page`. What happens to a value outside the seven (`layout: foo`) is up to the theme: the default theme renders it as `page`, but a theme built on plain VitePress `extends: DefaultTheme` may render nothing for it, because VitePress renders `<component :is="layout">` and cannot fall back. Authors should not use unknown layout values with a theme they have not checked, and `vuemo check-theme` warns (`unknown-layout`) when a theme loses the body. Never look at the file path. Core makes this possible: `defineBlogConfig` gives every page under `posts/` that has no `layout` the layout `post` (in `transformPageData`, after your own hook if you have one). A page outside `posts/` without a `layout` has none, which the theme treats as `page`.

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { frontmatter } = useData()
const layouts = { home: Home, post: Post, archive: Archive, tag: Tag, category: Category, about: Page, page: Page }
const current = computed(() => layouts[frontmatter.value.layout as keyof typeof layouts] ?? Page)
</script>

<template>
  <component :is="current" />
</template>
```

### Standard slots

In the `post` layout, provide three slots so plugins can inject content without knowing your markup:

| Slot | Place it |
| --- | --- |
| `post-before-content` | before the post body (the AI summary goes here) |
| `post-after-content` | after the post body |
| `post-comments` | after `post-after-content` (the comments go here) |

Each slot is rendered once, with the components that plugins registered for it:

```vue
<script setup lang="ts">
import { useSlots } from '@vuemo/core/client'
const before = useSlots('post-before-content')
</script>

<template>
  <component :is="c" v-for="(c, i) in before" :key="i" />
</template>
```

It is handy to put that into a small `PluginSlot` component that takes the slot `name` (the starter and the default theme both do). It is also a good idea to offer a normal Vue `<slot>` with the same name next to it, so a theme that extends yours can fill it.

### The post body: `vuemo-content`

Put the class `vuemo-content` on the element that wraps the post content (for example `<Content class="vuemo-content" />`). Plugins read the article text from it; the AI summary does. The class must be on the element that contains the body, with the slots `post-before-content` before it and `post-after-content` after it.

### Plugin client code: `runEnhanceApps`

Plugins can ship client code (`enhanceApp`). Your theme runs it:

```ts
import type { Theme } from 'vitepress'
import { runEnhanceApps } from '@vuemo/core/client'

export default {
  Layout,
  enhanceApp(ctx) {
    return runEnhanceApps(ctx)
  }
} satisfies Theme
```

### Dark mode: `isDark`

Reflect dark mode through VitePress's `useData().isDark` (VitePress toggles the class `dark` on `<html>`), not through your own state, so plugins can follow it. The comments plugin switches the Giscus and Utterances theme this way.

### Data: only from core

Consume data from the composables of `@vuemo/core/client` ([the list](./themes.md#composables-vuemocoreclient)). A theme never reads the file system: no `node:fs`, no `node:path`, no `import.meta.glob` over the posts.

## Options core gives you

Users set flat options in `defineBlogConfig`. Core maps them into VitePress's `themeConfig`, and your theme reads them with `useData<VuemoThemeConfig>().theme.value` (the type is exported from `@vuemo/core`). Where VitePress's default theme has a key with the same name, the shape is the same, so a theme that uses `extends: DefaultTheme` gets `nav`, `logo`, `socialLinks`, `footer`, `search` and `lastUpdated` working for free. A `themeConfig` key the user writes explicitly wins over the flat option.

| Option (and `themeConfig` key) | Shape in `themeConfig` | Written |
| --- | --- | --- |
| `nav` | `{ text: string, link: string }[]` | when set |
| `footer` | `{ message?: string, copyright?: string }` (HTML). A string option becomes `{ message }`; always an object | when set |
| `logo` | `string`, a file in `public/` | when set |
| `socialLinks` | `{ icon: string \| { svg: string }, link: string, ariaLabel?: string }[]` | when set |
| `postsPerPage` | `number` | when set; pick your own default |
| `summary` | `'excerpt' \| 'description'` | always, default `'excerpt'` |
| `paths` | `{ tag: string, category: string }` | always, both keys, defaults `/tags` and `/categories` |
| `search` | `{ provider: 'local', options: { _render, ... } }` | when the option is on |
| `lastUpdated` | `{ text?: string }` | when the option is on |

Supporting each of them is up to the theme; a theme that ignores one just lacks that feature. Details and the exact semantics of `summary`, `search` and `lastUpdated` are in [Themes](./themes.md#themeconfig-reference).

## Theme options

Options that only your theme understands go at the top level of `themeConfig`; users set them with `defineBlogConfig({ themeConfig: { ... } })`. Core passes them through untouched. Two rules:

- **Do not use the names core owns**: `nav`, `footer`, `logo`, `socialLinks`, `postsPerPage`, `summary`, `paths`, `search`, `lastUpdated`.
- **Type and validate them in the theme.** Core has no API for theme options. Export a TypeScript type for your options so users get completion, and validate in your client code with `console.warn('[my-theme] themeConfig.x must be a string')`. During `vitepress build` the warning also shows up in the output.

```ts
// src/types.ts (export it from the entry)
export interface MyThemeConfig {
  /** Label of the "read more" link on the home page. */
  readMoreText?: string
}
```

Users who switch away from your theme keep their `themeConfig` keys; other themes ignore them.

## Customizing a theme: `extends`

To change a theme, use VitePress's native `extends` plus slots. Do not invent another inheritance mechanism. The same works for building a theme on top of VitePress's default theme:

```ts
import DefaultTheme from 'vitepress/theme'
import { runEnhanceApps } from '@vuemo/core/client'
import Post from './Post.vue'
import Archive from './Archive.vue'

export default {
  extends: DefaultTheme,
  enhanceApp(ctx) {
    // VitePress renders <component :is="frontmatter.layout"> for a layout it does not know,
    // so global components act as layouts
    ctx.app.component('post', Post)
    ctx.app.component('archive', Archive)
    return runEnhanceApps(ctx)
  }
}
```

Things to know when you extend `DefaultTheme`:

- Register a global component for each of `post`, `archive`, `tag` and `category`. `home` and `page` already exist in VitePress's default theme (map them with its own layouts or slots such as `home-hero-after`).
- Because core defaults `posts/` pages to `layout: post`, your `Post` component is used for every post, and it renders the body itself with `<Content class="vuemo-content vp-doc" />`. This is how the class `vuemo-content` gets onto the post body even though `VPDoc` would not let you set it.
- VitePress's default theme brings its own `themeConfig` schema, global CSS and layout. Its internals are not a stable API, which is why `@vuemo/theme-default` does not extend it.
- Run `vuemo check-theme` to find out what is missing.

## Versioning and dependencies

- **`@vuemo/core` is a peer dependency and never a `dependency`.** Two copies of core would not share the posts data. List it in `devDependencies` as well so your example and tests work.
- **The `@vuemo/core` peer range is the contract version you support.** While Vuemo is 0.x, a change of the contract is a core minor release (see the "Theme contract" section of the [changelog](../CHANGELOG.md)), so a range such as `^0.1.0-alpha.0` or `~0.2.0` tells users which core your theme was checked against.
- **`vitepress` is a peer dependency with range `^1.6.0`**, and so is `vue`. All Vuemo packages use the same range.
- **Keep runtime dependencies lazy.** A theme's own dependencies (for example `minisearch` in the default theme) are fine, but import them dynamically on the client, when the feature is used (`await import('minisearch')`). That keeps them out of the SSR build, keeps the page light, and avoids resolution trouble under strict installs (pnpm), where a dependency of the theme is not visible to a project that imports it from a generated file.
- Do not read the file system, and do not import `window` or `document` at module level; touch them in `onMounted` or event handlers.

Name the package `vuemo-theme-<name>` or `@scope/vuemo-theme-<name>`, and add the keyword `vuemo-theme`, so people can find it.

## The starter template

```sh
npm create vuemo@alpha vuemo-theme-mine -- --template theme
```

`--template theme` is the only flag it needs. The prompt "What do you want to create? [blog/theme]" asks too, and the second prompt asks for the package name when you leave it out. Any valid npm package name works; a name that is not `vuemo-theme-<name>` or `@scope/vuemo-theme-<name>` gets a hint. A scoped name creates the directory `vuemo-theme-<name>`.

What you get:

| File | What it is |
| --- | --- |
| `src/index.ts` | The theme entry; `enhanceApp` calls `runEnhanceApps(ctx)` |
| `src/Layout.vue` | Header, footer, dark mode toggle, dispatch on `frontmatter.layout`, option validation |
| `src/layouts/*.vue` | The layouts, in plain CSS (`about` reuses `Page.vue`) |
| `src/components/PluginSlot.vue` | Renders a standard slot |
| `src/types.ts` | The typed theme options |
| `example/` | A blog that uses the theme through the path of `src/index.ts` |
| `test/contract.test.ts` | Runs `checkTheme` with vitest |

Scripts: `pnpm dev` (the example blog), `pnpm build:example`, `pnpm check` (`vuemo check-theme ./src/index.ts`), `pnpm test`. The generated README explains the rest.

While you develop, a blog can use a local theme through the path of its entry file or folder: `theme: '/path/to/my-theme/src/index.ts'` or `theme: '../my-theme'` (a path starts with `./`, `../` or is absolute).

## Shipping a theme

Publish to npm (the main way; users run `npm install vuemo-theme-<name>` and set `theme: '<name>'`). Name the package `vuemo-theme-<name>` so the short name works. You can also attach a zip to a GitHub Release, for users who prefer to unzip a theme into their project's `themes/` folder. Both use the same files, so a theme that works as a package works as a zip if:

- **It ships precompiled assets.** The user has no build tools for your theme: compile Tailwind or any CSS to a file (such as `dist/style.css`) and import that file from the theme's entry. Do not rely on the user running a bundler step, a postinstall script or a CSS preprocessor.
- **It has an entry by the convention.** Vuemo looks in `package.json` (`exports["."]`, then `main`), then `index.{ts,mts,js,mjs}`, then `src/index.*`. The entry's default export is the theme. Entries that are `.ts` or `.vue` sources are fine: Vite compiles them. The first candidate that exists wins: a declared entry that is missing (an unbuilt `dist/`) is skipped and the fallbacks (`index.ts`, `index.mts`, `index.js`, `index.mjs`, then the same under `src/`) are tried.
- **Its dependencies are the user's.** `vue`, `vitepress` and `@vuemo/core` are peers, found in the user's `node_modules`. Other packages the theme imports must be listed in its `package.json` `dependencies`; for a zip they are not installed, so keep a zip theme free of them or bundle them.
- **The zip has one top-level folder named after the theme's short name**: `trigger/package.json`, `trigger/src/`, `trigger/dist/`, `trigger/README.md`, `trigger/LICENSE`. The user unzips it into `themes/`, which gives `themes/trigger/`. (A zip that wraps the folder once more is tolerated, but name the top-level folder so it needs no renaming.)

The starter's `pnpm package` writes `dist-zip/<name>-<version>.zip` in that layout (see the generated README); upload it to the GitHub Release of the tag. It follows `files` in `package.json` when there is one (plus `package.json`, `README.md` and `LICENSE`), never includes dotfiles or symbolic links, fails when the entry would not be in the zip, and stamps every file with `SOURCE_DATE_EPOCH` (else 1980-01-01), so the same files give the same zip. Tell your users to download this release file and not GitHub's "Source code (zip)".

## `vuemo check-theme`

```sh
vuemo check-theme [theme] [--keep]
```

It builds a small fixture blog (three posts, a home, archive, tag, category and about page, plus probe plugins that fill the three standard slots and register an `enhanceApp`) with your theme, then reads the generated HTML. `theme` is anything `defineBlogConfig` accepts, resolved from the current directory (one difference: a file or folder that exists relative to the current directory is taken as a path even without `./`, so `vuemo check-theme themes/trigger` and `vuemo check-theme src/index.ts` work, while in `defineBlogConfig` a path must start with `./`, `../` or be absolute): a path, a folder in `themes/`, a short name (`trigger`) or a package name; without it, the `exports["."]` (or `main`) of the `package.json` in the current directory is used. The fixture lives in `.vuemo-check/` and is deleted afterwards; `--keep` keeps it (it is in the starter's `.gitignore`). `pnpm check` and `pnpm test` use the same `.vuemo-check/` directory, so do not run them at the same time. The same check is available from code:

```ts
import { checkTheme } from '@vuemo/core/check'

const { results, ok } = await checkTheme({ theme: './src/index.ts' })
```

Each line of the output is `<icon> <id>: <message>`, then a summary:

| Icon | Status | Meaning |
| --- | --- | --- |
| `✓` | pass | the contract point holds |
| `✗` | fail | the contract is broken; the message says how to fix it. The command exits with code 1 |
| `!` | warn | likely a problem, but not proven by the build; does not change the exit code |
| `?` | manual | cannot be checked automatically; verify it by hand |

| Id | Kind | What it checks |
| --- | --- | --- |
| `layout-home`, `layout-archive`, `layout-tag`, `layout-category`, `layout-about`, `layout-page`, `layout-post` | fail | the page of that layout renders its content (home lists the newest post, archive lists every post, tag and category show their lists, about, page and post render the Markdown body) |
| `unknown-layout` | warn | a page with a layout value no theme knows (`vuemo-check-unknown`) still renders its body; the contract leaves this to the theme, so a loss is only a warning |
| `vuemo-content` | fail | an element with the class exists in the post layout and the post body is inside it |
| `slots` | fail | the three standard slots are each rendered exactly once, in the order before-content < body < after-content < comments |
| `enhance-app` | fail | the plugins' `enhanceApp` ran (you called `runEnhanceApps`) |
| `peer-deps` | warn | `@vuemo/core` and `vitepress` are in `peerDependencies`, and `@vuemo/core` is not in `dependencies` |
| `no-fs` | warn | the theme sources do not import `node:fs`, `fs` or `node:path` |
| `is-dark` | manual | toggle the appearance and check that the theme and plugins follow `isDark` (it is a warning if the sources show no sign of dark mode support) |
| `theme`, `build` | fail | the theme could not be found, or the fixture failed to build with it (the first lines of the error follow) |

## Publish checklist

- [ ] Named `vuemo-theme-<name>` or `@scope/vuemo-theme-<name>`, with the keyword `vuemo-theme`
- [ ] `@vuemo/core`, `vitepress` (`^1.6.0`) and `vue` in `peerDependencies`; `@vuemo/core` not in `dependencies`; the core range is the contract version you tested
- [ ] `exports["."]` points at the entry (the starter ships `src/index.ts`, which VitePress compiles); if you add a build step, for example for CSS, add its output to `files` and `exports`
- [ ] Runtime dependencies, if any, are imported lazily on the client
- [ ] `vuemo check-theme` has no `✗` and no `!`, and you verified `is-dark` by hand
- [ ] The README lists your theme options (names and types) and which core options you support
- [ ] `npm publish`
