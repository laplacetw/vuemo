/** `vuemo new` helpers, kept apart from cli.ts so they can be tested. */

/** A post name must stay inside posts/: no path separators, no `..`, no NUL, not empty. */
export function validPostName(name: string): boolean {
  return !!name.trim() && !/[\\/\0]/.test(name) && !name.includes('..')
}

/** A YAML double-quoted scalar (JSON strings are valid YAML). */
export function yamlString(text: string): string {
  return JSON.stringify(text).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM-DD HH:mm:ss` from the local clock components. */
export function localDateTime(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

export function postTemplate(name: string, now: Date): string {
  const title = name.replaceAll('-', ' ').replace(/^./, (c) => c.toUpperCase())
  return `---
title: ${yamlString(title)}
date: ${localDateTime(now)}
category:
tags:
  -
description:
---

write excerpt here

---
`
}
