import { defineBlogConfig } from '@vuemo/core'
import comments from '@vuemo/plugin-comments'
import aiSummary from '@vuemo/plugin-ai-summary'

export default defineBlogConfig({
  // GitHub Pages serves the example under /vuemo/; the workflow sets BASE
  base: process.env.BASE ?? '/',
  title: 'Vuemo Blog',
  description: 'A blog powered by Vuemo',
  lang: 'en',
  hostname: 'https://example.com',
  plugins: [
    comments({
      provider: 'giscus',
      options: { repo: 'laplacetw/vuemo', repoId: 'REPO_ID', category: 'Announcements', categoryId: 'CATEGORY_ID' }
    }),
    aiSummary({ api: 'https://vuemo-summary.example.workers.dev' })
  ],
  themeConfig: {
    postsPerPage: 2,
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Archives', link: '/archives' },
      { text: 'Category', link: '/category' },
      { text: 'Tags', link: '/tags' },
      { text: 'About', link: '/about' }
    ],
    footer: 'Powered by <a href="https://vitepress.dev">VitePress</a> · Vuemo'
  }
})
