import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Reads `.env` into `env` without overriding what is already set. Returns whether the file exists. */
export function loadEnv(root: string, env: Record<string, string | undefined> = process.env): boolean {
  const file = join(root, '.env')
  if (!existsSync(file)) return false
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (!m || line.trim().startsWith('#')) continue
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2')
    if (env[m[1]] === undefined) env[m[1]] = value
  }
  return true
}

/** True when `.env` is covered by .gitignore (or the folder is not a git repository we can ask). */
export function envIsIgnored(root: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', '.env'], { cwd: root, stdio: 'ignore' })
    return true
  } catch (e: any) {
    if (e?.status === 1) return false // git answered: not ignored
  }
  const gi = join(root, '.gitignore')
  return existsSync(gi) && readFileSync(gi, 'utf8').split(/\r?\n/).some((l) => /^\/?\.env\*?$/.test(l.trim()))
}
