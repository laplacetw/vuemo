import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Manifest, Photo } from '../types'

const KEYS = ['id', 'album', 'w', 'h', 'color', 'thumbhash', 'alt', 'caption', 'takenAt', 'exif', 'variants', 'formats'] as const
const EXIF_KEYS = ['camera', 'lens', 'focal', 'aperture', 'iso', 'exposure'] as const

function ordered(p: Photo): Photo {
  const o: Record<string, unknown> = {}
  for (const k of KEYS) {
    const v = (p as any)[k]
    if (v === undefined) continue
    o[k] = k === 'exif' ? Object.fromEntries(EXIF_KEYS.filter((e) => v[e] !== undefined).map((e) => [e, v[e]])) : v
  }
  return o as unknown as Photo
}

/** Sorted by album, then takenAt (photos without one last), then id; fixed key order. The same photos always give the same bytes. */
export function serializeManifest(manifest: Manifest): string {
  const photos = [...manifest.photos].sort(
    (a, b) => a.album.localeCompare(b.album) || (a.takenAt ?? '￿').localeCompare(b.takenAt ?? '￿') || a.id.localeCompare(b.id)
  )
  return JSON.stringify({ version: 1, photos: photos.map(ordered) }, null, 2) + '\n'
}

export function writeManifest(file: string, manifest: Manifest) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, serializeManifest(manifest))
}

export const keysOf = (p: Pick<Photo, 'album' | 'id' | 'variants' | 'formats'>, key: (album: string, id: string, w: number, f: any) => string) =>
  p.formats.flatMap((f) => p.variants.map((w) => key(p.album, p.id, w, f)))
