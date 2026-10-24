import { defineBlogConfig } from '@vuemo/core'

export default defineBlogConfig({
  // site
  title: 'Vuemo Blog',
  description: 'A blog powered by Vuemo',
  lang: 'en',
  // GitHub Pages serves the example under /vuemo/; the workflow sets BASE
  base: process.env.BASE ?? '/',
  hostname: 'https://example.com',

  // theme
  theme: '@vuemo/theme-default',
  logo: '/logo.svg',
  socialLinks: [{ icon: 'github', link: 'https://github.com/laplacetw/vuemo' }],
  postsPerPage: 2,
  nav: [
    { text: 'Home', link: '/' },
    { text: 'Archives', link: '/archives' },
    { text: 'Category', link: '/category' },
    { text: 'Tags', link: '/tags' },
    { text: 'About', link: '/about' }
  ],
  search: true,
  markdown: { lineNumbers: true },
  footer: {
    message: 'Powered by <a href="https://vitepress.dev">VitePress</a> · Vuemo',
    copyright: 'Copyright © 2025 Vuemo Blog'
  },

  // features: set a key to enable it, remove it or use `false` to disable it
  comments: { provider: 'utterances', repo: 'laplacetw/vuemo-comments' },
  aiSummary: false
})
