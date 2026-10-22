declare module 'virtual:vuemo/plugins' {
  import type { Component } from 'vue'
  export const slots: Record<string, Component[]>
  export const enhanceApps: ((ctx: any) => void)[]
}

declare module 'virtual:vuemo/theme' {
  const theme: any
  export default theme
}
