# Getting started

> Vuemo is under development. APIs may change.

Vuemo is published as an **alpha** release, so name the `alpha` tag:

```sh
npm create vuemo@alpha my-blog
```

The generated project has `posts/`, `public/` and one config file, with math (`markdown.math` and `markdown-it-mathjax3`) and local search (`search: true`) already turned on.

It depends on the matching alpha versions, so `npm install` in it needs no tag.

To work from the source instead, build the monorepo and run the scaffolder from it:

```sh
git clone https://github.com/laplacetw/vuemo.git
cd vuemo && corepack enable && pnpm install && pnpm build
node packages/create-vuemo/dist/index.js my-blog
```

## What you get

```
my-blog/
├── posts/                    # Markdown posts
├── public/                   # static assets
└── .vitepress/
    ├── config.ts             # all settings live here
    └── theme/index.ts        # boilerplate, you never edit it
```

`create-vuemo` asks for a name, a title, whether to enable comments (Giscus or Utterances) and the AI summary. For scripts, skip the prompts: `create-vuemo my-blog --yes --comments=utterances --ai-summary`.

## Defaults for new blogs

The generated config turns on a few things that are off in plain `defineBlogConfig`:

- `search: true`: full-text local search (off unless you set it)
- `markdown: { math: true }` with `markdown-it-mathjax3` installed: math formulas
- line numbers in code blocks are **off**; opt in with `markdown: { lineNumbers: true }` ([Markdown](./markdown.md#line-numbers))
- the RSS feed at `/feed.xml` is written whenever `hostname` is set, so replace the placeholder `https://example.com` with your real origin (or use `rss: false`)

## Everyday commands

```sh
pnpm dev                  # dev server
pnpm build                # build to .vitepress/dist
pnpm preview              # preview the build
pnpm new my-first-post    # create posts/my-first-post.md (`vuemo new`)
```

`vuemo new` refuses to overwrite an existing post. To keep a post private, don't commit or push it.

## Writing posts

Put Markdown files in `posts/`. The frontmatter is described in [Configuration](./configuration.md#frontmatter). Pages outside `posts/` (`about.md`, `tags.md`, ...) select a layout with `layout:` in their frontmatter; see [Themes](./themes.md#layouts).
