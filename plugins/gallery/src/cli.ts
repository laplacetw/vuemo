#!/usr/bin/env node
import { createInterface } from 'node:readline/promises'
import { run } from './cli/run'
import type { ResolvedGalleryConfig } from './types'

/** The gallery settings the plugin passed to Vite (`define.__VUEMO_GALLERY__`), read by resolving the project's VitePress config. */
async function loadProject(root: string) {
  const { resolveConfig: resolveSite } = await import('vitepress')
  const site = await resolveSite(root, 'build', 'production')
  const raw = (site.userConfig as any)?.vite?.define?.__VUEMO_GALLERY__
  return { root: site.root, srcDir: site.srcDir, settings: raw ? (JSON.parse(raw) as ResolvedGalleryConfig) : undefined }
}

async function ask(question: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim())
  } finally {
    rl.close()
  }
}

process.exitCode = await run(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  isTTY: !!(process.stdin.isTTY && process.stdout.isTTY),
  loadProject,
  ask,
  out: (m) => console.log(m),
  err: (m) => console.error(m)
})
