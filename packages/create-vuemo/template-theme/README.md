# __NAME__

A [Vuemo](https://github.com/laplacetw/vuemo) theme. A Vuemo theme is a plain VitePress theme (`{ Layout, enhanceApp }`) that renders the data `@vuemo/core` provides. It never reads the file system.

## Files

| File | What it is |
| --- | --- |
| `src/index.ts` | The theme entry: `{ Layout, enhanceApp }`. `enhanceApp` calls `runEnhanceApps(ctx)`. |
| `src/Layout.vue` | Header, footer, dark mode toggle and the dispatch on `frontmatter.layout`. Validates the theme options. |
| `src/layouts/*.vue` | The six required layouts: `home`, `post`, `archive`, `tag`, `category`, `page`. |
| `src/components/PluginSlot.vue` | Renders the components plugins registered for a standard slot. |
| `src/types.ts` | The typed theme options (`MyThemeConfig`). |
| `src/style.css` | Plain CSS. Dark mode swaps CSS variables under `html.dark`. |
| `example/` | A blog to try the theme: `pnpm dev`. Its `theme` option is the path of `src/index.ts`. |
| `test/contract.test.ts` | Runs the contract check with vitest. |
| `scripts/package.mjs` | `pnpm package`: writes the download zip to `dist-zip/` (Node only, no `zip` command needed). |

## The contract in six points

1. Implement the layouts `home`, `post`, `archive`, `tag`, `category` and `page`, and choose one only from `frontmatter.layout`. A missing layout is `page`; what to do with other values is up to the theme (here they also fall back to `page`). Never look at the file path (core sets `layout: post` for pages under `posts/`).
2. In the `post` layout provide the slots `post-before-content`, `post-after-content` and `post-comments`, each as a `<slot>` plus `<PluginSlot name="...">`.
3. Put the class `vuemo-content` on the post body (`<Content class="vuemo-content" />`).
4. Call `runEnhanceApps(ctx)` from `@vuemo/core/client` in `enhanceApp`.
5. Follow VitePress `isDark` for dark mode (`useData().isDark`).
6. Only consume data from `@vuemo/core/client` (`usePosts`, `usePagination`, `usePost`, `usePrevNext`, `useTags`, `useCategories`, `useArchives`, `useQueryParam`, `useTaxonomyLinks`). No `node:fs` or `node:path` in theme sources.

## Develop

The starter needs `@vuemo/core` at a version that ships `vuemo check-theme` (and `@vuemo/core/check`) and resolves a path, a `themes/<name>/` folder or a short name as `theme`. Earlier releases (such as `0.1.0-alpha.0`) lack them: raise the `@vuemo/core` range in `package.json` if `pnpm check` is not found.

```sh
pnpm install
pnpm dev             # the example blog with hot reload
pnpm build:example   # builds the example
pnpm check           # vuemo check-theme: builds a fixture blog and checks the contract
pnpm test            # the same check, as a vitest test
```

`pnpm check` and `pnpm test` build in the same `.vuemo-check/` directory: do not run them at the same time.

`pnpm check` prints one line per check (layouts, `vuemo-content`, slots, `enhanceApp`, peer dependencies, no file system access). `is-dark` has to be verified by hand: toggle the mode in `pnpm dev`.

## Publish

Two ways to give the theme to people. Both use the same files; npm is the main one.

### 1. npm (main)

- Name the package `vuemo-theme-<name>` or `@scope/vuemo-theme-<name>` and keep the `vuemo-theme` keyword. With the plain `vuemo-theme-<name>` name, users can write the short name `theme: '<name>'`.
- `@vuemo/core`, `vitepress` and `vue` are **peer dependencies**. Never put `@vuemo/core` in `dependencies`: two copies of core would not share the posts data. They are also in `devDependencies` so the example and the tests work.
- The `@vuemo/core` peer range is the contract version you support.
- The package ships `src` (the `exports` point at `src/index.ts`; VitePress compiles it). If you add a build step for CSS, add its output to `files` and `exports`.
- Run `pnpm check` and `pnpm test`, then `npm publish`.

Users run `npm install <package>` and set it in `vuemo.config.ts`:

```ts
export default defineBlogConfig({ theme: '__NAME__' })
```

### 2. A zip on a GitHub Release (secondary)

For people who prefer downloading to installing: `pnpm package` writes `dist-zip/<name>-<version>.zip`. It contains one top-level folder named after the theme's short name (`vuemo-theme-x` becomes `x/`) with `src/`, `dist/` (if it exists), `package.json`, `README.md` and `LICENSE`. Attach it to the GitHub Release of the version tag (for example with `gh release create v1.0.0 dist-zip/*.zip`).

- The zip user has no build step: put everything the theme needs, including compiled CSS, into the files that are zipped (`dist/` or `src/`) and import it from the entry. Run your build before `pnpm package`.
- Imports other than `vue`, `vitepress` and `@vuemo/core` are not installed for a zip user; bundle them or avoid them.
- The script needs only Node.js (it writes the zip itself, so it works on Windows too).

The user unzips it into the `themes/` folder of the blog (giving `themes/x/package.json`) and sets `theme: 'x'`. `vuemo check-theme x` checks it from the blog.
