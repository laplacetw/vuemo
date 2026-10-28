import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { resolveConfig } from '../src/config'
import { findProjectRoot, localDir, run, HELP, type ProjectInfo, type RunDeps } from '../src/cli/run'
import { LocalStorage } from '../src/cli/storage'
import { sync, type Context } from '../src/cli/commands'

const ID = 'aaaaaaaaaaaa'
const manifest = (...ids: string[]) =>
  JSON.stringify({ version: 1, photos: ids.map((id) => ({ id, album: 'trip', w: 1, h: 1, color: '#000000', variants: [400], formats: ['webp'] })) })

function project(opts: { site?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'galrun-'))
  if (opts.site !== false) mkdirSync(join(root, '.vitepress'))
  mkdirSync(join(root, 'gallery'), { recursive: true })
  const put = (key: string) => {
    mkdirSync(join(root, 'public/gallery', key, '..'), { recursive: true })
    writeFileSync(join(root, 'public/gallery', key), 'x')
  }
  return { root, put }
}

function harness(root: string, o: { info?: Partial<ProjectInfo> | Error; isTTY?: boolean; answer?: boolean; env?: Record<string, string> } = {}) {
  const out: string[] = []
  const err: string[] = []
  const asked: string[] = []
  const deps: RunDeps = {
    cwd: root,
    env: { ...o.env },
    isTTY: o.isTTY ?? false,
    loadProject: async () => {
      if (o.info instanceof Error) throw o.info
      return { root, srcDir: root, ...o.info }
    },
    ask: async (q) => (asked.push(q), o.answer ?? false),
    out: (m) => out.push(m),
    err: (m) => err.push(m)
  }
  return { deps, out, err, asked, text: () => [...out, ...err].join('\n') }
}

const local = resolveConfig({ storage: 'local' })

describe('config resolution', () => {
  it('prints the usage for --help and for an unknown option, without a stack trace', async () => {
    const { root } = project()
    const a = harness(root)
    expect(await run(['--help'], a.deps)).toBe(0)
    expect(a.out.join('\n')).toBe(HELP)
    const b = harness(root)
    expect(await run(['sync', '--bogus'], b.deps)).toBe(1)
    expect(b.text()).toContain('Unknown option')
    expect(b.text()).toContain('Usage:')
    expect(b.text()).not.toMatch(/\n\s+at /)
  })

  it('fails with the error when the project config cannot be loaded', async () => {
    const { root } = project()
    const h = harness(root, { info: new Error('boom in vuemo.config.ts') })
    expect(await run(['verify'], h.deps)).toBe(1)
    expect(h.text()).toContain('boom in vuemo.config.ts')
    expect(h.text()).toContain('--no-config')
  })

  it('does not guess the storage when there are no settings and no flags', async () => {
    const { root } = project()
    const h = harness(root, { info: { settings: undefined } })
    expect(await run(['verify'], h.deps)).toBe(1)
    expect(h.text()).toMatch(/no `gallery` settings/)
    expect(h.text()).toContain('--storage')
    const n = harness(root)
    expect(await run(['verify', '--no-config'], n.deps)).toBe(1)
    expect(n.text()).toContain('--storage')
  })

  it('uses flags with --no-config or without gallery settings, and says so', async () => {
    const { root } = project()
    writeFileSync(join(root, 'gallery/manifest.json'), manifest(ID))
    const h = harness(root, { info: { settings: undefined } })
    expect(await run(['verify', '--storage', 'local'], h.deps)).toBe(1) // the file is missing in public/gallery
    expect(h.err.join('\n')).toContain('using --storage local')
    expect(h.err.join('\n')).toContain(`missing file: albums/trip/${ID}/400.webp`)
  })

  it('warns that flags are ignored when the config has gallery settings', async () => {
    const { root } = project()
    const h = harness(root, { info: { settings: local } })
    expect(await run(['verify', '--storage', 'r2'], h.deps)).toBe(0)
    expect(h.err.join('\n')).toContain('are ignored')
  })

  it('finds the project root upwards, and takes the root and srcDir of the site', async () => {
    const { root, put } = project()
    const sub = join(root, 'a/b')
    mkdirSync(sub, { recursive: true })
    expect(findProjectRoot(sub)).toBe(root)
    // gallery files live under the site root, local files under srcDir/public
    const site = join(root, 'site')
    mkdirSync(join(site, 'gallery'), { recursive: true })
    writeFileSync(join(site, 'gallery/manifest.json'), manifest(ID))
    mkdirSync(join(root, 'src/public/gallery/albums/trip', ID), { recursive: true })
    writeFileSync(join(root, 'src/public/gallery/albums/trip', ID, '400.webp'), 'x')
    const h = harness(sub, { info: { root: site, srcDir: join(root, 'src'), settings: local } })
    expect(await run(['verify'], h.deps)).toBe(0)
    put('albums/unused/x/400.webp')
  })

  it('derives the local folder from srcDir/public and the path of baseUrl', () => {
    expect(localDir('/p', '/gallery')).toBe(join('/p', 'public', 'gallery'))
    expect(localDir('/p', '/img/photos')).toBe(join('/p', 'public', 'img', 'photos'))
    expect(() => localDir('/p', 'https://img.example.com')).toThrow('root-relative')
  })

  it('stops for r2 without credentials', async () => {
    const { root } = project()
    const h = harness(root, { info: { settings: resolveConfig({ storage: 'r2', baseUrl: 'https://img.example.com' }) } })
    expect(await run(['verify'], h.deps)).toBe(1)
    expect(h.text()).toContain('R2_BUCKET')
  })

  it('exits with 1 for an unknown command and for missing arguments', async () => {
    const { root } = project()
    expect(await run(['nope'], harness(root, { info: { settings: local } }).deps)).toBe(1)
    expect(await run(['add'], harness(root, { info: { settings: local } }).deps)).toBe(1)
    expect(await run([], harness(root).deps)).toBe(1)
  })

  it('add works end to end and exits 0; a missing sharp-free run reports counts', async () => {
    const { root } = project()
    const photos = join(root, 'photos')
    mkdirSync(photos)
    writeFileSync(join(photos, 'a.jpg'), await sharp({ create: { width: 500, height: 300, channels: 3, background: '#336699' } }).jpeg().toBuffer())
    const h = harness(root, { info: { settings: local } })
    expect(await run(['add', 'photos', '--album', 'trip'], h.deps)).toBe(0)
    expect(h.out.join('\n')).toContain('1 added')
    expect(existsSync(join(root, 'public/gallery/albums/trip'))).toBe(true)
    expect(readFileSync(join(root, 'gallery/albums.yaml'), 'utf8')).toContain('slug: trip')
    // the cover of an album cannot be removed
    const id = JSON.parse(readFileSync(join(root, 'gallery/manifest.json'), 'utf8')).photos[0].id
    writeFileSync(join(root, 'gallery/albums.yaml'), `- slug: trip\n  title: Trip\n  cover: "${id}"\n`)
    const r = harness(root, { info: { settings: local } })
    expect(await run(['remove', id], r.deps)).toBe(1)
    expect(r.err.join('\n')).toContain('cover of album "trip"')
  })
})

describe('sync --prune safety', () => {
  function withStorage(manifestJson: string | undefined, keys: string[]) {
    const { root, put } = project()
    if (manifestJson !== undefined) writeFileSync(join(root, 'gallery/manifest.json'), manifestJson)
    for (const k of keys) put(k)
    return { root, listed: () => new LocalStorage(join(root, 'public/gallery')).list('albums/') }
  }
  const mine = `albums/trip/${ID}/400.webp`
  const stray = 'albums/trip/ffffffffffff/400.webp'

  it('refuses without --yes when not on a terminal, and deletes nothing', async () => {
    const t = withStorage(manifest(ID), [mine, stray])
    const h = harness(t.root, { info: { settings: local } })
    expect(await run(['sync', '--prune'], h.deps)).toBe(1)
    expect(h.err.join('\n')).toMatch(/1 object\(s\) without confirmation/)
    expect(await t.listed()).toEqual([mine, stray].sort())
  })

  it('deletes with --yes and prints what it deleted', async () => {
    const t = withStorage(manifest(ID), [mine, stray])
    const h = harness(t.root, { info: { settings: local } })
    expect(await run(['sync', '--prune', '--yes'], h.deps)).toBe(0)
    expect(h.out).toContain(`deleted: ${stray}`)
    expect(await t.listed()).toEqual([mine])
  })

  it('asks on a terminal and honours the answer', async () => {
    const no = withStorage(manifest(ID), [mine, stray])
    const h = harness(no.root, { info: { settings: local }, isTTY: true, answer: false })
    expect(await run(['sync', '--prune'], h.deps)).toBe(1)
    expect(h.asked[0]).toContain('1 object(s)')
    expect(await no.listed()).toHaveLength(2)
    const yes = withStorage(manifest(ID), [mine, stray])
    const y = harness(yes.root, { info: { settings: local }, isTTY: true, answer: true })
    expect(await run(['sync', '--prune'], y.deps)).toBe(0)
    expect(await yes.listed()).toEqual([mine])
  })

  it('refuses when manifest.json is missing, even with --yes --force', async () => {
    const t = withStorage(undefined, [mine, stray])
    const h = harness(t.root, { info: { settings: local } })
    expect(await run(['sync', '--prune', '--yes', '--force'], h.deps)).toBe(1)
    expect(h.err.join('\n')).toContain('manifest.json does not exist')
    expect(await t.listed()).toHaveLength(2)
  })

  it('refuses to delete everything (empty manifest, or one that matches nothing) unless --force', async () => {
    for (const m of [manifest(), manifest('bbbbbbbbbbbb')]) {
      const t = withStorage(m, [mine, stray])
      const h = harness(t.root, { info: { settings: local } })
      expect(await run(['sync', '--prune', '--yes'], h.deps)).toBe(1)
      expect(await t.listed()).toHaveLength(2)
      const f = harness(t.root, { info: { settings: local } })
      // the second manifest lists a photo whose files are missing: that is exit code 1, but the prune itself ran
      expect(await run(['sync', '--prune', '--yes', '--force'], f.deps)).toBe(m === manifest() ? 0 : 1)
      expect(await t.listed()).toEqual([])
    }
  })

  it('sync without --prune only reports, and a missing file exits 1', async () => {
    const t = withStorage(manifest(ID), [stray])
    const h = harness(t.root, { info: { settings: local } })
    expect(await run(['sync'], h.deps)).toBe(1)
    expect(h.out).toContain(`unlisted: ${stray}`)
    expect(await t.listed()).toEqual([stray])
  })

  it('the sync function applies the same guards to a storage without a config', async () => {
    const t = withStorage(manifest(ID), [mine, stray])
    const ctx: Context = { root: t.root, cfg: local, storage: new LocalStorage(join(t.root, 'public/gallery')), log: { info() {}, warn() {} } }
    await expect(sync(ctx, { prune: true })).rejects.toThrow('without confirmation')
    expect(await sync(ctx, { prune: true, confirm: async () => true })).toMatchObject({ deleted: 1 })
  })
})
