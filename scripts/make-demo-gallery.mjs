// Regenerates the demo gallery of examples/blog (storage 'local'): tiny generated images, no photos.
// Run from the repository root after `pnpm build`:  node scripts/make-demo-gallery.mjs
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'

const root = resolve(import.meta.dirname, '..')
const blog = join(root, 'examples/blog')
const require = createRequire(join(root, 'plugins/gallery/package.json'))
const sharp = require('sharp')
const cli = join(root, 'plugins/gallery/dist/cli.js')

const svg = (w, h, hue, shape) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue} 70% 62%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360} 65% 38%)"/>
  </linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  ${shape === 'circle' ? `<circle cx="${w * 0.62}" cy="${h * 0.4}" r="${Math.min(w, h) * 0.26}" fill="hsl(${hue} 90% 90% / .8)"/>` : ''}
  ${shape === 'bars' ? [0, 1, 2, 3].map((i) => `<rect x="${w * (0.1 + i * 0.22)}" y="${h * (0.3 + (i % 2) * 0.15)}" width="${w * 0.14}" height="${h * 0.5}" fill="hsl(${hue} 90% 92% / .75)"/>`).join('') : ''}
  ${shape === 'tri' ? `<polygon points="${w * 0.2},${h * 0.8} ${w * 0.5},${h * 0.2} ${w * 0.8},${h * 0.8}" fill="hsl(${hue} 90% 92% / .8)"/>` : ''}
</svg>`

const shapes = ['circle', 'bars', 'tri']
const sizes = [[640, 420], [420, 640], [600, 600], [640, 360], [480, 640], [640, 426]]
const albums = {
  shapes: { count: 8, hue: 10, alt: (i) => `Abstract shape ${i + 1} on a coloured gradient` },
  gradients: { count: 4, hue: 190, alt: (i) => `Soft gradient ${i + 1}` }
}

const tmp = mkdtempSync(join(tmpdir(), 'vuemo-demo-'))
const alts = {}
try {
  for (const [slug, a] of Object.entries(albums)) {
    const dir = join(tmp, slug)
    mkdirSync(dir)
    for (let i = 0; i < a.count; i++) {
      const [w, h] = sizes[i % sizes.length]
      const buf = await sharp(Buffer.from(svg(w, h, (a.hue + i * 37) % 360, slug === 'shapes' ? shapes[i % 3] : 'none'))).jpeg({ quality: 70 }).toBuffer()
      writeFileSync(join(dir, `${slug}-${i + 1}.jpg`), buf)
      alts[createHash('sha256').update(buf).digest('hex').slice(0, 12)] = a.alt(i)
    }
    execFileSync('node', [cli, 'add', dir, '--album', slug], { cwd: blog, stdio: 'inherit' })
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

// alt text is written by hand in a real blog; the demo fills it in
const file = join(blog, 'gallery/manifest.json')
const manifest = JSON.parse(readFileSync(file, 'utf8'))
for (const p of manifest.photos) if (alts[p.id] && !p.alt) p.alt = alts[p.id]
writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n')
