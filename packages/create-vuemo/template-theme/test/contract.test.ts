import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkTheme } from '@vuemo/core/check'

describe('theme contract', () => {
  it('follows the Vuemo theme contract', async () => {
    // builds a small fixture blog with this theme (in <package>/.vuemo-check) and checks the HTML
    const { results, ok } = await checkTheme({ cwd: fileURLToPath(new URL('..', import.meta.url)) })
    const failed = results.filter((r) => r.status === 'fail')
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([])
    expect(ok).toBe(true)
  }, 180_000)
})
