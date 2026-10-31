import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { FIXTURE } from './assert'

export const FIXTURE_DIR = '.vuemo-check'

const post = (n: number, date: string) => `---
title: ${FIXTURE.titles[n - 1]}
date: ${date}
tags: [${FIXTURE.tag}]
category: ${FIXTURE.category}
description: Fixture post ${n}
---

Excerpt of post ${n}.

---

${FIXTURE.bodyMarkers[n - 1]}

## Check heading ${n}

Some more text.
`

const layoutPage = (title: string, layout: string) => `---
title: ${title}
layout: ${layout}
---
`

/** Files of the fixture blog, relative to its root. It keeps the classic layout (defineBlogConfig called in .vitepress/config), so contract checks also cover projects that predate the root vuemo.config.ts. `theme` is the absolute path (or specifier) of the theme. */
export function fixtureFiles(theme: string): Record<string, string> {
  return {
    '.vitepress/config.mjs': `import { defineBlogConfig } from '@vuemo/core'
import { probePlugin } from '@vuemo/core/check'

export default defineBlogConfig({
  title: 'Vuemo theme check',
  theme: ${JSON.stringify(theme.replace(/\\/g, '/'))},
  hostname: 'https://check.invalid',
  postsPerPage: 100,
  search: false,
  rss: false,
  plugins: [probePlugin()],
  vite: { logLevel: 'warn' }
})
`,
    '.vitepress/theme/index.mjs': `export { default } from '@vuemo/core/theme'\n`,
    'posts/check-post-1.md': post(1, '2024-01-01'),
    'posts/check-post-2.md': post(2, '2024-02-01'),
    'posts/check-post-3.md': post(3, '2024-03-01'),
    'index.md': layoutPage('Home', 'home'),
    'archives.md': layoutPage('Archives', 'archive'),
    'tags.md': layoutPage('Tags', 'tag'),
    'category.md': layoutPage('Categories', 'category'),
    'unknown-layout.md': `${layoutPage('Unknown layout', FIXTURE.unknownLayout)}
${FIXTURE.unknownMarker}
`,
    'page.md': `---
title: Page
---

${FIXTURE.pageMarker}

<VuemoCheckEnhance />
`,
    'about.md': `${layoutPage('About', 'about')}
${FIXTURE.aboutMarker}
`
  }
}

export async function writeFixture(root: string, theme: string): Promise<void> {
  await rm(root, { recursive: true, force: true })
  for (const [file, text] of Object.entries(fixtureFiles(theme))) {
    const target = join(root, file)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, text)
  }
}

/** Where VitePress writes the pages the assertions read. */
export const FIXTURE_PAGES = {
  home: 'index.html',
  archive: 'archives.html',
  tag: 'tags.html',
  category: 'category.html',
  page: 'page.html',
  about: 'about.html',
  unknown: 'unknown-layout.html',
  post: 'posts/check-post-1.html'
} as const
