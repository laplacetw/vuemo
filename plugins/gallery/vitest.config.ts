import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

const stub = (f: string) => fileURLToPath(new URL(`./test/stubs/${f}`, import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'virtual:vuemo-gallery': stub('virtual-gallery.ts'),
      '@vuemo/core/client': stub('core-client.ts'),
      vitepress: stub('vitepress.ts')
    }
  },
  define: {
    __VUEMO_GALLERY__: JSON.stringify({ baseUrl: '/gallery', dir: 'gallery', widths: [400, 800], formats: ['webp'], exif: 'basic', perPage: 2, urlBuilder: 'static', storage: 'local' })
  },
  css: { postcss: { plugins: [] } }
})
