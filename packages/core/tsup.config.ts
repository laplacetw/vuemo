import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts', cli: 'src/cli.ts', check: 'src/check/index.ts' },
  format: ['esm'],
  dts: { entry: { index: 'src/index.ts', check: 'src/check/index.ts' } },
  clean: true,
  external: ['vitepress', 'vue']
})
