#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createInterface } from 'node:readline/promises'
import {
  DEFAULT_THEME,
  hasThemePrefix,
  parseThemeSpec,
  themeInstall,
  themeTarget,
  validName,
  validPackageName,
  type Answers,
  type CommentsProvider
} from './generate'
import { scaffoldBlog, scaffoldTheme } from './scaffold'

const USAGE = `Usage: create-vuemo [dir] [options]

  npm create vuemo@latest my-blog

Options:
  --template <blog|theme>              what to create (asked when omitted)
  --theme <name|package>               blog only: the theme (default @vuemo/theme-default)
  --comments <none|giscus|utterances>  blog only: the comments provider
  --ai-summary                         blog only: add the AI summary plugin
  -y, --yes                            do not ask, use the defaults
  -h, --help                           show this help`

let parsed: ReturnType<typeof parse>
function parse() {
  return parseArgs({
    allowPositionals: true,
    options: {
      yes: { type: 'boolean', short: 'y' },
      template: { type: 'string' },
      comments: { type: 'string' },
      'ai-summary': { type: 'boolean' },
      theme: { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    }
  })
}
try {
  parsed = parse()
} catch (e) {
  console.error(`[ERROR]: ${(e as Error).message}\n\n${USAGE}`)
  process.exit(1)
}
const { values, positionals } = parsed
if (values.help) {
  console.log(USAGE)
  process.exit(0)
}

const PROVIDERS = ['none', 'giscus', 'utterances']
const TEMPLATES = ['blog', 'theme']

const dirArg = positionals[0]
const interactive = !values.yes && process.stdin.isTTY
const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : undefined
const prompt = async (question: string, fallback: string) =>
  ((await rl?.question(`${question} (${fallback}) `)) ?? '').trim() || fallback

function fail(message: string): never {
  console.error(`[ERROR]: ${message}`)
  process.exit(1)
}

/** Creates the target directory; refuses a non-empty one. */
function prepare(dir: string): string {
  const target = resolve(process.cwd(), dir)
  if (existsSync(target) && readdirSync(target).length) fail(`${target} is not empty`)
  mkdirSync(target, { recursive: true })
  return target
}

const here = dirname(fileURLToPath(import.meta.url))

async function blog() {
  const name = dirArg ?? (await prompt('Project name', 'my-blog'))
  const title = await prompt('Blog title', name)
  const comments = (values.comments ?? (await prompt('Comments [none/giscus/utterances]', 'none'))) as CommentsProvider
  const aiSummary = values['ai-summary'] ?? /^y/i.test(await prompt('Add AI summary plugin? [y/N]', 'N'))
  const theme = values.theme ?? (await prompt('Theme (short name like trigger, or a package)', DEFAULT_THEME))
  rl?.close()

  if (!PROVIDERS.includes(comments)) fail(`Unknown comments provider "${comments}". Use: ${PROVIDERS.join(', ')}`)
  try {
    parseThemeSpec(theme)
  } catch (error) {
    fail((error as Error).message)
  }
  const answers: Answers = { name, title, comments, aiSummary, theme }
  const install = themeInstall(theme)
  if (install) console.log(`installing ${install.pkg} (from --theme ${theme})`)

  const projectName = basename(resolve(process.cwd(), name))
  if (!validName(projectName)) fail(`"${projectName}" is not a valid project name`)
  scaffoldBlog(join(here, '../template'), prepare(name), { ...answers, name: projectName })

  console.log(`
Created ${projectName}. Next:

  cd ${name}
  pnpm install   # or npm install
  pnpm dev
  pnpm new my-first-post
`)
}

async function theme() {
  // a package name (`vuemo-theme-<name>`, `@scope/vuemo-theme-<name>`: the directory is `vuemo-theme-<name>`) or a path whose basename is the package name
  const { name, dir } = themeTarget(dirArg ?? (await prompt('Theme package name', 'vuemo-theme-my-theme')))
  rl?.close()

  if (!validPackageName(name)) fail(`"${name}" is not a valid npm package name (the last part of the path is the package name)`)
  scaffoldTheme(join(here, '../template-theme'), prepare(dir), name)

  if (!hasThemePrefix(name)) {
    console.log(`Hint: theme packages are named vuemo-theme-<name> or @scope/vuemo-theme-<name> so people can find them.`)
  }
  console.log(`
Created ${name}. Next:

  cd ${dir}
  pnpm install
  pnpm dev     # the example blog
  pnpm check   # check the theme against the Vuemo theme contract
`)
}

const template = values.template ?? (await prompt('What do you want to create? [blog/theme]', 'blog'))
if (!TEMPLATES.includes(template)) fail(`Unknown template "${template}". Use: ${TEMPLATES.join(', ')}`)
if (template === 'theme') {
  const blogOnly = (['theme', 'comments', 'ai-summary'] as const).filter((k) => values[k] !== undefined)
  if (blogOnly.length) fail(`${blogOnly.map((k) => `--${k}`).join(', ')} only applies to a blog, not to --template theme`)
}
await (template === 'theme' ? theme() : blog())
