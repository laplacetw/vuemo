import { defineConfig } from 'vitest/config'

// the theme starter has a test of its own that is not part of this package's tests
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } })
