import { defineAsyncComponent } from 'vue'
import type { EnhanceAppContext } from 'vitepress'

/** Registers `<VuemoGallery>` as an async component, so pages without a gallery do not load it. */
export default function enhance({ app }: EnhanceAppContext) {
  app.component('VuemoGallery', defineAsyncComponent(() => import('./Gallery.vue')))
}
