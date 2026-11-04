# Getting started

Vuemo is published as an **alpha** release, so name the `alpha` tag:

```sh
npm create vuemo@alpha my-blog
cd my-blog
npm install
npm run dev
```

The generated project depends on the matching alpha versions, so `npm install` needs no tag.

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
├── vuemo.config.ts           # all settings live here
└── .vitepress/               # boilerplate (config.ts, theme/index.ts), you never open it
```

Projects created before this layout keep working: a `.vitepress/config.ts` that calls `defineBlogConfig` directly is still fully supported.

`create-vuemo` asks for a name, a title, a theme, and whether to enable comments (Giscus or Utterances) and the AI summary. For scripts, skip the prompts: `create-vuemo my-blog --yes --comments=utterances --ai-summary`. `--theme trigger` installs another theme ([Themes](./themes.md)).

Besides `posts/`, it writes the pages the nav links to, each with a layout in its frontmatter: `index.md` (`home`), `archives.md` (`archive`), `tags.md` (`tag`), `categories.md` (`category`) and `about.md` (`about`).

## Defaults for new blogs

The generated config turns on a few things that are off in plain `defineBlogConfig`:

- `search: true`: full-text local search (off unless you set it)
- `markdown: { math: true }` with `markdown-it-mathjax3` installed: math formulas
- line numbers in code blocks are **off**; opt in with `markdown: { lineNumbers: true }` ([Markdown](./markdown.md#line-numbers))
- the RSS feed at `/feed.xml` is written whenever `hostname` is set, so replace the placeholder `https://example.com` with your real origin (or use `rss: false`)

## Everyday commands

```sh
npm run dev                  # dev server
npm run build                # build to .vitepress/dist
npm run preview              # preview the build
npm run new my-first-post    # create posts/my-first-post.md (`vuemo new`)
```

(`pnpm dev`, `pnpm new ...` with pnpm.)

`vuemo new` refuses to overwrite an existing post. To keep a post private, don't commit or push it.

## Writing posts

Put Markdown files in `posts/`. The frontmatter is described in [Configuration](./configuration.md#frontmatter). Pages outside `posts/` select a layout with `layout:` in their frontmatter; see [Themes](./themes.md#layouts).
