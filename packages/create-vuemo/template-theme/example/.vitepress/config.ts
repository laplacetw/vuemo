import { fileURLToPath } from 'node:url'
import { defineBlogConfig } from '@vuemo/core'

export default defineBlogConfig({
  title: 'Theme Example',
  description: 'A blog to try the theme with',
  lang: 'en',

  // an absolute path to the theme entry works like a package name (use the package name once it is installed)
  theme: fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
  postsPerPage: 1,
  nav: [
    { text: 'Home', link: '/' },
    { text: 'Archives', link: '/archives' },
    { text: 'Category', link: '/category' },
    { text: 'Tags', link: '/tags' },
    { text: 'About', link: '/about' }
  ],
  footer: { message: 'Built with Vuemo', copyright: '© Your Name' },

  // theme-specific options go in `themeConfig` (see src/types.ts)
  themeConfig: { readMoreText: 'Read more →' },

  // To see the plugin slots (comments area) render, turn a feature on after installing its plugin:
  // comments: { provider: 'utterances', repo: 'user/comments-repo' }
})
