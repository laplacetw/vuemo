import { join } from 'node:path'
import { albumsPath, manifestPath, readGalleryData, summarize } from './data'
import type { ResolvedGalleryConfig } from './types'

export const LIST_ID = 'virtual:vuemo-gallery'
const ALBUM_PREFIX = 'virtual:vuemo-gallery/album/'
const NUL = '\0'

/** Source of `virtual:vuemo-gallery`: the album list and one dynamic import per album. */
export function buildListModule(root: string, dir: string): string {
  const { manifest, albums } = readGalleryData(root, dir)
  const list = summarize(albums, manifest.photos)
  const loaders = albums.map((a) => `${JSON.stringify(a.slug)}: () => import(${JSON.stringify(ALBUM_PREFIX + a.slug)})`)
  return `export const albums = ${JSON.stringify(list)}\nexport const loaders = { ${loaders.join(', ')} }\n`
}

/** Source of `virtual:vuemo-gallery/album/<slug>`: the photos of one album. */
export function buildAlbumModule(root: string, dir: string, slug: string): string {
  const { manifest } = readGalleryData(root, dir)
  const photos = manifest.photos.filter((p) => p.album === slug).map(({ album: _album, ...p }) => p)
  return `export default ${JSON.stringify(photos)}\n`
}

interface DevServerLike {
  watcher: { add(paths: string[]): unknown; on(event: string, listener: (file: string) => void): unknown }
  moduleGraph: { idToModuleMap: Map<string, any>; invalidateModule(mod: any): void }
  ws: { send(payload: { type: 'full-reload' }): void }
}

export function galleryVitePlugin(cfg: ResolvedGalleryConfig) {
  let root = process.cwd()
  return {
    name: 'vuemo:gallery',
    configResolved(config: { root: string; vitepress?: { root?: string } }) {
      root = config.vitepress?.root ?? config.root
    },
    configureServer(server: DevServerLike) {
      const files = [manifestPath(root, cfg.dir), albumsPath(root, cfg.dir)]
      server.watcher.add(files)
      const changed = (file: string) => {
        if (!files.some((f) => join(f) === join(file))) return
        for (const [id, mod] of server.moduleGraph.idToModuleMap) if (id.startsWith(NUL + LIST_ID)) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      for (const event of ['add', 'change', 'unlink']) server.watcher.on(event, changed)
    },
    resolveId: (id: string) => (id === LIST_ID || id.startsWith(ALBUM_PREFIX) ? NUL + id : undefined),
    load(this: { addWatchFile(f: string): void; error(m: string): never }, id: string) {
      if (!id.startsWith(NUL + LIST_ID)) return
      this.addWatchFile(manifestPath(root, cfg.dir))
      this.addWatchFile(albumsPath(root, cfg.dir))
      try {
        return id === NUL + LIST_ID ? buildListModule(root, cfg.dir) : buildAlbumModule(root, cfg.dir, id.slice((NUL + ALBUM_PREFIX).length))
      } catch (e) {
        this.error(`[vuemo-gallery] ${(e as Error).message}`)
      }
    }
  }
}
