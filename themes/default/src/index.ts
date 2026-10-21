import type { Theme } from 'vitepress'
import { runEnhanceApps } from '@vuemo/core/client'
import Layout from './Layout.vue'
import '../dist/style.css'

const theme: Theme = {
  Layout,
  enhanceApp: (ctx) => runEnhanceApps(ctx)
}
export default theme
