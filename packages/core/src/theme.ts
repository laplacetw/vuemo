/// <reference path="./client/virtual.d.ts" />
import type { Theme } from 'vitepress'
import theme from 'virtual:vuemo/theme'

// `theme` in defineBlogConfig decides what this re-exports.
export default theme as Theme
