import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

const photo = (id: string) => ({ id, w: 300, h: 200, color: '#336699', variants: [400], formats: ['webp'] })
const album = (slug: string, hidden = false) => ({ slug, title: `Album ${slug}`, count: 1, hidden, cover: { ...photo('aaaaaaaaaaaa'), album: slug } })

async function render(albums: any[], query: string) {
  vi.resetModules()
  vi.doMock('virtual:vuemo-gallery', () => ({
    albums,
    loaders: Object.fromEntries(albums.map((a) => [a.slug, async () => ({ default: [photo(a.slug === 'secret' ? 'bbbbbbbbbbbb' : 'aaaaaaaaaaaa')] })]))
  }))
  vi.doMock('@vuemo/core/client', () => ({ useQueryParam: (key: string) => ref(key === 'album' ? query : '') }))
  const { default: Gallery } = await import('../src/Gallery.vue')
  return renderToString(createSSRApp({ render: () => h(Gallery) }))
}

afterEach(() => vi.resetModules())

describe('?album=', () => {
  it('reaches a hidden album even when it is the only album that is listed', async () => {
    const html = await render([album('open'), album('secret', true)], 'secret')
    expect(html).toContain('Album secret')
    expect(html).toContain('vuemo-gallery__grid')
    expect(html).toContain('href="?album=secret&amp;photo=bbbbbbbbbbbb"') // links keep naming the album
    expect(html).toContain('All albums') // back to the visible one
  })
  it('shows the album list without a param, even for a single visible album', async () => {
    const html = await render([album('open'), album('secret', true)], '')
    expect(html).toContain('vuemo-gallery__albums')
    expect(html).toContain('Album open')
    expect(html).not.toContain('Album secret')
    expect(html).not.toContain('vuemo-gallery__grid')
  })
  it('opens the only album when it is named, with a way back to the list', async () => {
    const html = await render([album('open')], 'open')
    expect(html).toContain('vuemo-gallery__grid')
    expect(html).toContain('href="?album=open&amp;photo=aaaaaaaaaaaa"')
    expect(html).toContain('All albums')
  })
  it('ignores an unknown value', async () => {
    const html = await render([album('open'), album('other')], 'nope')
    expect(html).toContain('vuemo-gallery__albums')
  })
})
