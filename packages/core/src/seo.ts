import type { HeadConfig, PageData } from 'vitepress'

export function postJsonLd(page: PageData, hostname: string | undefined, base = '/'): HeadConfig | undefined {
  const fm = page.frontmatter
  if (!page.relativePath.startsWith('posts/') || !fm.title || !fm.date) return
  const path = base.replace(/\/$/, '') + '/' + page.relativePath.replace(/\.md$/, '')
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: fm.title,
    datePublished: new Date(fm.date).toISOString(),
    ...(fm.description && { description: fm.description }),
    ...(fm.tags?.length && { keywords: fm.tags.join(', ') }),
    ...(hostname && { url: hostname.replace(/\/$/, '') + path })
  }
  return ['script', { type: 'application/ld+json' }, JSON.stringify(jsonLd)]
}
