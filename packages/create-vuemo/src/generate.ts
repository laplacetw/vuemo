import { basename } from 'node:path'

export type CommentsProvider = 'none' | 'giscus' | 'utterances'

export interface Answers {
  name: string
  title: string
  comments: CommentsProvider
  aiSummary: boolean
  /** Theme package, optionally with a version or range (`name`, `name@^1.2.0`, `@scope/name@latest`). Default: `@vuemo/theme-default`. */
  theme?: string
}

export const DEFAULT_THEME = '@vuemo/theme-default'

/** npm package name rules: lowercase, URL-safe, optional `@scope/`, at most 214 characters. */
export function validPackageName(name: string): boolean {
  return name.length <= 214 && /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)
}

/**
 * Splits `name[@range]` at the last `@` after index 0 (so a scope's `@` is never taken for a version).
 * Without a range it is `latest`. Throws on an invalid package name or an empty range.
 */
export function parseThemeSpec(spec: string): { name: string; range: string } {
  const text = spec.trim()
  const at = text.lastIndexOf('@')
  const name = at > 0 ? text.slice(0, at) : text
  const range = at > 0 ? text.slice(at + 1) : 'latest'
  if (!validPackageName(name)) throw new Error(`"${name}" is not a valid npm package name (theme "${spec}")`)
  if (!range.trim() || /[\x00-\x1f\x7f]/.test(range)) throw new Error(`"${range}" is not a valid version or range (theme "${spec}")`)
  return { name, range }
}

interface Versions {
  core: string
  theme: string
  comments: string
  aiSummary: string
  vitepress: string
  vue: string
  mathjax: string
  vitest: string
}

/** Injected from the workspace packages at build time (see tsup.config.ts). */
declare const __VERSIONS__: Versions | undefined

/** Dependency ranges of the generated project. */
export const VERSIONS: Versions =
  typeof __VERSIONS__ === 'undefined'
    ? { core: '*', theme: '*', comments: '*', aiSummary: '*', vitepress: '*', vue: '*', mathjax: '*', vitest: '*' }
    : __VERSIONS__

/** The chosen theme package; the default theme (with the version released together with this scaffolder) when none is given. */
function themeOf(a: Answers): { name: string; range: string } {
  if (!a.theme?.trim()) return { name: DEFAULT_THEME, range: VERSIONS.theme }
  const spec = a.theme.trim()
  const { name, range } = parseThemeSpec(spec)
  return name === DEFAULT_THEME && !spec.includes('@', 1) ? { name, range: VERSIONS.theme } : { name, range }
}

export function packageJson(a: Answers): string {
  const theme = themeOf(a)
  // Official plugins are always installed, so turning a feature on only takes a config edit.
  const dependencies: Record<string, string> = {
    '@vuemo/core': VERSIONS.core,
    [theme.name]: theme.range,
    '@vuemo/plugin-comments': VERSIONS.comments,
    '@vuemo/plugin-ai-summary': VERSIONS.aiSummary,
    'markdown-it-mathjax3': VERSIONS.mathjax,
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

/** A single-quoted TypeScript string literal, like the rest of the generated config. */
export function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}'`
}

export function configTs(a: Answers): string {
  // written explicitly only for a theme other than the default one
  const { name } = themeOf(a)
  const themeLine = name === DEFAULT_THEME ? "  theme: '@vuemo/theme-default',\n" : `  theme: ${quote(name)},\n`
  const aiSummary = a.aiSummary ? "{ api: 'https://YOUR-WORKER.workers.dev' } // see the plugin README" : 'false'

  // the references load the plugins' types, so `comments` and `aiSummary` type-check in the editor and under tsc
  return `/// <reference types="@vuemo/plugin-comments" />
/// <reference types="@vuemo/plugin-ai-summary" />
import { defineBlogConfig } from '@vuemo/core'

export default defineBlogConfig({
  // site
  title: ${quote(a.title)},
  description: 'A blog powered by Vuemo',
  lang: 'en',
  hostname: 'https://example.com',

  // theme
${themeLine}  postsPerPage: 5,
  search: true, // local full-text search
  nav: [
    { text: 'Home', link: '/' },
    { text: 'Archives', link: '/archives' },
    { text: 'Category', link: '/category' },
    { text: 'Tags', link: '/tags' },
    { text: 'About', link: '/about' }
  ],

  // Markdown: math ($...$ and $$...$$) needs markdown-it-mathjax3, installed by default
  markdown: { math: true },

  // features: set a key to enable it, use \`false\` to disable it${a.comments === 'none' ? "\n  // comments: { provider: 'utterances', repo: 'user/comments-repo' }" : ''}
  comments: ${COMMENTS[a.comments]},
  aiSummary: ${aiSummary}
})
`
}

export interface ThemeAnswers {
  /** Package name: `vuemo-theme-<name>` or `@scope/vuemo-theme-<name>`. */
  name: string
}

/** The `package.json` of a theme starter: core, vitepress and vue are peers (and dev dependencies for the example). */
export function themePackageJson(a: ThemeAnswers): string {
  const peers = { '@vuemo/core': VERSIONS.core, vitepress: '^1.6.0', vue: '^3.5.0' }
  return JSON.stringify(
    {
      name: a.name,
      version: '0.0.0',
      type: 'module',
      description: 'A Vuemo theme',
      license: 'MIT',
      exports: { '.': './src/index.ts' },
      files: ['src'],
      keywords: ['vuemo-theme'],
      scripts: {
        dev: 'vitepress dev example',
        'build:example': 'vitepress build example',
        check: 'vuemo check-theme ./src/index.ts',
        test: 'vitest run'
      },
      peerDependencies: peers,
      devDependencies: { ...peers, vitest: VERSIONS.vitest }
    },
    null,
    2
  ) + '\n'
}

/** A name without the `vuemo-theme-` prefix is valid but gets a hint. */
export function hasThemePrefix(name: string): boolean {
  return /^(@[^/]+\/)?vuemo-theme-./.test(name)
}

/** A project directory name that is also a valid (unscoped, lowercase) npm package name. */
export function validName(name: string): boolean {
  return !name.includes('/') && validPackageName(name)
}

/**
 * The argument of `--template theme`: a scoped package name (`@scope/vuemo-theme-x`, created in `./vuemo-theme-x`)
 * or a directory path (`./themes/vuemo-theme-x`), whose basename is the package name.
 */
export function themeTarget(arg: string): { name: string; dir: string } {
  const text = arg.trim()
  if (/^@[^/\\]+\/[^/\\]+$/.test(text)) return { name: text, dir: text.slice(text.indexOf('/') + 1) }
  const dir = text.replace(/[\\/]+$/, '')
  return { name: basename(dir), dir }
}
