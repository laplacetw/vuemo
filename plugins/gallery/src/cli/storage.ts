import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { AwsClient } from 'aws4fetch'

export const CACHE_CONTROL = 'public, max-age=31536000, immutable'

/** Where the generated variants live. Keys look like `albums/<slug>/<id>/<width>.webp`. */
export interface Storage {
  has(key: string): Promise<boolean>
  put(key: string, body: Uint8Array, contentType: string): Promise<void>
  delete(key: string): Promise<void>
  /** Every key below `prefix`. */
  list(prefix: string): Promise<string[]>
}

/** `public/gallery`: for local development, tests, and sites without a domain for the bucket. */
export class LocalStorage implements Storage {
  constructor(private dir: string) {}
  private path = (key: string) => join(this.dir, key)
  async has(key: string) {
    return existsSync(this.path(key))
  }
  async put(key: string, body: Uint8Array) {
    await mkdir(dirname(this.path(key)), { recursive: true })
    await writeFile(this.path(key), body)
  }
  async delete(key: string) {
    await rm(this.path(key), { force: true })
    // drop the id and album folders once empty
    for (let d = dirname(this.path(key)); d.length > this.dir.length; d = dirname(d)) {
      if (!existsSync(d) || (await readdir(d)).length) break
      await rm(d, { recursive: true })
    }
  }
  async list(prefix: string) {
    const out: string[] = []
    const walk = async (rel: string) => {
      const abs = join(this.dir, rel)
      if (!existsSync(abs)) return
      for (const e of await readdir(abs, { withFileTypes: true })) {
        const next = rel ? `${rel}/${e.name}` : e.name
        e.isDirectory() ? await walk(next) : out.push(next)
      }
    }
    await walk(prefix.replace(/\/$/, ''))
    return out.sort()
  }
}

export interface R2Credentials {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

export function r2FromEnv(env: Record<string, string | undefined>): R2Credentials {
  const names = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']
  const missing = names.filter((n) => !env[n])
  if (missing.length) throw new Error(`Missing ${missing.join(', ')}. Set them in the environment or in .env (see docs/gallery.md).`)
  return { accountId: env.R2_ACCOUNT_ID!, accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY!, bucket: env.R2_BUCKET! }
}

/** Cloudflare R2 through its S3 API, signed with SigV4 (region `auto`). `fetchImpl` exists for tests. */
export class R2Storage implements Storage {
  private aws: AwsClient
  private endpoint: string
  constructor(creds: R2Credentials, private fetchImpl: typeof fetch = fetch) {
    this.aws = new AwsClient({ accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey, service: 's3', region: 'auto' })
    this.endpoint = `https://${creds.accountId}.r2.cloudflarestorage.com/${creds.bucket}`
  }
  private async call(method: string, url: string, init: { headers?: Record<string, string>; body?: Uint8Array } = {}) {
    const signed = await this.aws.sign(url, { method, headers: init.headers, body: init.body as BodyInit | undefined })
    return this.fetchImpl(signed)
  }
  private url = (key: string) => `${this.endpoint}/${key.split('/').map(encodeURIComponent).join('/')}`

  async has(key: string) {
    const res = await this.call('HEAD', this.url(key))
    if (res.status === 404) return false
    if (!res.ok) throw new Error(`R2 HEAD ${key}: ${res.status}`)
    return true
  }
  async put(key: string, body: Uint8Array, contentType: string) {
    const res = await this.call('PUT', this.url(key), { headers: { 'Content-Type': contentType, 'Cache-Control': CACHE_CONTROL }, body })
    if (!res.ok) throw new Error(`R2 PUT ${key}: ${res.status} ${await res.text()}`)
  }
  async delete(key: string) {
    const res = await this.call('DELETE', this.url(key))
    if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${key}: ${res.status}`)
  }
  async list(prefix: string) {
    const keys: string[] = []
    let token = ''
    do {
      const q = new URLSearchParams({ 'list-type': '2', prefix })
      if (token) q.set('continuation-token', token)
      const res = await this.call('GET', `${this.endpoint}?${q}`)
      if (!res.ok) throw new Error(`R2 LIST ${prefix}: ${res.status}`)
      const xml = await res.text()
      for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1])
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] ?? '') : ''
    } while (token)
    return keys.sort()
  }
}
