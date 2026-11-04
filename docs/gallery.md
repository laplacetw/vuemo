# Gallery

A photo gallery for any Vuemo theme: album list, justified rows, a lightbox, and a CLI that makes thumbnails and uploads them to Cloudflare R2 (or into `public/`). Photos are never read from the file system by the theme: the build only sees `gallery/manifest.json` and the image URLs.

Contents: [Quick start](#quick-start), [Cloudflare R2 setup](#cloudflare-r2-setup-first-time), [CLI](#cli), [Design](#design), [Data](#data), [Config](#config), [Page and styling](#page-and-styling), [Layout and lightbox](#layout-and-lightbox), [Cost and limits](#cost-and-limits), [Local storage and the example](#local-storage-and-the-example).

## Quick start

```sh
pnpm add @vuemo/plugin-gallery
pnpm add -D sharp        # only the CLI needs it (thumbnails); or npm i -D sharp / yarn add -D sharp
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

1. **Enable R2.** Cloudflare dashboard (the menu names below are from memory: verify them against the current dashboard, they move), left sidebar, **Storage & databases** > **R2 object storage** > **Overview**. Follow the prompts to add a payment method and enable R2.
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

   Plain `<img>` tags (and CSS backgrounds) work without CORS, and so does the lightbox, which also shows plain `<img>` elements. CORS is only needed if you (or a plugin) read the images with `fetch()` or draw them to a `<canvas>`. Adding your origin does no harm. For local development add `http://localhost:5173` while you work.
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

**One bucket, or one key prefix, per site.** `sync --prune` treats every object under `albums/` that the manifest does not list as garbage. If two sites (or a site and something else) share a bucket and the `albums/` prefix, pruning one deletes the other's photos. Give each site its own bucket. The CLI guards against the obvious mistakes (see `sync` below), but it cannot know what else lives in the bucket.

Notes: originals are not uploaded; keep them yourself. The generated files are immutable (`Cache-Control: public, max-age=31536000, immutable`; the key contains the hash of the original), so changing a photo means a new id, not an overwrite. The gallery is for photos you are happy to publish: the bucket is public, and anyone who has a URL can fetch it. Do not use it for private photos.

## CLI

`vuemo-gallery` is the plugin's bin (run it with `pnpm vuemo-gallery ...`, or `npx`; `--help` prints the usage). It finds the project (the nearest folder up from where you run it that has a `.vitepress` folder or a `vuemo.config.*`; `--root <dir>` names it) and resolves its VitePress config to read the `gallery` settings, the site root (where `gallery/` is) and `srcDir` (where `public/` is). If the config cannot be loaded the command fails and prints the error. If the project has no `gallery` settings, nothing is guessed: pass `--storage <r2|local>` (and `--dir`, `--base-url`), or use `--no-config` to ignore the config on purpose. When the config has settings, `--storage`, `--dir` and `--base-url` are ignored (with a warning). `storage: 'local'` writes to `<srcDir>/public` plus the path of `baseUrl` (`/gallery` gives `public/gallery`; `baseUrl` must be root-relative).

| Command | What it does |
| --- | --- |
| `add <dir> --album <slug> [--alt-from-filename]` | Reads every image under `<dir>` (jpg, png, webp, avif, tiff, gif), makes `widths` x `formats` variants, uploads the missing ones, adds the photo to the manifest. A photo already in the manifest (same content) is skipped; missing files of it are restored. `--alt-from-filename` uses the file name without its extension (`DSC01131`) as the alt text of new photos and of listed photos that have none, so it can be run again on photos already uploaded (nothing is uploaded twice). |
| `sync [--prune [--yes] [--force]]` | Compares the storage with the manifest: lists missing files (exit code 1, re-run `add` with the originals) and unlisted ones. `--prune` deletes the unlisted ones, with guards: it refuses when `manifest.json` does not exist; it asks `y/N` on a terminal (it lists the objects first) and refuses on a non-terminal unless you pass `--yes`; it refuses to delete **every** object under `albums/` (an empty manifest, or a manifest that matches nothing in the storage, for example the wrong bucket) unless you pass `--force`. The same applies to `storage: 'local'`. |
| `verify [--remote]` | Validates the manifest and `albums.yaml`, warns about missing `alt`, and checks that files exist (always for `local`, with `--remote` for R2). |
| `remove <id>` | Deletes a photo's files and its manifest entry. It refuses when the photo is the `cover` of an album (change `cover` in `albums.yaml` first; exit code 1). |

YAML reads an id that is only digits (or looks like `1234e5678901`) as a number. Write ids in `albums.yaml` in quotes: `cover: "123456789012"`. The CLI prints ids in quotes for that reason.

Edit `alt`, `caption` and `takenAt` in `gallery/manifest.json` by hand: `add` never overwrites them. A photo without `alt` gets a warning on `add` and `verify`; write a short description of what the photo shows (a purely decorative photo can use `"alt": ""`, which silences the warning).

Privacy: the generated images carry no metadata at all (no EXIF, no GPS). The manifest keeps only the allow-listed `exif` fields below, and none of them with `exif: false`. `takenAt` is not part of the `exif` block: it is the date the photo was taken (EXIF `DateTimeOriginal`), it orders the photos of an album, and it is kept with `exif: false` too (delete it from the manifest by hand if you do not want it). An EXIF date is a wall-clock time without a time zone: with an `OffsetTimeOriginal` in the file `takenAt` is the exact instant; without one the wall-clock time is stored as if it were UTC (`17:03:00` is `17:03:00.000Z`), so the result does not depend on the machine's time zone.

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
      "takenAt": "2025-04-12T17:03:00.000Z", // optional (see the CLI notes on time zones)
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
- Photo keys are an allow-list too (`id`, `album`, `w`, `h`, `color`, `thumbhash`, `alt`, `caption`, `takenAt`, `exif`, `variants`, `formats`); `thumbhash` must be base64.
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
  // longEdge: 1600,             // cap the long edge (portrait photos get narrower variants)
  formats: ['webp'],
  exif: 'basic',                       // or false: no EXIF in the manifest
  perPage: 60,
  urlBuilder: 'static',                // or 'cloudflare' (Image Resizing, see below)
  storage: 'r2'                        // or 'local': variants go to public/gallery
}
```

## Page and styling

`gallery.md` with `layout: page` and `<VuemoGallery />` in the body. It opens on the album list (covers and titles), also when there is a single album; `?album=<slug>` selects an album and `?photo=<id>` opens the lightbox (both through `useQueryParam`: choosing an album pushes a history entry so Back returns to the list; the lightbox pushes one too and closing it removes `?photo`). `<VuemoGallery album="slug" />` pins one album on a page of its own.

Styling is through `--vuemo-gallery-gap`, `--vuemo-gallery-radius`, `--vuemo-gallery-bg`, `--vuemo-gallery-focus` (and `--vuemo-gallery-row-height`), with fallbacks to VitePress variables and constants.

| Option | Default | Meaning |
| --- | --- | --- |
| `baseUrl` | `/gallery` for `local`, required for `r2` | Public URL of the files. A root-relative one follows the site `base`. |
| `dir` | `gallery` | Folder of `albums.yaml` and `manifest.json`. |
| `widths` | `[400, 800, 1600, 2400]` | Variant widths. Never larger than the original (the first width at or above it is replaced by its own width). |
| `longEdge` | none | Largest long edge in pixels. A portrait photo gets narrower variants so that its height stays within it: with `widths: [1600], longEdge: 1600`, a 3000 x 4000 photo becomes 1200 x 1600 and a 4000 x 3000 one 1600 x 1200. |
| `formats` | `['webp']` | `webp`, `avif`, `jpeg`. With several, `<picture>` offers them in order and the last one is the fallback. |
| `exif` | `'basic'` | `false` keeps no EXIF in the manifest. |
| `perPage` | `60` | Photos rendered first, and per "Load more". |
| `urlBuilder` | `'static'` | `'cloudflare'` asks Cloudflare Image Transformations (formerly Image Resizing) to resize the largest variant: the URL is `<origin of baseUrl>/cdn-cgi/image/width=...,format=auto,.../<path of baseUrl>/albums/...`, so `baseUrl: 'https://example.com/photos'` gives `https://example.com/cdn-cgi/image/.../photos/albums/...`. Transformations must be enabled for the zone (the dashboard section is called **Images** > **Transformations**; verify the name and the plan limits against the current dashboard and Cloudflare's pricing page). Not needed for the default setup. |
| `storage` | `'r2'` | `'local'` writes to `public/gallery`. |

## Layout and lightbox

The layout is CSS only (flex-grow follows the aspect ratio, so rows are justified without JavaScript and without layout shift). Every image has `width`, `height` and `aspect-ratio`, `srcset` with `w` descriptors and `sizes`; the first six are eager with `fetchpriority="high"`, the rest lazy. Before an image loads, its average colour (SSR) and then its thumbhash (decoded in the browser) fill the box. The photos are a `<ul role="list">` of links `<a href="?photo=id">`: they work as plain links and in a screen reader, and a click opens the lightbox.

The lightbox is [PhotoSwipe](https://photoswipe.com) 5 (MIT), imported on the first click, so it is not in the page's initial scripts. It has keyboard control (arrows, Escape), returns focus to the photo you opened, and skips animations under `prefers-reduced-motion`. `?photo=<id>` is a deep link; closing removes it. With several albums, `?album=<slug>` selects one. With one visible album, it is shown directly; `?album=<slug>` is checked first, so a `hidden` album is reachable by link even then (and only by link). Closing a lightbox that was opened by a deep link puts the focus on that photo's thumbnail.

Style with CSS variables (all optional): `--vuemo-gallery-gap` (6px), `--vuemo-gallery-radius` (4px), `--vuemo-gallery-bg` (`--vp-c-bg-soft`), `--vuemo-gallery-focus` (`--vp-c-brand-1`), `--vuemo-gallery-row-height` (220px; `--vuemo-gallery-row-height-mobile`, 140px). The `sizes` attribute follows these when they are set in pixels (read in the browser after hydration; the server renders the defaults). Dark mode follows your theme's variables.

The lightbox shows the photo's `caption` (if you wrote one; `alt` is for screen readers and is not shown) and a line with the camera data from the manifest: camera, lens, focal length, aperture, shutter, ISO and the date (`SONY DSC-RX100M7 · Sony 24-200mm F2.8-4.5 · 26.9mm · f/4 · 1/125s · ISO 640 · 2026-09-17`). With `exif: false` only the date is shown.

## Cost and limits

R2 free tier (per month, at the time of writing; check Cloudflare's pricing page): 10 GB-month of storage, 1 million Class A (write, list) operations, 10 million Class B (read) operations, and no egress fees. A personal gallery of a few thousand thumbnails stays inside it. Notes:

- Uploads are Class A operations; `add` does one HEAD (Class B) per file first, so a repeated run is cheap.
- Public buckets can be hotlinked. Add a Cloudflare WAF or hotlink-protection rule on the custom domain if that matters to you.
- This is not for private photos. For those, use a service with access control.

## Local storage and the example

`storage: 'local'` writes the variants into `public/gallery/` and serves them from your own site (`baseUrl` defaults to `/gallery`). It is for trying the gallery, for tests, and for blogs without a domain for a bucket; keep it small, because those files end up in your repository. `examples/blog` uses it with a few generated images (`node scripts/make-demo-gallery.mjs` recreates them), a `/gallery` page and a pinned album page (`<VuemoGallery album="shapes" />`).
