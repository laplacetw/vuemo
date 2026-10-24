import type { Theme } from 'vitepress'
import { runEnhanceApps } from '@vuemo/core/client'
import Layout from './Layout.vue'
import Badge from './components/Badge.vue'
import '../dist/style.css'

const theme: Theme = {
  Layout,
  enhanceApp: (ctx) => {
    ctx.app.component('Badge', Badge)
    return runEnhanceApps(ctx)
  }
}
export default theme
