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
    expect(html).toContain('href="?album=a" target="_self"') // target keeps VitePress's router (scroll to top) off the link
    expect(html).toContain('Album A')
    expect(html).toContain('/vuemo/gallery/albums/a/aaaaaaaaaaaa/800.webp')
  })

  it('renders a pinned album as a list of photo links with sizes and srcset', async () => {
    const html = await render({ album: 'a' })
    expect(html).toContain("vuemo-gallery__grid")
    expect(html).toContain('<a href="?photo=aaaaaaaaaaaa" target="_self"')
    expect(html).toContain('width="300" height="200"')
    expect(html).toContain('srcset="/vuemo/gallery/albums/a/aaaaaaaaaaaa/400.webp 400w')
    expect(html).toContain('fetchpriority="high"')
    expect(html).toContain('background-color:#336699')
  })

  it('says so for an unknown album', async () => {
    expect(await render({ album: 'zzz' })).toContain('Unknown album')
  })
})

describe('pagination', () => {
  it('renders only perPage photos at SSR and a Load more button for the rest', async () => {
    const html = await render({ album: 'a' }) // perPage is 2 in the test config, the album has 3 photos
    expect(html.match(/<li class="vuemo-gallery__item"/g)).toHaveLength(2)
    expect(html).not.toContain('cccccccccccc')
    expect(html).toContain('Load more (1 left)')
  })
})
