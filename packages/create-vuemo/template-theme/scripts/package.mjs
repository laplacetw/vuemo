// pnpm package: writes dist-zip/<name>-<version>.zip, the theme as a download for people who unzip it into their blog's `themes/` folder.
//
// The zip has one top-level folder named after the theme's short name (`trigger` for `vuemo-theme-trigger`) with
// src/, dist/ (if you build one), package.json, README.md and LICENSE. It uses only Node built-ins: no `zip` command is needed.
// The theme must ship precompiled assets (CSS included); a zip user has no build step.
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join, posix, resolve } from 'node:path'
import { deflateRawSync } from 'node:zlib'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const bare = pkg.name.replace(/^@[^/]+\//, '')
const short = bare.replace(/^vuemo-theme-/, '') || bare
const fail = (message) => {
  console.error(`[ERROR]: ${message}`)
  process.exit(1)
}

// With `files` in package.json, the zip holds what `npm publish` would (those paths, plus package.json, README.md and LICENSE);
// without it: src, dist, package.json, README.md and LICENSE.
const ALWAYS = ['package.json', 'README.md', 'LICENSE']
const listed = Array.isArray(pkg.files) ? pkg.files.filter((f) => typeof f === 'string' && !f.startsWith('!')).map((f) => f.replace(/^\.\//, '').replace(/\/\*\*(\/\*)?$/, '').replace(/\/+$/, '')) : undefined
if (listed?.some((f) => /[*?[\]{}]/.test(f))) fail('`files` in package.json holds a glob pattern; list plain files and folders (for example "src", "dist") so the zip matches what is published')
const INCLUDE = listed ? [...new Set([...listed, ...ALWAYS])] : ['src', 'dist', ...ALWAYS]
const SKIP = new Set(['node_modules'])

/** Every regular file under `path`, as `{ name: <path inside the zip, with />, file, stat }`. Dotfiles and symlinks are skipped. */
function collect(path, name) {
  const base = basename(path)
  if (SKIP.has(base) || base.startsWith('.')) return []
  const stat = lstatSync(path)
  if (stat.isSymbolicLink()) {
    console.warn(`[warn] skipped the symbolic link ${path}`)
    return []
  }
  if (stat.isDirectory()) return readdirSync(path).sort().flatMap((n) => collect(join(path, n), posix.join(name, n)))
  return stat.isFile() ? [{ name, file: path, stat }] : []
}

const entries = INCLUDE.filter((n) => existsSync(join(root, n))).flatMap((n) => collect(join(root, n), posix.join(short, n)))
for (const required of ['src', 'package.json']) {
  if (!existsSync(join(root, required))) fail(`${required} is missing in ${root}; run this from the theme's folder`)
}

// the entry (exports["."] / main, else index.* or src/index.*) must be in the zip, or the theme would not load from themes/
const pick = (v) => {
  if (typeof v === 'string') return v
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  for (const k of ['import', 'default', ...Object.keys(v).filter((k) => !['import', 'default', 'types', 'require'].includes(k))]) {
    const found = pick(v[k])
    if (found) return found
  }
}
const exp = pkg.exports
const dot = exp && typeof exp === 'object' && !Array.isArray(exp) && Object.keys(exp).some((k) => k.startsWith('.')) ? exp['.'] : exp
const declared = pick(dot) ?? (typeof pkg.main === 'string' ? pkg.main : undefined)
const names = new Set(entries.map((e) => e.name))
const inZip = (rel) => names.has(posix.join(short, resolve('/', rel).slice(1).split('\\').join('/')))
const fallbacks = ['index', 'src/index'].flatMap((b) => ['ts', 'mts', 'js', 'mjs'].map((e) => `${b}.${e}`))
const target = declared ?? fallbacks.find((f) => existsSync(join(root, f)))
if (!target) fail('the theme has no entry: add exports["."] or main to package.json, or an index.ts / src/index.ts')
if (!inZip(target)) fail(`the entry ${target} is not in the zip (check \`files\` in package.json, and that the file exists)`)

if (!existsSync(join(root, 'LICENSE'))) console.warn('[warn] no LICENSE file: add one so people may use the theme')
if (!existsSync(join(root, 'dist'))) console.warn('[warn] no dist/: fine if the theme has no build step, but compiled CSS belongs in dist/ (a zip user cannot run a build)')

// --- a minimal zip writer (deflate, no zip64: a theme is small, and the writer refuses what zip64 would be needed for) ---
const LIMIT = 0xffffffff
if (entries.length > 0xffff) fail(`${entries.length} files: too many for a plain zip (at most 65535)`)
const table = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
  return n >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
// Reproducible: every file gets SOURCE_DATE_EPOCH (seconds) when set, else 1980-01-01 00:00:00 (UTC), never the file's mtime.
const epoch = process.env.SOURCE_DATE_EPOCH
const stamp = epoch && /^\d+$/.test(epoch) ? new Date(Number(epoch) * 1000) : new Date(Date.UTC(1980, 0, 1))
const dos = (d) => ({
  time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1),
  date: (Math.min(Math.max(d.getUTCFullYear() - 1980, 0), 127) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate()
})

const local = []
const central = []
let offset = 0
for (const { name, file } of entries) {
  const data = readFileSync(file)
  const packed = deflateRawSync(data)
  const method = packed.length < data.length ? 8 : 0
  const body = method === 8 ? packed : data
  const nameBuf = Buffer.from(name, 'utf8')
  const { time, date } = dos(stamp)
  const crc = crc32(data)
  if (data.length > LIMIT || body.length > LIMIT || offset > LIMIT) fail(`${name} is too large for a plain zip (limit 4 GiB)`)

  const head = Buffer.alloc(30)
  head.writeUInt32LE(0x04034b50, 0)
  head.writeUInt16LE(20, 4) // version needed
  head.writeUInt16LE(0x0800, 6) // names are UTF-8
  head.writeUInt16LE(method, 8)
  head.writeUInt16LE(time, 10)
  head.writeUInt16LE(date, 12)
  head.writeUInt32LE(crc, 14)
  head.writeUInt32LE(body.length, 18)
  head.writeUInt32LE(data.length, 22)
  head.writeUInt16LE(nameBuf.length, 26)
  local.push(head, nameBuf, body)

  const dir = Buffer.alloc(46)
  dir.writeUInt32LE(0x02014b50, 0)
  dir.writeUInt16LE((3 << 8) | 20, 4) // made by: Unix
  dir.writeUInt16LE(20, 6)
  dir.writeUInt16LE(0x0800, 8)
  dir.writeUInt16LE(method, 10)
  dir.writeUInt16LE(time, 12)
  dir.writeUInt16LE(date, 14)
  dir.writeUInt32LE(crc, 16)
  dir.writeUInt32LE(body.length, 20)
  dir.writeUInt32LE(data.length, 24)
  dir.writeUInt16LE(nameBuf.length, 28)
  dir.writeUInt32LE(((0o100644 << 16) >>> 0), 38) // regular file, rw-r--r--
  dir.writeUInt32LE(offset, 42)
  central.push(dir, nameBuf)
  offset += head.length + nameBuf.length + body.length
}
const centralSize = central.reduce((n, b) => n + b.length, 0)
if (offset > LIMIT || centralSize > LIMIT) fail('the zip is too large for a plain zip (limit 4 GiB)')
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(entries.length, 8)
end.writeUInt16LE(entries.length, 10)
end.writeUInt32LE(centralSize, 12)
end.writeUInt32LE(offset, 16)

mkdirSync(join(root, 'dist-zip'), { recursive: true })
const out = join('dist-zip', `${bare}-${pkg.version}.zip`)
const zip = Buffer.concat([...local, ...central, end])
writeFileSync(join(root, out), zip)

console.log(`${out}  (${entries.length} files, ${(zip.length / 1024).toFixed(1)} KiB, sha256 ${createHash('sha256').update(zip).digest('hex').slice(0, 16)}...)`)
console.log(`unzipped into a blog's themes/ folder it is themes/${short}/, used with \`theme: '${short}'\``)
