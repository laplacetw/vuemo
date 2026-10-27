# Gallery

> Design note. The full guide (including the Cloudflare R2 setup) is added with the last work package.

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

```ts
gallery: {
  baseUrl: 'https://img.example.com',  // required for storage 'r2'; default '/gallery' for 'local'
  dir: 'gallery',
  widths: [400, 800, 1600, 2400],
  formats: ['webp'],
  exif: 'basic',                       // or false: no EXIF in the manifest
  perPage: 60,
  urlBuilder: 'static',                // or 'cloudflare'
  storage: 'r2'                        // or 'local': variants go to public/gallery
}
```

## Page

`gallery.md` with `layout: page` and `<VuemoGallery />` in the body. `?album=<slug>` selects an album and `?photo=<id>` opens the lightbox (both through `useQueryParam`, history replace). `<VuemoGallery album="slug" />` pins one album on a page of its own.

Styling is through `--vuemo-gallery-gap`, `--vuemo-gallery-radius`, `--vuemo-gallery-bg`, `--vuemo-gallery-focus` (and `--vuemo-gallery-row-height`), with fallbacks to VitePress variables and constants.
