export type ImageFormat = 'webp' | 'avif' | 'jpeg'

export interface GalleryConfig {
  /** Where the images are served from. Required for storage 'r2'; default `/gallery` for 'local' (resolved against the site base). */
  baseUrl?: string
  /** Directory of `albums.yaml` and `manifest.json`, relative to the project root. Default `gallery`. */
  dir?: string
  /** Widths of the generated variants. Default `[400, 800, 1600, 2400]`. */
  widths?: number[]
  /** Default `['webp']`. */
  formats?: ImageFormat[]
  /** `'basic'` keeps the allow-listed EXIF fields in the manifest, `false` keeps none. Default `'basic'`. */
  exif?: false | 'basic'
  /** Photos rendered first and per "Load more". Default 60. */
  perPage?: number
  /** `'static'` (default): the generated variants. `'cloudflare'`: Cloudflare Image Resizing (`/cdn-cgi/image/`) on your domain. */
  urlBuilder?: 'static' | 'cloudflare'
  /** `'r2'` (default) uploads to Cloudflare R2; `'local'` writes into `public/gallery`. */
  storage?: 'r2' | 'local'
}

/** The config after defaults; this is what the client and the CLI read. */
export interface ResolvedGalleryConfig {
  baseUrl: string
  dir: string
  widths: number[]
  formats: ImageFormat[]
  exif: false | 'basic'
  perPage: number
  urlBuilder: 'static' | 'cloudflare'
  storage: 'r2' | 'local'
}

export interface ExifInfo {
  camera?: string
  lens?: string
  focal?: number
  aperture?: number
  iso?: number
  exposure?: string
}

export interface Photo {
  id: string
  album: string
  w: number
  h: number
  color: string
  thumbhash?: string
  alt?: string
  caption?: string
  takenAt?: string
  exif?: ExifInfo
  variants: number[]
  formats: ImageFormat[]
}

export interface Manifest {
  version: 1
  photos: Photo[]
}

export interface Album {
  slug: string
  title: string
  description?: string
  cover?: string
  date?: string
  order?: number
  hidden?: boolean
}

export interface AlbumSummary extends Omit<Album, 'cover'> {
  count: number
  cover?: Pick<Photo, 'id' | 'w' | 'h' | 'color' | 'alt' | 'variants' | 'formats'>
}
