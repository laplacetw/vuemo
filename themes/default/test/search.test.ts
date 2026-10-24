import { describe, expect, it } from 'vitest'
import { decodeEntities, highlight, moveIndex, resultHref, resultsText } from '../src/search'

describe('highlight', () => {
  it('wraps matches in <mark>, ignoring case', () => {
    expect(highlight('Hello World', ['hello'])).toBe('<mark>Hello</mark> World')
  })
  it('escapes HTML', () => {
    expect(highlight('<script>alert("x")</script>', [])).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(highlight('<script>', ['script'])).toBe('&lt;<mark>script</mark>&gt;')
  })
  it('does not match inside entities', () => {
    expect(highlight('a < b', ['lt'])).toBe('a &lt; b')
    expect(highlight('a & b', ['amp'])).toBe('a &amp; b')
  })
  it('treats regex special characters literally', () => {
    expect(highlight('c++ (and) [x]', ['c++', '(and)', '[x]'])).toBe('<mark>c++</mark> <mark>(and)</mark> <mark>[x]</mark>')
    expect(highlight('abc', ['.*'])).toBe('abc')
    expect(highlight('a.c abc', ['a.c'])).toBe('<mark>a.c</mark> abc')
  })
  it('handles several terms, longest first', () => {
    expect(highlight('foo foobar baz', ['foo', 'baz', 'foobar'])).toBe('<mark>foo</mark> <mark>foobar</mark> <mark>baz</mark>')
  })
  it('ignores empty terms', () => {
    expect(highlight('abc', [''])).toBe('abc')
  })
})

describe('resultHref', () => {
  it('keeps the id as is: base is already part of it, and so are real anchors', () => {
    expect(resultHref('/vuemo/posts/a#intro')).toBe('/vuemo/posts/a#intro')
    expect(resultHref('/posts/a')).toBe('/posts/a')
    expect(resultHref('/vuemo/posts/a#hello-vuemo')).toBe('/vuemo/posts/a#hello-vuemo')
  })
  it('drops an empty anchor', () => {
    expect(resultHref('/posts/a#')).toBe('/posts/a')
  })
})

describe('moveIndex', () => {
  it('moves and wraps around', () => {
    expect(moveIndex(0, 1, 3)).toBe(1)
    expect(moveIndex(2, 1, 3)).toBe(0)
    expect(moveIndex(0, -1, 3)).toBe(2)
  })
  it('starts at either end when nothing is active', () => {
    expect(moveIndex(-1, 1, 3)).toBe(0)
    expect(moveIndex(-1, -1, 3)).toBe(2)
  })
  it('has no active item without results', () => {
    expect(moveIndex(0, 1, 0)).toBe(-1)
  })
})

describe('resultsText', () => {
  it('uses the singular for one result', () => {
    expect(resultsText(1)).toBe('1 result')
    expect(resultsText(2)).toBe('2 results')
    expect(resultsText(0)).toBe('0 results')
  })
})

describe('decodeEntities', () => {
  it('decodes the entities markdown-it writes', () => {
    expect(decodeEntities('A &amp; B')).toBe('A & B')
    expect(decodeEntities('&quot;x&quot; &lt;b&gt;')).toBe('"x" <b>')
    expect(decodeEntities('it&#39;s &#x27;ok&#X27;;')).toBe("it's 'ok';")
    expect(decodeEntities('&#26085;&#x672C;')).toBe('日本')
  })
  it('leaves unknown or invalid entities and plain text alone', () => {
    expect(decodeEntities('&nope; &#0; &#99999999; plain')).toBe('&nope; &#0; &#99999999; plain')
  })
  it('does not decode twice', () => {
    expect(decodeEntities('&amp;lt;')).toBe('&lt;')
  })
  it('works with highlight: decode first, escape once', () => {
    expect(highlight(decodeEntities('A &amp; B'), ['a'])).toBe('<mark>A</mark> &amp; B')
  })
})
