#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

const [command, filename] = process.argv.slice(2)

if (command !== 'new' || !filename) {
  console.error('Usage: vuemo new <filename>')
  process.exit(1)
}

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
draft: true
---

write excerpt here

---
`
)
console.log(`[INFO]: Created ${target}`)
