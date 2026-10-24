import { describe, expect, it } from 'vitest'
import { postCountText, postSummary, updatedDate } from '../src/utils'

describe('postSummary', () => {
  const both = { excerpt: '<p>Hi</p>', description: 'Desc' }

  it('excerpt mode prefers the excerpt', () => {
    expect(postSummary(both, 'excerpt')).toEqual({ html: '<p>Hi</p>' })
  })
  it('is the default mode', () => {
    expect(postSummary(both)).toEqual({ html: '<p>Hi</p>' })
  })
  it('excerpt mode falls back to the description', () => {
    expect(postSummary({ description: 'Desc' }, 'excerpt')).toEqual({ text: 'Desc' })
    expect(postSummary({ excerpt: '  ', description: 'Desc' }, 'excerpt')).toEqual({ text: 'Desc' })
  })
  it('excerpt mode shows nothing without either', () => {
    expect(postSummary({}, 'excerpt')).toEqual({})
  })
  it('description mode uses the description and never the excerpt', () => {
    expect(postSummary(both, 'description')).toEqual({ text: 'Desc' })
    expect(postSummary({ excerpt: '<p>Hi</p>' }, 'description')).toEqual({})
    expect(postSummary({ excerpt: '<p>Hi</p>', description: ' ' }, 'description')).toEqual({})
  })
})

describe('postCountText', () => {
  it('pluralizes', () => {
    expect(postCountText(1)).toBe('1 post')
    expect(postCountText(0)).toBe('0 posts')
    expect(postCountText(4)).toBe('4 posts')
  })
})

describe('updatedDate', () => {
  const t = Date.UTC(2025, 8, 3, 12)
  it('formats the UTC date', () => {
    expect(updatedDate(t, '2025-06-01 10:00:00')).toBe('2025-09-03')
  })
  it('hides invalid timestamps', () => {
    expect(updatedDate(undefined, '2025-06-01')).toBeUndefined()
    expect(updatedDate(NaN, '2025-06-01')).toBeUndefined()
    expect(updatedDate(0, '2025-06-01')).toBeUndefined()
    expect(updatedDate(-5, '2025-06-01')).toBeUndefined()
  })
  it('hides it before the publish day, and needs a valid publish date', () => {
    expect(updatedDate(Date.UTC(2025, 4, 1), '2025-06-01')).toBeUndefined()
    expect(updatedDate(t, 'undefined')).toBeUndefined()
    expect(updatedDate(t, '')).toBeUndefined()
    expect(updatedDate(t, new Date('nope'))).toBeUndefined()
  })
  it('accepts ISO strings and Date objects as the publish date', () => {
    expect(updatedDate(t, '2025-06-01T10:00:00.000Z')).toBe('2025-09-03')
    expect(updatedDate(t, new Date('2025-06-01T10:00:00Z'))).toBe('2025-09-03')
    expect(updatedDate(t, new Date('2025-09-03T01:00:00Z'))).toBeUndefined()
  })
  it('hides it on the publish date', () => {
    expect(updatedDate(Date.UTC(2025, 5, 1, 23), '2025-06-01 10:00:00')).toBeUndefined()
  })
  it('hides it when the post opts out', () => {
    expect(updatedDate(t, '2025-06-01', false)).toBeUndefined()
    expect(updatedDate(t, '2025-06-01', true)).toBe('2025-09-03')
  })
})
