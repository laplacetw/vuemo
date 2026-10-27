import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import Gallery from '../src/Gallery.vue'

const render = (props: object) => renderToString(createSSRApp({ render: () => h(Gallery, props) }))

describe('SSR', () => {
  it('runs without window or document', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
  })

  it('renders the album list with links and covers', async () => {
    const html = await render({})
    expect(html).toContain('role="list"')
    expect(html).toContain('href="?album=a"')
    expect(html).toContain('Album A')
    expect(html).toContain('/vuemo/gallery/albums/a/aaaaaaaaaaaa/800.webp')
  })

  it('renders a pinned album as a list of photo links with sizes and srcset', async () => {
    const html = await render({ album: 'a' })
    expect(html).toContain('<ul class="vuemo-gallery__grid" role="list">')
    expect(html).toContain('<a href="?photo=aaaaaaaaaaaa"')
    expect(html).toContain('width="300" height="200"')
    expect(html).toContain('srcset="/vuemo/gallery/albums/a/aaaaaaaaaaaa/400.webp 400w')
    expect(html).toContain('fetchpriority="high"')
    expect(html).toContain('background-color:#336699')
  })

  it('says so for an unknown album', async () => {
    expect(await render({ album: 'zzz' })).toContain('Unknown album')
  })
})
