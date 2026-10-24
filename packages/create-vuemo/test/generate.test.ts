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
  it('references the plugin types so the feature keys type-check in the user config', () => {
    const cfg = configTs(base)
    expect(cfg.startsWith('/// <reference types="@vuemo/plugin-comments" />\n/// <reference types="@vuemo/plugin-ai-summary" />\n')).toBe(true)
  })
  it('turns math and search on and installs the math plugin', () => {
    const cfg = configTs(base)
    expect(cfg).toContain('math: true')
    expect(cfg).toContain('search: true')
    const deps = JSON.parse(packageJson(base)).dependencies
    expect(deps).toHaveProperty('markdown-it-mathjax3')
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
