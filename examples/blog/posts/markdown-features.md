---
title: Markdown features
date: 2025-07-01 10:00:00
category: Notes
tags:
  - vuemo
  - markdown
description: Every Markdown extension the default theme styles
---

A tour of the Markdown features that VitePress adds and the default theme styles. Inline `code` stays readable, and <kbd>Ctrl</kbd> + <kbd>K</kbd> renders as a key. <Badge type="tip" text="new" /> <Badge text="info" /> <Badge type="warning" text="beta" /> <Badge type="danger" text="removed" />

## Custom containers

::: info
An info container.
:::

::: tip
A tip container.
:::

::: warning
A warning container.
:::

::: danger
A danger container.
:::

::: details Click to expand
Hidden details with `inline code`.
:::

::: tip Custom title
A container with a custom title.
:::

## GitHub alerts

> [!NOTE]
> Highlights information.

> [!TIP]
> Optional advice.

> [!IMPORTANT]
> Crucial information.

> [!WARNING]
> Urgent attention needed.

> [!CAUTION]
> Negative potential consequences.

## Code blocks

Line highlight:

```ts{1,3}
const a = 1
const b = 2
const c = a + b
console.log(c)
```

Diff, focus, error and warning markers:

```ts
export function demo() {
  const removed = 1 // [!code --]
  const added = 2 // [!code ++]
  const focused = 3 // [!code focus]
  const failed = 4 // [!code error]
  const warned = 5 // [!code warning]
  return added + focused + failed + warned
}
```

A long line that must scroll inside the block:

```ts
const veryLongLine = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.'
```

Without line numbers:

```ts:no-line-numbers
const plain = true
```

### Code group

::: code-group

```ts [index.ts]
export const hello = 'world'
```

```js [index.js]
exports.hello = 'world'
```

:::

## A table

| Feature | Styled | Notes |
| --- | --- | --- |
| Containers | yes | seven types |
| Alerts | yes | GitHub syntax |
| Code groups | yes | tabs |

## Anchors

Hover over any heading, such as the one above, to see its `#` anchor.
