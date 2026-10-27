#!/usr/bin/env node
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { resolveConfig } from './config'
import { add, remove, sync, verify, type Context } from './cli/commands'
import { envIsIgnored, loadEnv } from './cli/env'
import { LocalStorage, R2Storage, r2FromEnv } from './cli/storage'
import type { GalleryConfig, ResolvedGalleryConfig } from './types'

const HELP = `vuemo-gallery: manage the photos of @vuemo/plugin-gallery

  vuemo-gallery add <dir> --album <slug>   make thumbnails and upload the photos in <dir>
  vuemo-gallery sync [--prune]             compare the storage with the manifest (--prune deletes unlisted files)
  vuemo-gallery verify [--remote]          check the manifest, alt texts and (with --remote or storage 'local') the files
  vuemo-gallery remove <id>                delete a photo from the manifest and the storage

Settings come from the \`gallery\` key of your vuemo.config.ts. Without one (or with --no-config) use
  --storage <r2|local> --dir <gallery dir> --base-url <url>
R2 credentials come from the environment or .env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.`

/** The gallery settings the plugin passed to Vite (`define.__VUEMO_GALLERY__`), read by resolving the project's VitePress config. */
async function configFromProject(root: string): Promise<ResolvedGalleryConfig | undefined> {
  try {
    const { resolveConfig: resolveSite } = await import('vitepress')
    const site = await resolveSite(root, 'build', 'production')
    const raw = (site.userConfig as any)?.vite?.define?.__VUEMO_GALLERY__
    return raw ? (JSON.parse(raw) as ResolvedGalleryConfig) : undefined
  } catch {
    return undefined
  }
}

async function main(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      album: { type: 'string' },
      prune: { type: 'boolean' },
      remote: { type: 'boolean' },
      'no-config': { type: 'boolean' },
      storage: { type: 'string' },
      dir: { type: 'string' },
      'base-url': { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    }
  })
  const [command, arg] = positionals
  if (values.help || !command) return void console.log(HELP)

  const root = process.cwd()
  const hasEnv = loadEnv(root)
  let cfg = values['no-config'] ? undefined : await configFromProject(root)
  if (!cfg) {
    if (!values['no-config']) console.warn('! no `gallery` settings found in the project config; using flags and defaults')
    const flags: GalleryConfig = { storage: (values.storage as 'r2' | 'local') ?? 'local', dir: values.dir, baseUrl: values['base-url'] }
    cfg = resolveConfig(flags)
  }
  if (cfg.storage === 'r2' && hasEnv && !envIsIgnored(root)) console.warn('! .env is not in .gitignore: your R2 keys could be committed. Add `.env` to .gitignore.')

  const storage = cfg.storage === 'local' ? new LocalStorage(join(root, 'public', 'gallery')) : new R2Storage(r2FromEnv(process.env))
  const ctx: Context = { root, cfg, storage, log: { info: (m) => console.log(m), warn: (m) => console.warn(`! ${m}`) } }

  switch (command) {
    case 'add': {
      if (!arg || !values.album) throw new Error('usage: vuemo-gallery add <dir> --album <slug>')
      const r = await add(ctx, resolve(root, arg), values.album)
      console.log(`${r.added} added, ${r.skipped} unchanged, ${r.uploaded} files written${r.failed ? `, ${r.failed} failed` : ''}`)
      if (r.failed) process.exitCode = 1
      return
    }
    case 'sync': {
      const r = await sync(ctx, !!values.prune)
      for (const k of r.missing) console.error(`missing: ${k}`)
      for (const k of r.extra) console.log(`${values.prune ? 'deleted' : 'unlisted'}: ${k}`)
      console.log(`${r.missing.length} missing, ${r.extra.length} unlisted${values.prune ? `, ${r.deleted} deleted` : ''}`)
      if (r.missing.length) process.exitCode = 1
      return
    }
    case 'verify': {
      const r = await verify(ctx, !!values.remote)
      for (const w of r.warnings) console.warn(`! ${w}`)
      for (const e of r.errors) console.error(e)
      console.log(r.errors.length ? `${r.errors.length} problem(s)` : 'ok')
      if (r.errors.length) process.exitCode = 1
      return
    }
    case 'remove': {
      if (!arg) throw new Error('usage: vuemo-gallery remove <id>')
      await remove(ctx, arg)
      return
    }
    default:
      throw new Error(`unknown command "${command}"\n\n${HELP}`)
  }
}

main(process.argv.slice(2)).catch((e) => {
  console.error(`vuemo-gallery: ${e?.message ?? e}`)
  process.exitCode = 1
})
