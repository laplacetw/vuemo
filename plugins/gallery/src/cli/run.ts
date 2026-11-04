import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { resolveConfig } from '../config'
import type { ResolvedGalleryConfig } from '../types'
import { add, remove, sync, verify, type Context } from './commands'
import { envIsIgnored, loadEnv } from './env'
import { LocalStorage, R2Storage, r2FromEnv } from './storage'

export const HELP = `vuemo-gallery: manage the photos of @vuemo/plugin-gallery

Usage:
  vuemo-gallery add <dir> --album <slug> [--alt-from-filename]
                                           make thumbnails and upload the photos in <dir>; with --alt-from-filename
                                           the file name (without extension) becomes the alt text of photos that have none
  vuemo-gallery sync [--prune [--yes] [--force]]
                                           compare the storage with the manifest; --prune deletes the unlisted objects
  vuemo-gallery verify [--remote]          check the manifest, alt texts and (with --remote or storage 'local') the files
  vuemo-gallery remove <id>                delete a photo from the manifest and the storage (not a cover photo)

Options:
  --root <dir>      the project (default: the nearest folder up from here with a .vitepress folder or a vuemo.config file)
  --no-config       ignore the project's config and use the flags below
  --storage <r2|local> --dir <gallery dir> --base-url <url>
                    the settings when the project has no \`gallery\` settings (--storage is then required)
  --yes, -y         do not ask before \`sync --prune\` deletes
  --force           let \`sync --prune\` delete every object (an empty manifest, or a manifest that matches nothing)
  --help, -h        this text

Settings come from the \`gallery\` key of your vuemo.config.ts. R2 credentials come from the environment or .env:
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET. Use one bucket (or key prefix) per site: \`sync --prune\`
treats every object under albums/ that the manifest does not list as garbage.`

export interface ProjectInfo {
  /** The VitePress project root (where `.vitepress` is; `gallery.dir` is relative to it). */
  root: string
  /** The VitePress `srcDir` (where `public/` is). */
  srcDir: string
  /** The gallery settings of the project config, if it has any. */
  settings?: ResolvedGalleryConfig
}

export interface RunDeps {
  cwd: string
  env: Record<string, string | undefined>
  isTTY: boolean
  /** Resolves the project's VitePress config. Throws when the config cannot be loaded. */
  loadProject(root: string): Promise<ProjectInfo>
  /** A yes/no question on the terminal. */
  ask(question: string): Promise<boolean>
  out(message: string): void
  err(message: string): void
}

/** The nearest folder up from `from` that has a `.vitepress` folder or a `vuemo.config.*`; `from` itself when there is none. */
export function findProjectRoot(from: string): string {
  for (let d = resolve(from); ; d = dirname(d)) {
    if (existsSync(join(d, '.vitepress')) || readdirSync(d).some((n) => /^vuemo\.config\.[cm]?[jt]s$/.test(n))) return d
    if (dirname(d) === d) return resolve(from)
  }
}

/** Where `storage: 'local'` writes: `<srcDir>/public` + the path of the root-relative `baseUrl`, so the files are served at `baseUrl`. */
export function localDir(srcDir: string, baseUrl: string): string {
  if (!baseUrl.startsWith('/') || baseUrl.startsWith('//'))
    throw new Error(`storage 'local' needs a root-relative baseUrl such as "/gallery" (got "${baseUrl}"): the files go to public/ at that path`)
  return join(srcDir, 'public', ...baseUrl.split('/').filter(Boolean))
}

/** Runs one command; returns the exit code. Everything the command needs from the outside comes through `deps`. */
export async function run(argv: string[], deps: RunDeps): Promise<number> {
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(argv)
  } catch (e) {
    deps.err(`vuemo-gallery: ${(e as Error).message}\n\n${HELP}`)
    return 1
  }
  const { values, positionals } = parsed
  const [command, arg] = positionals
  if (values.help) return deps.out(HELP), 0
  if (!command) return deps.err(HELP), 1

  try {
    const root = values.root ? resolve(deps.cwd, values.root) : findProjectRoot(deps.cwd)
    const hasEnv = loadEnv(root, deps.env)
    const flagged = values.storage !== undefined || values.dir !== undefined || values['base-url'] !== undefined

    let project: ProjectInfo = { root, srcDir: root }
    let cfg: ResolvedGalleryConfig | undefined
    if (!values['no-config']) {
      try {
        project = await deps.loadProject(root)
      } catch (e) {
        throw new Error(`could not load the project config in ${root}: ${(e as Error).message}\n  Fix it, or pass --no-config to use --storage/--dir/--base-url instead.`)
      }
      cfg = project.settings
      if (cfg && flagged) deps.err('! --storage/--dir/--base-url are ignored: the project config has gallery settings (use --no-config to override them)')
    }
    if (!cfg) {
      if (!values.storage)
        throw new Error(
          values['no-config']
            ? 'with --no-config, pass --storage <r2|local> (and --dir, --base-url)'
            : `no \`gallery\` settings found in the config of ${project.root}. Add \`gallery: { ... }\` to vuemo.config.ts, or pass --storage <r2|local> (and --dir, --base-url).`
        )
      if (values.storage !== 'r2' && values.storage !== 'local') throw new Error(`--storage must be r2 or local, not "${values.storage}"`)
      // the CLI never reads baseUrl for r2 (it is the URL the browser uses), so a missing one is no reason to stop
      cfg = resolveConfig({ storage: values.storage, dir: values.dir, baseUrl: values['base-url'] ?? (values.storage === 'r2' ? 'https://r2.invalid' : undefined) })
      deps.err(`! using --storage ${cfg.storage} and the flags: the project has no gallery settings`)
    }
    if (cfg.storage === 'r2' && hasEnv && !envIsIgnored(project.root)) deps.err('! .env is not in .gitignore: your R2 keys could be committed. Add `.env` to .gitignore.')

    const storage = cfg.storage === 'local' ? new LocalStorage(localDir(project.srcDir, cfg.baseUrl)) : new R2Storage(r2FromEnv(deps.env))
    const ctx: Context = { root: project.root, cfg, storage, log: { info: (m) => deps.out(m), warn: (m) => deps.err(`! ${m}`) } }
    let code = 0

    switch (command) {
      case 'add': {
        if (!arg || !values.album) throw new Error('usage: vuemo-gallery add <dir> --album <slug>')
        const r = await add(ctx, resolve(deps.cwd, arg), values.album, { altFromFilename: values['alt-from-filename'] })
        deps.out(`${r.added} added, ${r.skipped} unchanged, ${r.uploaded} files written${r.failed ? `, ${r.failed} failed` : ''}`)
        if (r.failed) code = 1
        break
      }
      case 'sync': {
        const confirm = deps.isTTY
          ? async (extra: string[]) => {
              for (const k of extra.slice(0, 20)) deps.out(`  ${k}`)
              if (extra.length > 20) deps.out(`  ... and ${extra.length - 20} more`)
              return deps.ask(`Delete these ${extra.length} object(s) from the storage? [y/N] `)
            }
          : undefined
        const r = await sync(ctx, { prune: values.prune, yes: values.yes, force: values.force, confirm })
        for (const k of r.missing) deps.err(`missing: ${k}`)
        for (const k of r.extra) deps.out(`${values.prune ? 'deleted' : 'unlisted'}: ${k}`)
        deps.out(`${r.missing.length} missing, ${r.extra.length} unlisted${values.prune ? `, ${r.deleted} deleted` : ''}`)
        if (r.missing.length) code = 1
        break
      }
      case 'verify': {
        const r = await verify(ctx, !!values.remote)
        for (const w of r.warnings) deps.err(`! ${w}`)
        for (const e of r.errors) deps.err(e)
        deps.out(r.errors.length ? `${r.errors.length} problem(s)` : 'ok')
        if (r.errors.length) code = 1
        break
      }
      case 'remove': {
        if (!arg) throw new Error('usage: vuemo-gallery remove <id>')
        if (!(await remove(ctx, arg))) code = 1
        break
      }
      default:
        throw new Error(`unknown command "${command}"\n\n${HELP}`)
    }
    return code
  } catch (e) {
    deps.err(`vuemo-gallery: ${(e as Error)?.message ?? e}`)
    return 1
  }
}

function parse(args: string[]) {
  return parseArgs({
    args,
    allowPositionals: true,
    options: {
      album: { type: 'string' },
      'alt-from-filename': { type: 'boolean' },
      prune: { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' },
      force: { type: 'boolean' },
      remote: { type: 'boolean' },
      root: { type: 'string' },
      'no-config': { type: 'boolean' },
      storage: { type: 'string' },
      dir: { type: 'string' },
      'base-url': { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    }
  })
}
