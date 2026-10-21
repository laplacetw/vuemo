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
  const dependencies: Record<string, string> = {
    '@vuemo/core': VERSIONS.core,
    '@vuemo/theme-default': VERSIONS.theme
  }
  if (a.comments !== 'none') dependencies['@vuemo/plugin-comments'] = VERSIONS.comments
  if (a.aiSummary) dependencies['@vuemo/plugin-ai-summary'] = VERSIONS.aiSummary
  dependencies.vitepress = VERSIONS.vitepress
  dependencies.vue = VERSIONS.vue

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

export function configTs(a: Answers): string {
  const imports = ["import { defineBlogConfig } from '@vuemo/core'"]
  const plugins: string[] = []

  if (a.comments === 'giscus') {
    imports.push("import comments from '@vuemo/plugin-comments'")
    plugins.push(`    // Get repoId / categoryId from https://giscus.app
    comments({
      provider: 'giscus',
      options: { repo: 'user/repo', repoId: 'YOUR_REPO_ID', category: 'Announcements', categoryId: 'YOUR_CATEGORY_ID' }
    })`)
  } else if (a.comments === 'utterances') {
    imports.push("import comments from '@vuemo/plugin-comments'")
    plugins.push("    comments({ provider: 'utterances', options: { repo: 'user/repo' } })")
  }
  if (a.aiSummary) {
    imports.push("import aiSummary from '@vuemo/plugin-ai-summary'")
    plugins.push("    // Your Cloudflare Worker, see the plugin README\n    aiSummary({ api: 'https://YOUR-WORKER.workers.dev' })")
  }

  return `${imports.join('\n')}

export default defineBlogConfig({
  title: ${JSON.stringify(a.title)},
  description: 'A blog powered by Vuemo',
  hostname: 'https://example.com',
  themeConfig: {
    postsPerPage: 5,
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Archives', link: '/archives' },
      { text: 'Category', link: '/category' },
      { text: 'Tags', link: '/tags' },
      { text: 'About', link: '/about' }
    ]
  }${plugins.length ? `,\n  plugins: [\n${plugins.join(',\n')}\n  ]` : ''}
})
`
}

export function validName(name: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/i.test(name)
}
