// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { pickSummary } from '../src/extract'

describe('pickSummary', () => {
  it('reads both response shapes', () => {
    expect(pickSummary({ summary: ' a ' })).toBe('a')
    expect(pickSummary({ response: { result: { response: 'b' } } })).toBe('b')
    expect(pickSummary({})).toBeUndefined()
    expect(pickSummary({ summary: '  ' })).toBeUndefined()
  })
})
