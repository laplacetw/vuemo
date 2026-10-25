#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createInterface } from 'node:readline/promises'
import { DEFAULT_THEME, configTs, packageJson, parseThemeSpec, validName, type Answers, type CommentsProvider } from './generate'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    yes: { type: 'boolean', short: 'y' },
    comments: { type: 'string' },
    'ai-summary': { type: 'boolean' },
    theme: { type: 'string' }
  }
})

const PROVIDERS = ['none', 'giscus', 'utterances']

async function ask(): Promise<Answers> {
  const dirArg = positionals[0]
  const interactive = !values.yes && process.stdin.isTTY
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : undefined
  const prompt = async (question: string, fallback: string) =>
    ((await rl?.question(`${question} (${fallback}) `)) ?? '').trim() || fallback

  const name = dirArg ?? (await prompt('Project name', 'my-blog'))
  const title = await prompt('Blog title', name)
  const comments = (values.comments ?? (await prompt('Comments [none/giscus/utterances]', 'none'))) as CommentsProvider
  const aiSummary = values['ai-summary'] ?? /^y/i.test(await prompt('Add AI summary plugin? [y/N]', 'N'))
  const theme = values.theme ?? (await prompt('Theme package', DEFAULT_THEME))
  rl?.close()

  if (!PROVIDERS.includes(comments)) fail(`Unknown comments provider "${comments}". Use: ${PROVIDERS.join(', ')}`)
  try {
    parseThemeSpec(theme)
  } catch (error) {
    fail((error as Error).message)
  }
  return { name, title, comments, aiSummary, theme }
}

function fail(message: string): never {
  console.error(`[ERROR]: ${message}`)
  process.exit(1)
}

const answers = await ask()
const target = resolve(process.cwd(), answers.name)
const projectName = basename(target)

if (!validName(projectName)) fail(`"${projectName}" is not a valid project name`)
if (existsSync(target) && readdirSync(target).length) fail(`${target} is not empty`)

mkdirSync(target, { recursive: true })
cpSync(join(dirname(fileURLToPath(import.meta.url)), '../template'), target, { recursive: true })
// npm drops .gitignore from published packages, so the template ships it under another name
renameSync(join(target, '_gitignore'), join(target, '.gitignore'))
writeFileSync(join(target, 'package.json'), packageJson({ ...answers, name: projectName }))
writeFileSync(join(target, '.vitepress/config.ts'), configTs(answers))

console.log(`
Created ${projectName}. Next:

  cd ${answers.name}
  pnpm install   # or npm install
  pnpm dev
  pnpm new my-first-post
`)
