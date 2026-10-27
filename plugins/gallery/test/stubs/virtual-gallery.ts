const mk = (id: string, album: string, w: number, h: number) => ({ id, album, w, h, color: '#336699', alt: `alt ${id}`, variants: [400, 800], formats: ['webp'] })
const photos = [mk('aaaaaaaaaaaa', 'a', 300, 200), mk('bbbbbbbbbbbb', 'a', 200, 300), mk('cccccccccccc', 'a', 300, 300)]
export const albums = [
  { slug: 'a', title: 'Album A', count: 3, cover: photos[0] },
  { slug: 'b', title: 'Album B', count: 0 }
]
export const loaders: Record<string, () => Promise<{ default: any[] }>> = {
  a: async () => ({ default: photos.map(({ album, ...p }) => p) }),
  b: async () => ({ default: [] })
}
