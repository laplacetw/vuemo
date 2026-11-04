# Deployment

The output is a normal VitePress site: `pnpm build` writes it to `.vitepress/dist`.

## GitHub Pages

A project site lives under `/<repo>/`, so set `base` or the CSS and JS will 404 and the page will render without the theme. `examples/blog` reads it from an environment variable, which keeps local dev at `/`:

```ts
// vuemo.config.ts
base: process.env.BASE ?? '/'
```

The workflow of this repo ([`.github/workflows/gh-pages.yml`](../.github/workflows/gh-pages.yml)) sets `BASE: /vuemo/` on the build step, builds with pnpm and publishes with `actions/deploy-pages`. Copy it for your blog, adjust the build path and set `BASE`. A user or organization site (`<user>.github.io`) and custom domains need no `base`.

In the repository, set Settings → Pages → Source to **GitHub Actions**.

## AWS Amplify

Connect the repository in the Amplify console and use this build specification (`amplify.yml`). It builds with pnpm and publishes `.vitepress/dist`. It has not been verified on Amplify yet; adjust it if the build image differs.

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - corepack enable
        - pnpm install --frozen-lockfile
    build:
      commands:
        - pnpm build
  artifacts:
    baseDirectory: .vitepress/dist
    files:
      - '**/*'
```

The site is served from the domain root, so leave `base` unset. For `lastUpdated`, the build needs the full git history; Amplify clones it by default.
