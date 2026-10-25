import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  FIXTURE, checkArchive, checkCategory, checkEnhanceApp, checkHome, checkPage, checkPost, checkSlots, checkTag,
  checkVuemoContent, runAssertions
} from '../src/check/assert'
import { checkIsDark, checkNoFs, checkPeerDeps } from '../src/check/static'
import { checkTheme } from '../src/check'

const B = FIXTURE.bodyMarkers[0]
const probe = (n: string) => `<div data-vuemo-probe="${n}"></div>`
const good = `<article>${probe('post-before-content')}<div class="prose vuemo-content"><p>${B}</p></div>${probe('post-after-content')}</article>${probe('post-comments')}`

describe('layout assertions', () => {
  it('home', () => {
    expect(checkHome(`<li>${FIXTURE.newestTitle}</li>`).status).toBe('pass')
    expect(checkHome('<li>Check Post One</li>').status).toBe('fail')
  })
  it('archive needs every title', () => {
    expect(checkArchive(FIXTURE.titles.join(' ')).status).toBe('pass')
    const r = checkArchive('Check Post One Check Post Two')
    expect(r.status).toBe('fail')
    expect(r.message).toContain('Check Post Three')
  })
  it('tag, category, page, post', () => {
    expect(checkTag(FIXTURE.tag).status).toBe('pass')
    expect(checkTag('nothing').status).toBe('fail')
    expect(checkCategory(FIXTURE.category).status).toBe('pass')
    expect(checkCategory('').status).toBe('fail')
    expect(checkPage(FIXTURE.pageMarker).status).toBe('pass')
    expect(checkPage('<main></main>').status).toBe('fail')
    expect(checkPost(B).status).toBe('pass')
    expect(checkPost('<main></main>').status).toBe('fail')
  })
})

describe('vuemo-content', () => {
  it('passes with the marker inside', () => expect(checkVuemoContent(good).status).toBe('pass'))
  it('fails when the class is missing', () => {
    const r = checkVuemoContent(`<div class="prose">${B}</div>`)
    expect(r.status).toBe('fail')
    expect(r.message).toContain('vuemo-content')
  })
  it('fails when the marker comes before the element', () => {
    expect(checkVuemoContent(`${B}<div class="vuemo-content"></div>`).status).toBe('fail')
  })
  it('does not match a class that only contains the name', () => {
    expect(checkVuemoContent(`<div class="my-vuemo-content">${B}</div>`).status).toBe('fail')
  })
})

describe('slots', () => {
  it('passes in order', () => expect(checkSlots(good).status).toBe('pass'))
  it('fails when a slot is missing', () => {
    const r = checkSlots(good.replace(probe('post-comments'), ''))
    expect(r.status).toBe('fail')
    expect(r.message).toContain('post-comments')
  })
  it('fails when a slot is duplicated', () => {
    expect(checkSlots(good + probe('post-comments')).message).toContain('2 times')
  })
  it('fails when before is after the content', () => {
    const bad = `<div class="vuemo-content">${B}</div>${probe('post-before-content')}${probe('post-after-content')}${probe('post-comments')}`
    expect(checkSlots(bad).message).toContain('before the post content')
  })
  it('fails when after is inside/before the body', () => {
    const bad = `${probe('post-before-content')}<div class="vuemo-content">${probe('post-after-content')}${B}</div>${probe('post-comments')}`
    expect(checkSlots(bad).message).toContain('after the post content')
  })
  it('fails when comments come before after', () => {
    const bad = `${probe('post-before-content')}<div class="vuemo-content">${B}</div>${probe('post-comments')}${probe('post-after-content')}`
    expect(checkSlots(bad).message).toContain('post-comments')
  })
})

describe('enhance-app and runAssertions', () => {
  it('enhance-app', () => {
    expect(checkEnhanceApp(probe('enhance-app')).status).toBe('pass')
    expect(checkEnhanceApp('<VuemoCheckEnhance></VuemoCheckEnhance>').status).toBe('fail')
  })
  it('runs all assertions', () => {
    const ok = runAssertions({
      home: FIXTURE.newestTitle, archive: FIXTURE.titles.join(), tag: FIXTURE.tag, category: FIXTURE.category,
      page: FIXTURE.pageMarker + probe('enhance-app'), post: good
    })
    expect(ok.map((r) => r.id)).toEqual([
      'layout-home', 'layout-archive', 'layout-tag', 'layout-category', 'layout-page', 'layout-post', 'vuemo-content', 'slots', 'enhance-app'
    ])
    expect(ok.every((r) => r.status === 'pass')).toBe(true)
    expect(runAssertions({ home: '', archive: '', tag: '', category: '', page: '', post: '' }).every((r) => r.status === 'fail')).toBe(true)
  })
})

describe('static checks', () => {
  const peers = { '@vuemo/core': '^0.1.0', vitepress: '^1.6.0' }
  it('peer-deps', () => {
    expect(checkPeerDeps({ peerDependencies: peers }).status).toBe('pass')
    expect(checkPeerDeps({ peerDependencies: { vitepress: '^1' } }).message).toContain('@vuemo/core')
    expect(checkPeerDeps({ peerDependencies: peers, dependencies: { '@vuemo/core': '^0.1.0' } }).status).toBe('warn')
    expect(checkPeerDeps(undefined).status).toBe('warn')
  })
  it('no-fs', () => {
    expect(checkNoFs({ 'a.ts': `import { ref } from 'vue'` }).status).toBe('pass')
    for (const src of [`import { readFileSync } from 'node:fs'`, `import path from "path"`, `const f = require('fs')`, `import('fs/promises')`]) {
      expect(checkNoFs({ 'a.ts': src }).status).toBe('warn')
    }
    expect(checkNoFs({ 'a.ts': `import x from './fs'` }).status).toBe('pass')
  })
  it('is-dark', () => {
    expect(checkIsDark({ 'a.vue': 'const { isDark } = useData()' }).status).toBe('manual')
    expect(checkIsDark({ 'a.css': '.dark body {}' }).status).toBe('manual')
    expect(checkIsDark({ 'a.vue': 'class="dark:bg-black"' }).status).toBe('manual')
    expect(checkIsDark({ 'a.vue': '<div/>' }).status).toBe('warn')
  })
})

// Needs `pnpm build` (core dist and themes/default/dist/style.css). Set VUEMO_SKIP_CHECK_E2E to skip.
const theme = fileURLToPath(new URL('../../../themes/default', import.meta.url))
const built = existsSync(fileURLToPath(new URL('../dist/check.js', import.meta.url))) && existsSync(`${theme}/dist/style.css`)
describe.skipIf(!!process.env.VUEMO_SKIP_CHECK_E2E)('checkTheme (integration)', () => {
  it('passes for the default theme', { timeout: 180_000 }, async () => {
    if (!built) throw new Error('run `pnpm build` first (needs packages/core/dist and themes/default/dist/style.css), or set VUEMO_SKIP_CHECK_E2E=1')
    const { ok, results } = await checkTheme({ cwd: theme, theme: './src/index.ts' })
    expect(results.filter((r) => r.status === 'fail')).toEqual([])
    expect(ok).toBe(true)
    expect(existsSync(`${theme}/.vuemo-check`)).toBe(false)
  })
})
