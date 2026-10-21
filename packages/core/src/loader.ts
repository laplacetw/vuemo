import { createContentLoader } from 'vitepress'
import { parsePost, type Post } from './schema'
import type { VuemoPlugin } from './plugin'

export interface PostsLoaderOptions {
  /** Glob relative to the VitePress source dir. */
  pattern?: string
}

export function createPostsLoader(options: PostsLoaderOptions = {}) {
  const isBuild = process.env.NODE_ENV === 'production'
  // VitePress exposes the resolved site config to data loaders; defineBlogConfig stores plugins there.
  const plugins: VuemoPlugin[] = (globalThis as any).VITEPRESS_CONFIG?.userConfig?.vuemo?.plugins ?? []
  return createContentLoader(options.pattern ?? 'posts/*.md', {
    excerpt: true,
    transform(raw): Post[] {
      const posts: Post[] = []
      for (const src of raw) {
        let post = parsePost(src)
        if (typeof post === 'string') {
          console.warn(`[vuemo] skipped ${src.url}: ${post}`)
          continue
        }
        for (const plugin of plugins) post = plugin.transformPost?.(post) ?? post
        if (!(isBuild && post.draft)) posts.push(post)
      }
      return posts.sort((a, b) => b.date.time - a.date.time)
    }
  })
}
