# Plugins

## Official features

`comments`, `aiSummary` and `gallery` are official plugins switched on from the config, see [Configuration](./configuration.md#features) and [Gallery](./gallery.md). They render in the theme's standard slots, so they work with any theme that follows the [theme contract](./themes.md#writing-a-theme).

## Your own plugins

A plugin is a function that returns an object. Put it in `plugins` in the config:

```ts
import { defineBlogConfig } from '@vuemo/core'
import myPlugin from './my-plugin'

export default defineBlogConfig({
  plugins: [myPlugin({ greeting: 'Hello' })]
})
```

The interface ([`plugin.ts`](../packages/core/src/plugin.ts)); every field except `name` is optional:

| Field | Merged into |
| --- | --- |
| `markdown(md)` | `markdown.config` |
| `vite` | the Vite config (deep merge) |
| `head` | the site `head` |
| `transformPost(post)` | the posts loader; return a new post or mutate it |
| `enhanceApp` | path of a client module whose default export is `(ctx) => void`, run by the theme's `enhanceApp` |
| `slots` | `{ slotName: componentPath }` for `post-before-content`, `post-after-content`, `post-comments` |

A minimal plugin that adds a banner above every post:

```ts
import { fileURLToPath } from 'node:url'
import type { VuemoPlugin } from '@vuemo/core'

export default function banner(options: { text: string }): VuemoPlugin {
  return {
    name: 'banner',
    // hand options to the client component at build time
    vite: { define: { __BANNER__: JSON.stringify(options) } },
    slots: { 'post-before-content': fileURLToPath(new URL('./Banner.vue', import.meta.url)) }
  }
}
```

`Banner.vue` reads `__BANNER__` and renders it. The official plugins ([`plugins/comments`](../plugins/comments), [`plugins/ai-summary`](../plugins/ai-summary), [`plugins/gallery`](../plugins/gallery)) use exactly this interface and are good references. Plugin packages ship `.vue`/`.ts` sources next to their built entry; `@vuemo/*` packages are processed by Vite automatically.

## Framework plugins and theme plugins

| | Framework plugin | Theme plugin |
| --- | --- | --- |
| Location | `plugins/<name>/` | `themes/<theme>/plugins/<name>/` |
| Works with | any theme that follows the theme contract | only its own theme |
| May depend on | `@vuemo/core` and the theme contract | the theme's components and styles |
| Name | `@vuemo/plugin-<name>` | `@vuemo/theme-<theme>-plugin-<name>` or unpublished |

If a feature still makes sense after switching themes, it is a framework plugin. Both kinds use the same `VuemoPlugin` interface.

## Making a plugin switchable from the config

To let users enable your plugin with a config key instead of `plugins: [...]`, the plugin has to be loaded by core. Today that is reserved for the official plugins (core keeps the key-to-package list in [`features.ts`](../packages/core/src/features.ts)). A plugin package adds the key's type by augmentation:

```ts
declare module '@vuemo/core' {
  interface OfficialFeatures {
    comments?: CommentsConfig | false
  }
}
```

The augmentation is part of the package's `dist/index.d.ts`, which only enters a user's TypeScript program when something refers to the package. A config that imports only `@vuemo/core` would therefore report the key as an unknown property under `tsc` / `vue-tsc` / the editor (VitePress's own build is not affected). Tell users to add a triple-slash reference at the top of `vuemo.config.ts`, as `create-vuemo` does for the official plugins:

```ts
/// <reference types="@vuemo/plugin-comments" />
```

Third-party plugins use `plugins: []`.
