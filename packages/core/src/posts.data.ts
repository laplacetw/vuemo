import { createPostsLoader } from './loader'
import type { Post } from './schema'

declare const data: Post[]
export { data }

export default createPostsLoader()
