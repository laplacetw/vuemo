# create-vuemo

Scaffold a [Vuemo](https://github.com/laplacetw/vuemo) blog.

```sh
npm create vuemo@alpha my-blog
```

It asks for a project name, a blog title and whether to enable comments (Giscus or Utterances) and the AI summary. Skip the prompts with flags: `--yes`, `--comments=utterances`, `--ai-summary`.

## Another theme

```sh
npm create vuemo@alpha my-blog -- --theme trigger
npm create vuemo@alpha my-blog -- --theme trigger@^2.0.0-alpha.0
npm create vuemo@alpha my-blog -- --theme @scope/vuemo-theme-x@^1.2.0
```

`--theme <name>[@version-or-range]` installs that theme instead of `@vuemo/theme-default`. A short name (`trigger`) installs the package `vuemo-theme-trigger` and writes `theme: 'trigger'` into `vuemo.config.ts`; a full name (`vuemo-theme-trigger`, `@scope/name`) is installed and written as it is. No version means `latest` (`latest` needs a stable `latest` dist-tag: a theme that only has prerelease versions needs an explicit range). The prompt "Theme" asks for it too. The package name must be a valid npm name, otherwise the command exits with code 1.

Switching themes later takes one install and one line: `npm install vuemo-theme-trigger` and `theme: 'trigger'` in `vuemo.config.ts` (or unzip a downloaded theme into `themes/` instead of installing it: `themes/trigger/` is looked at first). Options that only the old theme understood in `themeConfig` are ignored.

## Theme starter

```sh
npm create vuemo@alpha vuemo-theme-mine -- --template theme
```

`--template theme` (the prompt "What do you want to create? [blog/theme]" asks too; `blog` is the default) scaffolds a standalone theme package: the seven required layouts, the standard slots, a dark mode toggle in plain CSS, an `example/` blog, and a vitest test that runs the contract check. The argument is a package name (`@scope/vuemo-theme-x` creates `./vuemo-theme-x`) or a directory path (`./themes/vuemo-theme-x`; the last part is the package name). `--theme`, `--comments` and `--ai-summary` belong to a blog and are an error here. Name it `vuemo-theme-<name>` or `@scope/vuemo-theme-<name>` (another name works, with a hint). Then `pnpm install`, `pnpm dev`, `pnpm check`. `pnpm package` writes `dist-zip/<name>-<version>.zip` for people who unzip a theme into `themes/` (npm is the main way to publish, a GitHub Release zip the secondary one). See the generated README.

The generated blog has math (`markdown-it-mathjax3`) and local search turned on.

Vuemo is in alpha, so use the `alpha` tag until a stable release.

See the [documentation](https://github.com/laplacetw/vuemo/tree/main/docs).
