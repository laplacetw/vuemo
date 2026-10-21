declare module 'virtual:vuemo/plugins' {
  import type { Component } from 'vue'
  export const slots: Record<string, Component[]>
  export const enhanceApps: ((ctx: any) => void)[]
}
