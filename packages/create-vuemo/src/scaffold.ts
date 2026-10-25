import { cpSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { configTs, packageJson, themePackageJson, type Answers } from './generate'

/** npm drops .gitignore from published packages, so the templates ship it under another name. */
function restoreGitignore(target: string) {
  renameSync(join(target, '_gitignore'), join(target, '.gitignore'))
}

export function scaffoldBlog(templateDir: string, target: string, answers: Answers & { name: string }) {
  cpSync(templateDir, target, { recursive: true })
  restoreGitignore(target)
  writeFileSync(join(target, 'package.json'), packageJson(answers))
  writeFileSync(join(target, '.vitepress/config.ts'), configTs(answers))
}

/** `name` is the package name (it may be scoped); the README shows it. */
export function scaffoldTheme(templateDir: string, target: string, name: string) {
  cpSync(templateDir, target, { recursive: true })
  restoreGitignore(target)
  writeFileSync(join(target, 'package.json'), themePackageJson({ name }))
  const readme = join(target, 'README.md')
  writeFileSync(readme, readFileSync(readme, 'utf8').replaceAll('__NAME__', name))
}
