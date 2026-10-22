# Deployment

> Vuemo is under development. APIs may change.

The output is a normal VitePress site: `pnpm build` writes it to `.vitepress/dist`.

## GitHub Pages

A project site lives under `/<repo>/`, so set `base` or the CSS and JS will 404 and the page will render without the theme. `examples/blog` reads it from an environment variable, which keeps local dev at `/`:

```ts
// .vitepress/config.ts
base: process.env.BASE ?? '/'
```

The workflow of this repo ([`.github/workflows/gh-pages.yml`](../.github/workflows/gh-pages.yml)) sets `BASE: /vuemo/` on the build step, builds with pnpm and publishes with `actions/deploy-pages`. Copy it for your blog, adjust the build path and set `BASE`. A user or organization site (`<user>.github.io`) and custom domains need no `base`.

In the repository, set Settings → Pages → Source to **GitHub Actions**.

## AWS Amplify

Untested sketch, not yet verified with Vuemo. Build with pnpm and publish `.vitepress/dist`:

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

The site is served from the domain root, so leave `base` unset.
