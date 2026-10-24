import { describe, expect, it } from 'vitest'
import { postSummary } from '../src/utils'

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
