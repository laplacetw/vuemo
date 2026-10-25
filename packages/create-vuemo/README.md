# create-vuemo

Scaffold a [Vuemo](https://github.com/laplacetw/vuemo) blog.

```sh
npm create vuemo@alpha my-blog
```

It asks for a project name, a blog title and whether to enable comments (Giscus or Utterances) and the AI summary. Skip the prompts with flags: `--yes`, `--comments=utterances`, `--ai-summary`.

## Another theme

```sh
npm create vuemo@alpha my-blog -- --theme vuemo-theme-trigger
npm create vuemo@alpha my-blog -- --theme @scope/vuemo-theme-x@^1.2.0
```

`--theme <package>[@version-or-range]` installs that theme instead of `@vuemo/theme-default` (no version means `latest`) and writes `theme: '<package>'` into `.vitepress/config.ts`. The prompt "Theme package" asks for it too. The package name must be a valid npm name, otherwise the command exits with code 1.

Switching themes later is the same two steps by hand: install the package (`pnpm add <package>`) and set `theme: '<package>'` in `defineBlogConfig`. Options that only the old theme understood in `themeConfig` are ignored.

The generated blog has math (`markdown-it-mathjax3`) and local search turned on.

Vuemo is in alpha, so use the `alpha` tag until a stable release.

See the [documentation](https://github.com/laplacetw/vuemo/tree/main/docs).
