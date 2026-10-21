# @vuemo/plugin-comments

Comments for any Vuemo theme. Renders in the `post-comments` slot and follows the theme's `isDark`.

```ts
import comments from '@vuemo/plugin-comments'

defineBlogConfig({
  plugins: [
    // Giscus (repoId / categoryId come from https://giscus.app)
    comments({
      provider: 'giscus',
      options: { repo: 'user/repo', repoId: '...', category: 'Announcements', categoryId: '...' }
    })
    // or Utterances
    // comments({ provider: 'utterances', options: { repo: 'user/repo' } })
  ]
})
```

Each provider is an adapter (`mount`, `unmount`, `setTheme`) in `src/adapters/`. Comments are re-mounted on page change and the theme is switched when dark mode toggles.
