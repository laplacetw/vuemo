import type { HeadConfig, PageData } from 'vitepress'

export function postJsonLd(page: PageData, hostname: string | undefined, base = '/'): HeadConfig | undefined {
  const fm = page.frontmatter
  if (!page.relativePath.startsWith('posts/') || !fm.title || !fm.date) return
  const path = base.replace(/\/$/, '') + '/' + page.relativePath.replace(/\.md$/, '')
  const published = new Date(fm.date).getTime()
  // lastUpdated is NaN for untracked files, 0 for missing ones and undefined when the feature is off
  const updated = page.lastUpdated
  const dateModified = Number.isFinite(updated) && updated! > 0 ? new Date(Math.max(published, updated!)).toISOString() : undefined
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: fm.title,
    datePublished: new Date(published).toISOString(),
    ...(dateModified && { dateModified }),
    ...(fm.description && { description: fm.description }),
    ...(fm.tags?.length && { keywords: fm.tags.join(', ') }),
    ...(hostname && { url: hostname.replace(/\/$/, '') + path })
  }
  return ['script', { type: 'application/ld+json' }, JSON.stringify(jsonLd)]
}
