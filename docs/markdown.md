# Writing posts: Markdown features

> Vuemo is under development. APIs may change.

Posts are plain VitePress Markdown. The default theme styles everything VitePress adds, in light and dark mode. See `examples/blog/posts/markdown-features.md` for a post that uses every feature below.

## What is styled

- Custom containers: `::: info`, `tip`, `warning`, `danger` and `::: details`, plus GitHub alerts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`).
- Code blocks: language label, copy button, line highlight (`{1,3}`), and the notation comments `// [!code ++]`, `// [!code --]`, `// [!code focus]`, `// [!code error]`, `// [!code warning]`.
- Code groups (`::: code-group`) with tabs.
- Heading anchors (shown on hover or keyboard focus), inline code, tables, `<kbd>`.
- Footnotes and display math (see below).

A `Badge` component is registered globally by the default theme:

```md
<Badge type="tip" text="new" />
```

`type` is `info` (default), `tip`, `warning` or `danger`.

## Line numbers

Line numbers are off by default. Turn them on for every code block with the plain VitePress option:

```ts
export default defineBlogConfig({
  markdown: { lineNumbers: true }
})
```

Opt a single block out with `:no-line-numbers` after the language, for example ` ```ts:no-line-numbers `.

## Math

Set `markdown: { math: true }` and install the peer package:

```sh
pnpm add markdown-it-mathjax3
```

Display math scrolls horizontally when it is wider than the page.

## Footnotes

Footnotes are **not** built into VitePress 1.x (they are built in from VitePress 2.0). To use them now, install the plugin and register it:

```sh
pnpm add markdown-it-footnote
```

```ts
import footnote from 'markdown-it-footnote'

export default defineBlogConfig({
  markdown: { config: (md) => md.use(footnote) }
})
```

The theme already styles the footnote section they produce.
