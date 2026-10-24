# @vuemo/theme-default

The minimal default theme of [Vuemo](https://github.com/laplacetw/vuemo), styled with Tailwind CSS v4 (compiled when the package is built, so you don't need Tailwind).

It is used by default; choose a theme with `theme` in `defineBlogConfig`. It is also the reference implementation of the [theme contract](https://github.com/laplacetw/vuemo/blob/main/docs/themes.md).

## Options it supports

`nav`, `footer`, `logo`, `socialLinks`, `postsPerPage` (default 5), `summary`, `paths`, `search` and `lastUpdated`; see [Configuration](https://github.com/laplacetw/vuemo/blob/main/docs/configuration.md). It also styles VitePress's Markdown extensions ([Markdown](https://github.com/laplacetw/vuemo/blob/main/docs/markdown.md)).

## Search

Set `search: true` in `defineBlogConfig` to get a search button in the header. It opens a modal (`/` or Ctrl/Cmd+K) that searches the full text of your posts; results show the title and heading path. MiniSearch and the index are loaded only when the modal opens. Button and modal texts follow `themeConfig.search.options.translations`.
