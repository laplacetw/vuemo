# @vuemo/core

Core of [Vuemo](https://github.com/laplacetw/vuemo), a lightweight blog framework built on VitePress: the posts loader, `defineBlogConfig()`, composables for themes (`@vuemo/core/client`) and the `vuemo` CLI (`vuemo new <filename>`).

Most people start with [`create-vuemo`](https://www.npmjs.com/package/create-vuemo). See the [documentation](https://github.com/laplacetw/vuemo/tree/main/docs).

## Checking a theme

`vuemo check-theme [theme] [--keep]` checks that a theme follows the Vuemo theme contract. `theme` is a path to the theme entry or a package name resolvable from the current directory; by default it is the `exports["."]` (or `main`) of the `package.json` in the current directory.

It writes a small fixture blog (three posts and the home, archive, tag, category and page pages) to `.vuemo-check/` in the current directory, builds it in-process with VitePress and the theme, and checks the HTML:

- layouts `home`, `archive`, `tag`, `category`, `page` and `post` render their data (`layout-*`)
- the post body sits inside an element with class `vuemo-content` (`vuemo-content`)
- the standard slots `post-before-content`, `post-after-content` and `post-comments` are rendered once each, in order (`slots`)
- the theme's `enhanceApp` calls `runEnhanceApps(ctx)` (`enhance-app`)
- warnings from `package.json` and sources: `@vuemo/core` and `vitepress` are peer dependencies and `@vuemo/core` is not a dependency (`peer-deps`), no `node:fs`/`node:path` imports (`no-fs`), and a manual reminder that the theme follows `isDark` (`is-dark`)

Each result is printed as `✓` (pass), `✗` (fail), `!` (warning) or `?` (verify by hand). The fixture is deleted afterwards unless `--keep` is given (add `.vuemo-check` to `.gitignore`). The exit code is `1` if any check fails (a build error counts as a failure), otherwise `0`; warnings and manual items do not fail the check.

The same check is available from code: `import { checkTheme } from '@vuemo/core/check'` returns `{ results, ok }`.
