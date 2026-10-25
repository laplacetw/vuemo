import type { Theme } from 'vitepress'
import { runEnhanceApps } from '@vuemo/core/client'
import Layout from './Layout.vue'
import './style.css'

export type { MyThemeConfig } from './types'

// A Vuemo theme is a plain VitePress theme: `Layout` plus `enhanceApp`.
const theme: Theme = {
  Layout,
  enhanceApp(ctx) {
    // Contract: call this so plugins (comments, AI summary, ...) can register their client code.
    return runEnhanceApps(ctx)
  }
}

export default theme
