import { describe, expect, it } from 'vitest'
import { configTs, packageJson, validName } from '../src/generate'

const base = { name: 'b', title: 'My "Blog"', comments: 'none', aiSummary: false } as const

describe('generate', () => {
  it('writes every setting into one config and always installs the official plugins', () => {
    const off = configTs(base)
    expect(off).toContain('comments: false')
    expect(off).toContain('aiSummary: false')
    expect(Object.keys(JSON.parse(packageJson(base)).dependencies)).toEqual(
      expect.arrayContaining(['@vuemo/plugin-comments', '@vuemo/plugin-ai-summary'])
    )
  })
  it('turns on the chosen features', () => {
    const on = configTs({ ...base, comments: 'giscus', aiSummary: true })
    expect(on).toContain("provider: 'giscus'")
    expect(on).toContain("api: 'https://YOUR-WORKER.workers.dev'")
    expect(configTs({ ...base, comments: 'utterances' })).toContain("comments: { provider: 'utterances'")
  })
  it('escapes the title and validates names', () => {
    expect(configTs(base)).toContain('title: "My \\"Blog\\""')
    expect(validName('my-blog')).toBe(true)
    expect(validName('../x')).toBe(false)
  })
})
