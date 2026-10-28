# @vuemo/plugin-gallery

A photo gallery for any Vuemo theme: album list, justified rows, a lazy PhotoSwipe lightbox with `?photo=` deep links, pagination, and the `vuemo-gallery` CLI that makes thumbnails (sharp) and uploads them to Cloudflare R2.

```ts
// vuemo.config.ts
/// <reference types="@vuemo/plugin-gallery" />
export default defineBlogConfig({
  gallery: { baseUrl: 'https://img.example.com' }   // or { storage: 'local' } to serve from public/gallery
})
```

```md
---
layout: page
---

<VuemoGallery />
```

```sh
pnpm add @vuemo/plugin-gallery && pnpm add -D sharp
pnpm vuemo-gallery add ./photos --album trip
```

Options: `baseUrl`, `dir`, `widths`, `formats`, `exif`, `perPage`, `urlBuilder`, `storage`. The full guide, including the first-time R2 setup (bucket, custom domain, CORS, least-privilege token, `.env`), is in [docs/gallery.md](../../docs/gallery.md).
