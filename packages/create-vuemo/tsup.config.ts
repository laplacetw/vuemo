import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

// the generated project depends on the versions released together with this scaffolder
const range = (path: string) => `^${JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')).version}`

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  define: {
    __VERSIONS__: JSON.stringify({
      core: range('../core/package.json'),
      theme: range('../../themes/default/package.json'),
      comments: range('../../plugins/comments/package.json'),
      aiSummary: range('../../plugins/ai-summary/package.json'),
      vitepress: '^1.6.4',
      vue: '^3.5.0',
      mathjax: '^4.3.2'
    })
  }
})
