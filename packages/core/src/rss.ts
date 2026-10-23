import type { Post } from './schema'

export interface RssOptions {
  title: string
  description?: string
  /** Site origin, e.g. https://example.com */
  hostname: string
  /** VitePress `base`. Default `/`. */
  base?: string
  lang?: string
  /** Newest posts to include. Default 20. */
  limit?: number
}

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** RSS 2.0 for the newest `limit` posts. `posts` must be sorted newest first. */
export function buildRss(posts: Post[], options: RssOptions): string {
  const origin = options.hostname.replace(/\/$/, '')
  const base = (options.base ?? '/').replace(/\/$/, '')
  const items = posts.slice(0, options.limit ?? 20).map((post) => {
    const link = `${origin}${base}${post.url}`
    const summary = post.description ?? post.excerpt
    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${new Date(post.date.time).toUTCString()}</pubDate>${
        summary ? `\n      <description>${escapeXml(summary)}</description>` : ''
      }
    </item>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(options.title)}</title>
    <link>${escapeXml(`${origin}${base}/`)}</link>
    <description>${escapeXml(options.description ?? options.title)}</description>${
      options.lang ? `\n    <language>${escapeXml(options.lang)}</language>` : ''
    }
${items.join('\n')}
  </channel>
</rss>
`
}
