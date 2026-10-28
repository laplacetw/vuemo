import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const bin = fileURLToPath(new URL('../dist/index.js', import.meta.url))

// runs the built bin (`pnpm build` comes before `pnpm test`)
describe.skipIf(!existsSync(bin))('create-vuemo --help', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', input: '' })
  it('prints the usage and exits 0', () => {
    for (const flag of ['--help', '-h']) {
      const r = run(flag)
      expect(r.status).toBe(0)
      expect(r.stdout).toContain('Usage: create-vuemo')
      expect(r.stderr).toBe('')
    }
  })
  it('prints the usage for an unknown option without a stack trace', () => {
    const r = run('--bogus')
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('Unknown option')
    expect(r.stderr).toContain('Usage: create-vuemo')
    expect(r.stderr).not.toMatch(/\n\s+at /)
  })
})
