import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { scaffoldBlog, scaffoldTheme } from '../src/scaffold'

const templates = (name: string) => fileURLToPath(new URL(`../${name}`, import.meta.url))
const tmp = () => mkdtempSync(join(tmpdir(), 'create-vuemo-'))

function files(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n)
    return statSync(f).isDirectory() ? files(f, base) : [f.slice(base.length + 1)]
  })
}

describe('theme starter template', () => {
  const target = join(tmp(), 'my-theme')
  scaffoldTheme(templates('template-theme'), target, '@me/vuemo-theme-x')

  it('contains every file of the starter', () => {
    for (const f of [
      'package.json',
      'README.md',
      '.gitignore',
      'src/index.ts',
      'src/Layout.vue',
      'src/style.css',
      'src/types.ts',
      'src/env.d.ts',
      'src/components/PluginSlot.vue',
      ...['Home', 'Post', 'Archive', 'Tag', 'Category', 'Page'].map((n) => `src/layouts/${n}.vue`),
      'example/vuemo.config.ts',
      'example/.vitepress/config.ts',
      'example/.vitepress/theme/index.ts',
      ...['index', 'archives', 'tags', 'category', 'about'].map((n) => `example/${n}.md`),
      'test/contract.test.ts',
      'scripts/package.mjs'
    ]) {
      expect(existsSync(join(target, f)), f).toBe(true)
    }
    expect(files(join(target, 'example/posts')).length).toBe(2)
  })
  it('restores .gitignore and writes the package name into package.json and README', () => {
    expect(existsSync(join(target, '_gitignore'))).toBe(false)
    expect(readFileSync(join(target, '.gitignore'), 'utf8')).toContain('.vuemo-check')
    expect(JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')).name).toBe('@me/vuemo-theme-x')
    const readme = readFileSync(join(target, 'README.md'), 'utf8')
    expect(readme).toContain("theme: '@me/vuemo-theme-x'")
    expect(readme).not.toContain('__NAME__')
  })
  it('keeps the contract points in the source', () => {
    const src = (f: string) => readFileSync(join(target, f), 'utf8')
    expect(src('src/layouts/Post.vue')).toContain('vuemo-content')
    for (const slot of ['post-before-content', 'post-after-content', 'post-comments']) {
      expect(src('src/layouts/Post.vue')).toContain(`<PluginSlot name="${slot}" />`)
    }
    expect(src('src/index.ts')).toContain('runEnhanceApps(ctx)')
  })
})

/** Reads a zip's central directory: { name: content }. Fails on a wrong CRC or size. */
function readZip(buf: Buffer): Record<string, Buffer> {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const count = buf.readUInt16LE(end + 10)
  let p = buf.readUInt32LE(end + 16)
  const out: Record<string, Buffer> = {}
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50)
    const method = buf.readUInt16LE(p + 10)
    const crc = buf.readUInt32LE(p + 16)
    const size = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const body = buf.subarray(dataStart, dataStart + buf.readUInt32LE(p + 20))
    const data = method === 8 ? inflateRawSync(body) : body
    expect(data.length, name).toBe(size)
    expect(zlibCrc(data), name).toBe(crc)
    out[name] = data
    p += 46 + nameLen
  }
  return out
}
const zlibCrc = (data: Buffer) => {
  let c = 0xffffffff
  for (const b of data) {
    c ^= b
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

describe('theme starter: pnpm package', () => {
  const target = join(tmp(), 'my-theme')
  scaffoldTheme(templates('template-theme'), target, '@me/vuemo-theme-x')
  const run = () => execFileSync(process.execPath, ['scripts/package.mjs'], { cwd: target, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

  it('ignores dist-zip in git', () => {
    expect(readFileSync(join(target, '.gitignore'), 'utf8')).toContain('dist-zip')
  })
  it('writes dist-zip/<name>-<version>.zip with a top-level folder named after the short name', () => {
    mkdirSync(join(target, 'dist'))
    writeFileSync(join(target, 'dist/style.css'), 'a{color:red}'.repeat(50))
    writeFileSync(join(target, 'LICENSE'), 'MIT')
    mkdirSync(join(target, 'node_modules/x'), { recursive: true })
    writeFileSync(join(target, 'node_modules/x/i.js'), '')
    const out = run()
    expect(out).toContain('themes/x/')
    const zip = join(target, 'dist-zip/vuemo-theme-x-0.0.0.zip')
    expect(existsSync(zip)).toBe(true)
    const entries = readZip(readFileSync(zip))
    const names = Object.keys(entries)
    expect(names.every((n) => n.startsWith('x/'))).toBe(true)
    for (const f of ['x/package.json', 'x/README.md', 'x/LICENSE', 'x/src/index.ts', 'x/src/Layout.vue', 'x/dist/style.css']) expect(names, f).toContain(f)
    expect(names.some((n) => /node_modules|dist-zip|example|test\//.test(n))).toBe(false)
    expect(entries['x/dist/style.css'].toString()).toBe('a{color:red}'.repeat(50))
    expect(JSON.parse(entries['x/package.json'].toString()).name).toBe('@me/vuemo-theme-x')
    // the system unzip, when there is one, accepts it
    try {
      execFileSync('unzip', ['-tq', zip], { stdio: 'pipe' })
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    }
  })
})

describe('blog template', () => {
  it('restores .gitignore and writes package.json and config', () => {
    const target = join(tmp(), 'blog')
    scaffoldBlog(templates('template'), target, { name: 'blog', title: 'T', comments: 'none', aiSummary: false })
    expect(existsSync(join(target, '.gitignore'))).toBe(true)
    expect(existsSync(join(target, '_gitignore'))).toBe(false)
    expect(readFileSync(join(target, 'vuemo.config.ts'), 'utf8')).toContain("title: 'T'")
    expect(JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')).name).toBe('blog')
    // settings live in the root file; .vitepress/ holds one-line boilerplate the user never opens
    expect(readFileSync(join(target, 'vuemo.config.ts'), 'utf8')).toContain("import { defineBlogConfig } from '@vuemo/core'")
    expect(readFileSync(join(target, '.vitepress/config.ts'), 'utf8')).toBe("// boilerplate, edit vuemo.config.ts instead\nexport { default } from '../vuemo.config'\n")
    expect(readFileSync(join(target, '.vitepress/theme/index.ts'), 'utf8')).toBe("// boilerplate, edit vuemo.config.ts instead\nexport { default } from '@vuemo/core/theme'\n")
    const tsconfig = JSON.parse(readFileSync(join(target, 'tsconfig.json'), 'utf8'))
    expect(tsconfig.compilerOptions).toMatchObject({ module: 'ESNext', moduleResolution: 'Bundler', target: 'ES2022', strict: true, noEmit: true, skipLibCheck: true })
    expect(tsconfig.include).toEqual(['vuemo.config.ts', '.vitepress/**/*.ts'])
  })
})
