# Releasing

How to publish Vuemo's packages to npm. The five packages are released together with the same version:

| Package | Path |
| --- | --- |
| `@vuemo/core` | `packages/core` |
| `@vuemo/theme-default` | `themes/default` |
| `@vuemo/plugin-comments` | `plugins/comments` |
| `@vuemo/plugin-ai-summary` | `plugins/ai-summary` |
| `create-vuemo` | `packages/create-vuemo` |

## One-time setup (on npmjs.com)

1. **Create an npm account** and **turn on 2FA** (Account → Two-Factor Authentication, "Authorization and publishing"). npm asks for a one-time code on every publish.
2. **Create the organization `vuemo`** at https://www.npmjs.com/org/create (free for public packages). The `@vuemo/` in `@vuemo/core` is a *scope*: only members of the organization can publish under it. If the name is taken, every package name, import and doc has to change, so check this first.
   `create-vuemo` has no scope and does not need the organization, but the name must be free: `npm view create-vuemo` should answer 404.
3. **Log in on your machine**: `npm login`, then `npm whoami` to check.

## First release

Vuemo is released as **alpha** versions (`0.1.0-alpha.0`, `0.1.0-alpha.1`, ...) published under the npm tag `alpha`. A plain `npm install @vuemo/core` does not pick them up (there is no `latest` yet), so users opt in with `npm create vuemo@alpha`; projects it generates depend on the exact alpha range, so installing in them needs no tag. This leaves room to change the API before a stable release.

Publishing is hard to undo (`npm unpublish` only works for 72 hours and with restrictions, and a version number can never be reused), so check everything before the real publish.

1. Be on `main`, with a clean working tree that is pushed.
2. Run the checks and build from scratch:

   ```sh
   pnpm install --frozen-lockfile
   pnpm test && pnpm build
   ```

3. Look at what would be published:

   ```sh
   pnpm -r publish --dry-run --no-git-checks   # what pnpm would send
   cd packages/core && pnpm pack               # repeat per package, then inspect the .tgz
   ```

   A package should contain only `dist/`, `src/` (or `template/`), `package.json`, `README.md` and `LICENSE`. The `workspace:^` references are replaced by real versions. The theme must contain `dist/style.css`.

4. Publish:

   ```sh
   pnpm release
   ```

   This runs the tests, builds, and runs `pnpm -r publish`, which publishes in dependency order (core first). npm asks for a one-time 2FA code for each package. A code lasts about 30 seconds; if one expires, run the command again: versions that are already published are skipped. The `publishConfig.access = public` in each package makes the scoped packages public (they are private by default).

5. Check the result in a clean directory:

   ```sh
   npm create vuemo@alpha my-blog
   cd my-blog && npm install && npm run build
   ```

6. Tag and announce:

   ```sh
   git tag v0.1.0-alpha.0 && git push --tags
   ```

   Then create a GitHub Release for the tag, marked as a pre-release, with the notes from `CHANGELOG.md`.

## Release order and the theme starter

- **Bump every package before a release that changes the API.** The theme starter (`create-vuemo --template theme`) and the generated blogs pin `@vuemo/core` to the version in the workspace when `create-vuemo` is built. The published `0.1.0-alpha.0` lacks `@vuemo/core/check`, `vuemo check-theme` and absolute-path themes, so a starter that pins it breaks. Release at least `0.1.0-alpha.1` (see "Later releases") before anyone runs `npm create vuemo` for a theme.
- **Never publish `create-vuemo` before `@vuemo/core`** (and the theme and plugins). `pnpm release` publishes in dependency order; if you publish by hand, publish `create-vuemo` last, then check with `npm create vuemo@alpha x -- --template theme` that the pinned `@vuemo/core` version exists on npm.

## Later releases

Alpha peer ranges such as `@vuemo/core: ^0.1.0-alpha.0` accept every later `0.1.0-alpha.N` and the `0.1.x` releases (semver allows prereleases of the same `major.minor.patch` that are greater than the base), so themes and plugins need no peer bump per alpha. They do not accept `0.2.0`.

All packages share one version. During the alpha, bump the prerelease number (`0.1.0-alpha.1`, `0.1.0-alpha.2`, ...) for every release, breaking or not.

1. Set the new version in all five `package.json` files: `pnpm -r exec npm version 0.1.0-alpha.1 --no-git-tag-version`. (`create-vuemo` reads the other versions when it is built, so the projects it generates always depend on the matching release.)
2. Move the "Unreleased" entries of `CHANGELOG.md` under the new version.
3. Commit, push, and run `pnpm release`.
4. Tag (`git tag v0.1.0-alpha.1 && git push --tags`) and create the GitHub Release.

## Going stable

When the API settles, release `0.1.0` (or `1.0.0`) without a prerelease suffix and publish it as `latest`: change `--tag alpha` in the `release` script of the root `package.json` to nothing (or use `--tag latest`). From then on `npm create vuemo` works without a tag. In the 0.x range `^0.1.0` only matches `0.1.x`, so a breaking change bumps the minor (`0.2.0`); a fix bumps the patch.

## Later: automate it

Once the packages exist on npm you can publish from GitHub Actions without keeping a token, using npm *trusted publishing* (each package gets a trusted workflow in its npmjs.com settings, which is only possible after its first release; needs Node 24 / npm 11.5 or newer), and manage versions and the changelog with [Changesets](https://github.com/changesets/changesets). This is not set up yet.
