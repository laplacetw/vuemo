import { describe, expect, it } from 'vitest'
import { configTs, packageJson, validName } from '../src/generate'

const base = { name: 'b', title: 'My "Blog"', comments: 'none', aiSummary: false } as const

describe('generate', () => {
  it('adds only the chosen plugins', () => {
    expect(configTs(base)).not.toContain('plugins')
    const full = configTs({ ...base, comments: 'giscus', aiSummary: true })
    expect(full).toContain("provider: 'giscus'")
    expect(full).toContain('aiSummary(')
    expect(Object.keys(JSON.parse(packageJson({ ...base, comments: 'giscus', aiSummary: true })).dependencies)).toEqual(
      expect.arrayContaining(['@vuemo/plugin-comments', '@vuemo/plugin-ai-summary'])
    )
  })
  it('escapes the title and validates names', () => {
    expect(configTs(base)).toContain('title: "My \\"Blog\\""')
    expect(validName('my-blog')).toBe(true)
    expect(validName('../x')).toBe(false)
  })
})
