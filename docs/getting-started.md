# Getting started

> Vuemo is under development. APIs may change.

Packages are not published to npm yet. Until they are, build the monorepo and run the scaffolder from it:

```sh
git clone https://github.com/laplacetw/vuemo.git
cd vuemo && corepack enable && pnpm install && pnpm build
node packages/create-vuemo/dist/index.js my-blog
```

Once published this becomes `npm create vuemo`.

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

## Everyday commands

```sh
pnpm dev                  # dev server
pnpm build                # build to .vitepress/dist
pnpm preview              # preview the build
pnpm new my-first-post    # create posts/my-first-post.md (`vuemo new`)
```

`vuemo new` refuses to overwrite an existing post and creates it with `draft: true`.

## Writing posts

Put Markdown files in `posts/`. The frontmatter is described in [Configuration](./configuration.md#frontmatter). Pages outside `posts/` (`about.md`, `tags.md`, ...) select a layout with `layout:` in their frontmatter; see [Themes](./themes.md#layouts).
