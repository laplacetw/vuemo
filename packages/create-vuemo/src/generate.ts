export type CommentsProvider = 'none' | 'giscus' | 'utterances'

export interface Answers {
  name: string
  title: string
  comments: CommentsProvider
  aiSummary: boolean
}

/** Dependency ranges of the generated project. */
export const VERSIONS = {
  core: '^0.0.0',
  theme: '^0.0.0',
  comments: '^0.0.0',
  aiSummary: '^0.0.0',
  vitepress: '^1.6.4',
  vue: '^3.5.0'
}

export function packageJson(a: Answers): string {
  // Official plugins are always installed, so turning a feature on only takes a config edit.
  const dependencies: Record<string, string> = {
    '@vuemo/core': VERSIONS.core,
    '@vuemo/theme-default': VERSIONS.theme,
    '@vuemo/plugin-comments': VERSIONS.comments,
    '@vuemo/plugin-ai-summary': VERSIONS.aiSummary,
    vitepress: VERSIONS.vitepress,
    vue: VERSIONS.vue
  }

  return JSON.stringify(
    {
      name: a.name,
      private: true,
      type: 'module',
      scripts: { dev: 'vitepress dev', build: 'vitepress build', preview: 'vitepress preview', new: 'vuemo new' },
      dependencies
    },
    null,
    2
  ) + '\n'
}

const COMMENTS: Record<CommentsProvider, string> = {
  none: 'false',
  utterances: "{ provider: 'utterances', repo: 'user/comments-repo' }",
  giscus: `{
    provider: 'giscus',
    repo: 'user/repo',
    repoId: 'YOUR_REPO_ID', // from https://giscus.app
    category: 'Announcements',
    categoryId: 'YOUR_CATEGORY_ID'
  }`
}

export function configTs(a: Answers): string {
  const aiSummary = a.aiSummary ? "{ api: 'https://YOUR-WORKER.workers.dev' } // see the plugin README" : 'false'

  return `import { defineBlogConfig } from '@vuemo/core'

export default defineBlogConfig({
  // site
  title: ${JSON.stringify(a.title)},
  description: 'A blog powered by Vuemo',
  lang: 'en',
  hostname: 'https://example.com',

  // theme
  theme: '@vuemo/theme-default',
  postsPerPage: 5,
  nav: [
    { text: 'Home', link: '/' },
    { text: 'Archives', link: '/archives' },
    { text: 'Category', link: '/category' },
    { text: 'Tags', link: '/tags' },
    { text: 'About', link: '/about' }
  ],

  // features: set a key to enable it, use \`false\` to disable it${a.comments === 'none' ? "\n  // comments: { provider: 'utterances', repo: 'user/comments-repo' }" : ''}
  comments: ${COMMENTS[a.comments]},
  aiSummary: ${aiSummary}
})
`
}

export function validName(name: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/i.test(name)
}
