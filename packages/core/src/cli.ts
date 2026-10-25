#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { parseArgs } from 'node:util'

const USAGE = 'Usage:\n  vuemo new <filename>\n  vuemo check-theme [theme] [--keep]'
const [command, ...rest] = process.argv.slice(2)

if (command === 'check-theme') {
  await checkThemeCommand(rest)
} else if (command === 'new' && rest[0]) {
  newPost(rest[0])
} else {
  console.error(USAGE)
  process.exit(1)
}

async function checkThemeCommand(args: string[]) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { keep: { type: 'boolean' } } })
  const { checkTheme } = await import('./check/index')
  const { results, ok } = await checkTheme({ theme: positionals[0], keep: values.keep })
  const icon = { pass: '\u2713', fail: '\u2717', warn: '!', manual: '?' } as const
  for (const r of results) console.log(`${icon[r.status]} ${r.id}: ${r.message}`)
  const n = (s: string) => results.filter((r) => r.status === s).length
  console.log(`\n${n('pass')} passed, ${n('fail')} failed, ${n('warn')} warnings, ${n('manual')} to verify by hand`)
  process.exit(ok ? 0 : 1)
}

function newPost(filename: string) {
  const name = filename.replace(/\.md$/, '')
  const title = name.replaceAll('-', ' ').replace(/^./, (c) => c.toUpperCase())
  const now = new Date()
  const time = now.toLocaleTimeString('en-US', { hourCycle: 'h23' })
  const target = join(process.cwd(), 'posts', `${name}.md`)

  if (existsSync(target)) {
    console.error(`[ERROR]: ${target} already exists`)
    process.exit(1)
  }

  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(
    target,
    `---
title: ${title}
date: ${now.toISOString().slice(0, 10)} ${time}
category:
tags:
  -
description:
---

write excerpt here

---
`
  )
  console.log(`[INFO]: Created ${target}`)
}
