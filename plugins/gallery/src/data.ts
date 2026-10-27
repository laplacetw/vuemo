import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { GalleryDataError, deriveAlbums, sortAlbums, validateAlbums, validateManifest } from './schema'
import type { Album, AlbumSummary, Manifest, Photo } from './types'

export const manifestPath = (root: string, dir: string) => join(root, dir, 'manifest.json')
export const albumsPath = (root: string, dir: string) => join(root, dir, 'albums.yaml')

export interface GalleryData {
  manifest: Manifest
  albums: Album[]
}

/** Reads and validates both files. Missing files mean "empty"; invalid ones throw `GalleryDataError`. */
export function readGalleryData(root: string, dir: string): GalleryData {
  const mFile = manifestPath(root, dir)
  const aFile = albumsPath(root, dir)
  let manifest: Manifest = { version: 1, photos: [] }
  if (existsSync(mFile)) {
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(mFile, 'utf8'))
    } catch (e) {
      throw new GalleryDataError(`${dir}/manifest.json`, '', `invalid JSON (${(e as Error).message})`)
    }
    manifest = validateManifest(raw, `${dir}/manifest.json`)
  }
  let albums: Album[]
  if (existsSync(aFile)) {
    let raw: unknown
    try {
      raw = parse(readFileSync(aFile, 'utf8'))
    } catch (e) {
      throw new GalleryDataError(`${dir}/albums.yaml`, '', `invalid YAML (${(e as Error).message})`)
    }
    albums = validateAlbums(raw, manifest.photos, `${dir}/albums.yaml`)
  } else albums = deriveAlbums(manifest.photos)
  return { manifest, albums }
}

export function summarize(albums: Album[], photos: Photo[]): AlbumSummary[] {
  return sortAlbums(albums).map((a) => {
    const own = photos.filter((p) => p.album === a.slug)
    const c = own.find((p) => p.id === a.cover) ?? own[0]
    const { cover: _cover, ...rest } = a
    return {
      ...rest,
      count: own.length,
      ...(c && { cover: { id: c.id, album: c.album, w: c.w, h: c.h, color: c.color, alt: c.alt, variants: c.variants, formats: c.formats } })
    }
  })
}
