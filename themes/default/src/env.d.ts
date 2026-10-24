// `@localSearchIndex` is provided by VitePress itself when `themeConfig.search.provider` is `'local'`.
declare module '@localSearchIndex' {
  const data: Record<string, () => Promise<{ default: string }>>
  export default data
}
