# @vuemo/plugin-comments

Comments for any Vuemo theme. Renders in the `post-comments` slot and follows the theme's `isDark`.

Enable it in `.vitepress/config.ts`; remove the key or set it to `false` to turn it off:

```ts
export default defineBlogConfig({
  // Utterances
  comments: { provider: 'utterances', repo: 'user/comments-repo' }

  // or Giscus (repoId / categoryId come from https://giscus.app)
  // comments: { provider: 'giscus', repo: 'user/repo', repoId: '...', category: 'Announcements', categoryId: '...' }
})
```

The package must be installed (`create-vuemo` installs it for you). Utterances needs a public repo with the [Utterances app](https://github.com/apps/utterances) installed.

Options:

| Provider | Option | Description |
| --- | --- | --- |
| `utterances` | `repo` | Required, `user/repo`. |
| | `issueTerm` | How a post maps to an issue. Default `title`. |
| | `light`, `dark` | Utterances themes. Defaults `github-light` / `github-dark`. |
| `giscus` | `repo`, `repoId`, `category`, `categoryId` | Required, from https://giscus.app. |
| | `mapping` | How a post maps to a discussion. Default `pathname`. |
| | `lang` | Giscus UI language. |
| | `light`, `dark` | Giscus themes. Defaults `light` / `dark`. |

Each provider is an adapter (`mount`, `unmount`, `setTheme`) in `src/adapters/`. Comments are re-mounted on page change and the theme is switched when dark mode toggles.
