# Gallery

A photo gallery for any Vuemo theme: album list, justified rows, a lightbox, and a CLI that makes thumbnails and uploads them to Cloudflare R2 (or into `public/`). Photos are never read from the file system by the theme: the build only sees `gallery/manifest.json` and the image URLs.

Contents: [Quick start](#quick-start), [Cloudflare R2 setup](#cloudflare-r2-setup-first-time), [CLI](#cli), [Design](#design), [Config](#config), [Page and styling](#page), [Cost and limits](#cost-and-limits), [Local storage and the example](#local-storage-and-the-example).

## Quick start

```sh
pnpm add @vuemo/plugin-gallery
pnpm add -D sharp        # only the CLI needs it (thumbnails)
```

```ts
// vuemo.config.ts
/// <reference types="@vuemo/plugin-gallery" />
export default defineBlogConfig({
  gallery: { baseUrl: 'https://img.example.com' }   // storage 'r2' by default
})
```

```md
<!-- gallery.md -->
---
title: Gallery
layout: page
---

<VuemoGallery />
```

Add `{ text: 'Gallery', link: '/gallery' }` to `nav`, then follow the R2 setup below and run `pnpm vuemo-gallery add ./photos/japan --album japan-2025`. Without a domain or an R2 account, start with `storage: 'local'` (see the end of this page).

## Cloudflare R2 setup (first time)

You need a free Cloudflare account. R2 asks for a payment method when you enable it, but the free tier covers a personal gallery (see [cost](#cost-and-limits)).

1. **Enable R2.** Cloudflare dashboard, left sidebar, **Storage & databases** > **R2 object storage** > **Overview**. Follow the prompts to add a payment method and enable R2.
2. **Create the bucket.** **R2 object storage** > **Create bucket**. Name it (for example `my-photos`), keep location **Automatic**, default storage class **Standard**, **Create bucket**.
3. **Connect a custom domain.** Open the bucket > **Settings** > **Public access** > **Custom Domains** > **Connect Domain**. Enter a subdomain of a domain that is on your Cloudflare account (for example `img.example.com`) and confirm. Cloudflare adds the DNS record; wait until the status is **Active**. This is the `baseUrl`. (The **R2.dev subdomain** switch in the same section is only for trying things out: it is rate limited and has no CDN caching, so do not use it for a real site.) A custom domain also lets you add Cloudflare cache, WAF and hotlink-protection rules to it.
4. **Allow your blog to load the images (CORS).** Bucket > **Settings** > **CORS Policy** > **Add CORS policy** and paste (replace the origin with your blog's origin; list several if you have a preview domain too):

   ```json
   [
     {
       "AllowedOrigins": ["https://your-blog.example.com"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```

   Plain `<img>` tags work without CORS; the lightbox and some browsers' preloads are what need it. For local development add `http://localhost:5173` while you work.
5. **Create a least-privilege API token.** **R2 object storage** > **Overview** > **API** > **Manage API tokens** (also reachable as **Manage R2 API Tokens**) > **Create API token**. Permissions: **Object Read & Write**. Under **Specify bucket(s)** choose **Apply to specific buckets only** and pick your bucket. TTL: your choice (no expiry is fine for a personal token you can revoke). **Create API token**.
6. **Copy the credentials now.** The next screen shows the **Access Key ID** and **Secret Access Key** once. Also note your **Account ID** (R2 **Overview** page, right column; the S3 endpoint is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`). Do not use the "Token value" or an account-wide key.
7. **Put them in `.env`** in your project root (the CLI reads the environment first, then `.env`), and make sure `.env` is in `.gitignore` (the CLI warns if it is not):

   ```sh
   R2_ACCOUNT_ID=your-account-id
   R2_ACCESS_KEY_ID=your-access-key-id
   R2_SECRET_ACCESS_KEY=your-secret-access-key
   R2_BUCKET=my-photos
   ```

   Never commit these. Anyone with them can write to your bucket.
8. **Upload.** `pnpm vuemo-gallery add ./photos/japan --album japan-2025` makes the thumbnails with sharp, uploads only what is missing, and writes `gallery/manifest.json` (and an entry in `gallery/albums.yaml` for a new album). Run it again any time: nothing is uploaded twice.
9. **Config and preview.** Set `gallery.baseUrl` to your custom domain (step 3) and run `pnpm dev`. Open `/gallery`.
10. **Verify.** `pnpm vuemo-gallery verify --remote` checks the manifest, warns about photos without `alt`, and asks R2 whether every file exists. Commit `gallery/` (not `.env`) and deploy as usual.

Notes: originals are not uploaded; keep them yourself. The generated files are immutable (`Cache-Control: public, max-age=31536000, immutable`; the key contains the hash of the original), so changing a photo means a new id, not an overwrite. The gallery is for photos you are happy to publish: the bucket is public, and anyone who has a URL can fetch it. Do not use it for private photos.

## CLI

`vuemo-gallery` is the plugin's bin (run it with `pnpm vuemo-gallery ...`, or `npx`). It reads the `gallery` settings from your `vuemo.config.ts`; without them use `--storage`, `--dir`, `--base-url`.

| Command | What it does |
| --- | --- |
| `add <dir> --album <slug>` | Reads every image under `<dir>` (jpg, png, webp, avif, tiff, gif), makes `widths` x `formats` variants, uploads the missing ones, adds the photo to the manifest. A photo already in the manifest (same content) is skipped; missing files of it are restored. |
| `sync [--prune]` | Compares the storage with the manifest: lists missing files (exit code 1, re-run `add` with the originals) and unlisted ones; `--prune` deletes the unlisted ones. |
| `verify [--remote]` | Validates the manifest and `albums.yaml`, warns about missing `alt`, and checks that files exist (always for `local`, with `--remote` for R2). |
| `remove <id>` | Deletes a photo's files and its manifest entry. |

Edit `alt`, `caption` and `takenAt` in `gallery/manifest.json` by hand: `add` never overwrites them. A photo without `alt` gets a warning on `add` and `verify`; write a short description of what the photo shows (a purely decorative photo can use `"alt": ""`, which silences the warning).

Privacy: the generated images carry no metadata at all (no EXIF, no GPS). The manifest only keeps the allow-listed fields below, unless `exif: false`.

## Design


`@vuemo/plugin-gallery` is a framework plugin: it works with any theme that follows the theme contract. It adds no core hook. It registers a global component `<VuemoGallery>` through `enhanceApp` and brings its own Vite plugin (through `vite.plugins`) with two virtual modules.

## Data

Two files in the gallery directory (`gallery/` by default, `gallery.dir` to change it):

- `albums.yaml`, written by you: the albums.
- `manifest.json`, written by the `vuemo-gallery` CLI: the photos. Commit it. It is sorted and stable, so it does not cause merge-conflict noise.

```yaml
# gallery/albums.yaml (a list; `albums:` as a top-level key is accepted too)
- slug: japan-2025          # [a-z0-9-], unique, used in URLs and object keys
  title: Japan 2025
  description: Two weeks in Kansai
  cover: 3f9a1c0d2b7e       # a photo id of this album; default: the first photo
  date: 2025-04-12
  order: 1                  # ascending; albums without one come last, then newest date first
  hidden: false             # not listed, still reachable with ?album=<slug>
```

```jsonc
// gallery/manifest.json
{
  "version": 1,
  "photos": [
    {
      "id": "3f9a1c0d2b7e",       // first 12 hex characters of sha256(original file)
      "album": "japan-2025",
      "w": 4000, "h": 3000,       // after EXIF orientation
      "color": "#8a7d6b",         // average colour (placeholder before the image loads)
      "thumbhash": "3OcRJYB4d3h/iIeHeEh3eIhw+j3A", // optional
      "alt": "Torii gate at dusk",  // optional, but a warning without it
      "caption": "Fushimi Inari",   // optional
      "takenAt": "2025-04-12T17:03:00.000Z", // optional
      "exif": { "camera": "FUJIFILM X-T5", "lens": "XF23mmF2", "focal": 23, "aperture": 2, "iso": 200, "exposure": "1/250" },
      "variants": [400, 800, 1600, 2400],  // widths that exist (never larger than the original)
      "formats": ["webp"]
    }
  ]
}
```

Rules:

- Photo ids are `^[0-9a-f]{12}$` and unique. Slugs are `^[a-z0-9]+(-[a-z0-9]+)*$`.
- A photo's `album` must be defined in `albums.yaml` (when that file exists; without it, albums are derived from the photos and titled by their slug).
- `w`, `h` are positive integers; `variants` is a non-empty ascending list of positive integers; `formats` is a non-empty list of `webp`, `avif`, `jpeg`.
- `exif` is an allow-list (`camera`, `lens`, `focal`, `aperture`, `iso`, `exposure`). GPS and every other tag are dropped, and the generated images carry no metadata.
- Errors name the file and the field (`gallery/manifest.json: photos[3].w: expected a positive integer`).

Object keys (storage and URL): `albums/<slug>/<id>/<width>.<format>`, uploaded with `Cache-Control: public, max-age=31536000, immutable`. A key never changes content, because the id is the hash of the original. Originals are not uploaded.

## Virtual modules

- `virtual:vuemo-gallery`: the album list (with each cover) and a `loaders` map.
- `virtual:vuemo-gallery/album/<slug>`: the photos of one album. A dynamic import, so each album is its own chunk.

The Vite plugin watches both files (`addWatchFile`, and a full reload in dev) and validates them.

## Config

See also [Configuration](./configuration.md#features).

```ts
gallery: {
  baseUrl: 'https://img.example.com',  // required for storage 'r2'; default '/gallery' for 'local'
  dir: 'gallery',
  widths: [400, 800, 1600, 2400],
  formats: ['webp'],
  exif: 'basic',                       // or false: no EXIF in the manifest
  perPage: 60,
  urlBuilder: 'static',                // or 'cloudflare' (Image Resizing, see below)
  storage: 'r2'                        // or 'local': variants go to public/gallery
}
```

## Page

`gallery.md` with `layout: page` and `<VuemoGallery />` in the body. `?album=<slug>` selects an album and `?photo=<id>` opens the lightbox (both through `useQueryParam`, history replace). `<VuemoGallery album="slug" />` pins one album on a page of its own.

Styling is through `--vuemo-gallery-gap`, `--vuemo-gallery-radius`, `--vuemo-gallery-bg`, `--vuemo-gallery-focus` (and `--vuemo-gallery-row-height`), with fallbacks to VitePress variables and constants.

| Option | Default | Meaning |
| --- | --- | --- |
| `baseUrl` | `/gallery` for `local`, required for `r2` | Public URL of the files. A root-relative one follows the site `base`. |
| `dir` | `gallery` | Folder of `albums.yaml` and `manifest.json`. |
| `widths` | `[400, 800, 1600, 2400]` | Variant widths. Never larger than the original (the first width at or above it is replaced by its own width). |
| `formats` | `['webp']` | `webp`, `avif`, `jpeg`. With several, `<picture>` offers them in order and the last one is the fallback. |
| `exif` | `'basic'` | `false` keeps no EXIF in the manifest. |
| `perPage` | `60` | Photos rendered first, and per "Load more". |
| `urlBuilder` | `'static'` | `'cloudflare'` asks Cloudflare Image Resizing (`/cdn-cgi/image/width=...,format=auto/`) to resize the largest variant on your own domain; enable Image Resizing for the zone first (it is a paid feature on some plans). Not needed for the default setup. |
| `storage` | `'r2'` | `'local'` writes to `public/gallery`. |

## Page

The layout is CSS only (flex-grow follows the aspect ratio, so rows are justified without JavaScript and without layout shift). Every image has `width`, `height` and `aspect-ratio`, `srcset` with `w` descriptors and `sizes`; the first six are eager with `fetchpriority="high"`, the rest lazy. Before an image loads, its average colour (SSR) and then its thumbhash (decoded in the browser) fill the box. The photos are a `<ul role="list">` of links `<a href="?photo=id">`: they work as plain links and in a screen reader, and a click opens the lightbox.

The lightbox is [PhotoSwipe](https://photoswipe.com) 5 (MIT), imported on the first click, so it is not in the page's initial scripts. It has keyboard control (arrows, Escape), returns focus to the photo you opened, and skips animations under `prefers-reduced-motion`. `?photo=<id>` is a deep link; closing removes it. With several albums, `?album=<slug>` selects one. With one visible album, it is shown directly. A `hidden` album is only reachable by link.

Style with CSS variables (all optional): `--vuemo-gallery-gap` (6px), `--vuemo-gallery-radius` (4px), `--vuemo-gallery-bg` (`--vp-c-bg-soft`), `--vuemo-gallery-focus` (`--vp-c-brand-1`), `--vuemo-gallery-row-height` (220px; `--vuemo-gallery-row-height-mobile`, 140px). Dark mode follows your theme's variables.

## Cost and limits

R2 free tier (per month, at the time of writing; check Cloudflare's pricing page): 10 GB-month of storage, 1 million Class A (write, list) operations, 10 million Class B (read) operations, and no egress fees. A personal gallery of a few thousand thumbnails stays inside it. Notes:

- Uploads are Class A operations; `add` does one HEAD (Class B) per file first, so a repeated run is cheap.
- Public buckets can be hotlinked. Add a Cloudflare WAF or hotlink-protection rule on the custom domain if that matters to you.
- This is not for private photos. For those, use a service with access control.

## Local storage and the example

`storage: 'local'` writes the variants into `public/gallery/` and serves them from your own site (`baseUrl` defaults to `/gallery`). It is for trying the gallery, for tests, and for blogs without a domain for a bucket; keep it small, because those files end up in your repository. `examples/blog` uses it with a few generated images (`node scripts/make-demo-gallery.mjs` recreates them), a `/gallery` page and a pinned album page (`<VuemoGallery album="shapes" />`).
