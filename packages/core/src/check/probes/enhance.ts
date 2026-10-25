import { defineComponent, h } from 'vue'

// Registered through the plugin's `enhanceApp`; if the theme never calls `runEnhanceApps(ctx)`,
// `<VuemoCheckEnhance />` stays unresolved and the marker is missing from the page.
const Probe = defineComponent({
  name: 'VuemoCheckEnhance',
  render: () => h('div', { 'data-vuemo-probe': 'enhance-app' })
})

export default (ctx: { app: { component(name: string, c: unknown): unknown } }) => {
  ctx.app.component('VuemoCheckEnhance', Probe)
}
