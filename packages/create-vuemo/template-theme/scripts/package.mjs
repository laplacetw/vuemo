// pnpm package: writes dist-zip/<name>-<version>.zip, the theme as a download for people who unzip it into their blog's `themes/` folder.
//
// The zip has one top-level folder named after the theme's short name (`trigger` for `vuemo-theme-trigger`) with
// src/, dist/ (if you build one), package.json, README.md and LICENSE. It uses only Node built-ins: no `zip` command is needed.
// The theme must ship precompiled assets (CSS included); a zip user has no build step.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, posix } from 'node:path'
import { deflateRawSync } from 'node:zlib'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const bare = pkg.name.replace(/^@[^/]+\//, '')
const short = bare.replace(/^vuemo-theme-/, '') || bare

const INCLUDE = ['src', 'dist', 'package.json', 'README.md', 'LICENSE']
const SKIP = new Set(['node_modules', '.DS_Store', '.git'])

/** Every file under `path`, as `{ name: <path inside the zip, with />, file }`. */
function collect(path, name) {
  if (SKIP.has(basename(path))) return []
  const stat = statSync(path)
  if (!stat.isDirectory()) return [{ name, file: path, stat }]
  return readdirSync(path).sort().flatMap((n) => collect(join(path, n), posix.join(name, n)))
}

const entries = INCLUDE.filter((n) => existsSync(join(root, n))).flatMap((n) => collect(join(root, n), posix.join(short, n)))
for (const required of ['src', 'package.json']) {
  if (!existsSync(join(root, required))) {
    console.error(`[ERROR]: ${required} is missing in ${root}; run this from the theme's folder`)
    process.exit(1)
  }
}
if (!existsSync(join(root, 'LICENSE'))) console.warn('[warn] no LICENSE file: add one so people may use the theme')
if (!existsSync(join(root, 'dist'))) console.warn('[warn] no dist/: fine if the theme has no build step, but compiled CSS belongs in dist/ (a zip user cannot run a build)')

// --- a minimal zip writer (deflate, no zip64: a theme is small) ---
const table = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
  return n >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const dos = (d) => ({
  time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
  date: (Math.max(d.getFullYear() - 1980, 0) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
})

const local = []
const central = []
let offset = 0
for (const { name, file, stat } of entries) {
  const data = readFileSync(file)
  const packed = deflateRawSync(data)
  const method = packed.length < data.length ? 8 : 0
  const body = method === 8 ? packed : data
  const nameBuf = Buffer.from(name, 'utf8')
  const { time, date } = dos(stat.mtime)
  const crc = crc32(data)

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
