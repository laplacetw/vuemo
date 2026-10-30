/** Pure assertions of the theme contract: built HTML in, results out. No file system, no build. */

export interface CheckResult {
  id: string
  status: 'pass' | 'fail' | 'warn' | 'manual'
  message: string
}

/** What the fixture blog contains; `fixture.ts` writes these, the assertions look for them. */
export const FIXTURE = {
  titles: ['Check Post One', 'Check Post Two', 'Check Post Three'],
  /** Newest first on the home page. */
  newestTitle: 'Check Post Three',
  bodyMarkers: ['VUEMO_CHECK_BODY_1', 'VUEMO_CHECK_BODY_2', 'VUEMO_CHECK_BODY_3'],
  tag: 'check-tag-a',
  category: 'check-cat',
  pageMarker: 'VUEMO_CHECK_PAGE',
  aboutMarker: 'VUEMO_CHECK_ABOUT',
  /** Layout value no theme knows, and the body of the page that uses it. */
  unknownLayout: 'vuemo-check-unknown',
  unknownMarker: 'VUEMO_CHECK_UNKNOWN'
} as const

export interface PageHtml {
  home: string
  archive: string
  tag: string
  category: string
  page: string
  about: string
  post: string
  unknown: string
}

const pass = (id: string, message: string): CheckResult => ({ id, status: 'pass', message })
const fail = (id: string, message: string): CheckResult => ({ id, status: 'fail', message })

const count = (html: string, needle: string) => html.split(needle).length - 1

function contains(id: string, html: string, needle: string, okMsg: string, failMsg: string): CheckResult {
  return html.includes(needle) ? pass(id, okMsg) : fail(id, failMsg)
}

export const checkHome = (html: string) =>
  contains(
    'layout-home',
    html,
    FIXTURE.newestTitle,
    'home layout lists the newest post',
    `layout "home" did not render the posts: "${FIXTURE.newestTitle}" is missing from the home page. Register a \`home\` layout and list usePosts()/usePagination().`
  )

export function checkArchive(html: string): CheckResult {
  const missing = FIXTURE.titles.filter((t) => !html.includes(t))
  return missing.length
    ? fail('layout-archive', `layout "archive" did not list every post; missing: ${missing.join(', ')}. Render useArchives().`)
    : pass('layout-archive', 'archive layout lists all posts')
}

export const checkTag = (html: string) =>
  contains(
    'layout-tag',
    html,
    FIXTURE.tag,
    'tag layout lists the tags',
    `layout "tag" did not render the tag list: "${FIXTURE.tag}" is missing. Render useTags() (the selected tag comes from ?tag=).`
  )

export const checkCategory = (html: string) =>
  contains(
    'layout-category',
    html,
    FIXTURE.category,
    'category layout lists the categories',
    `layout "category" did not render the category list: "${FIXTURE.category}" is missing. Render useCategories() (the selected one comes from ?category=).`
  )

export const checkPage = (html: string) =>
  contains(
    'layout-page',
    html,
    FIXTURE.pageMarker,
    'page layout renders the page content',
    `layout "page" did not render the content: "${FIXTURE.pageMarker}" is missing. A page without \`layout\` must render <Content />.`
  )

export const checkAbout = (html: string) =>
  contains(
    'layout-about',
    html,
    FIXTURE.aboutMarker,
    'about layout renders the page content',
    `layout "about" did not render the content: "${FIXTURE.aboutMarker}" is missing. Register an \`about\` layout; rendering it as \`page\` is enough.`
  )

export const checkPost = (html: string) =>
  contains(
    'layout-post',
    html,
    FIXTURE.bodyMarkers[0],
    'post layout renders the post body',
    `layout "post" did not render the post body: "${FIXTURE.bodyMarkers[0]}" is missing. Posts get \`layout: post\` by default; register a \`post\` layout that renders <Content />.`
  )

/** Warn-level: a theme built on `extends: DefaultTheme` may render nothing for a layout it does not register. */
export function checkUnknownLayout(html: string): CheckResult {
  const id = 'unknown-layout'
  return html.includes(FIXTURE.unknownMarker)
    ? pass(id, 'a page with an unknown layout keeps its body')
    : {
        id,
        status: 'warn',
        message: `a page with an unknown layout (\`layout: ${FIXTURE.unknownLayout}\`) lost its body: "${FIXTURE.unknownMarker}" is missing. The contract leaves unknown values to the theme, but a theme built on VitePress \`extends\` renders an empty element for them. Register a catch-all, or treat an unknown layout as \`page\`; otherwise tell authors not to use layout values outside the seven.`
      }
}

const CONTENT_OPEN = /<([a-zA-Z][\w:-]*)[^>]*\sclass="(?:[^"]*\s)?vuemo-content(?:\s[^"]*)?"[^>]*>/

/** Index of the opening tag of the first element whose class list has `vuemo-content`, or -1. */
function contentStart(html: string): number {
  const m = CONTENT_OPEN.exec(html)
  return m ? m.index : -1
}

/** The `[start, end)` range of the first `vuemo-content` element's inner HTML (up to its matching close tag), or undefined. */
function contentRange(html: string): [number, number] | undefined {
  const m = CONTENT_OPEN.exec(html)
  if (!m) return undefined
  const tag = m[1]
  const from = m.index + m[0].length
  if (m[0].endsWith('/>')) return [from, from]
  const re = new RegExp(`<(/?)${tag}(?=[\\s>/])[^>]*>`, 'gi')
  re.lastIndex = from
  let depth = 1
  for (let t = re.exec(html); t; t = re.exec(html)) {
    if (t[1]) depth--
    else if (!t[0].endsWith('/>')) depth++
    if (depth === 0) return [from, t.index]
  }
  return [from, html.length]
}

export function checkVuemoContent(html: string): CheckResult {
  const start = contentStart(html)
  if (start < 0) {
    return fail('vuemo-content', 'no element with class "vuemo-content" in the post layout. Put the class on the post body element (e.g. <Content class="vuemo-content" />) so plugins can read the article text.')
  }
  const range = contentRange(html)!
  const marker = html.indexOf(FIXTURE.bodyMarkers[0], range[0])
  if (marker < 0 || marker >= range[1]) {
    return fail('vuemo-content', `the post body ("${FIXTURE.bodyMarkers[0]}") is not inside the element with class "vuemo-content". The class must be on the element that wraps the post content.`)
  }
  return pass('vuemo-content', 'post body is inside .vuemo-content')
}

const SLOT_NAMES = ['post-before-content', 'post-after-content', 'post-comments'] as const

export function checkSlots(html: string): CheckResult {
  const id = 'slots'
  const pos: number[] = []
  for (const name of SLOT_NAMES) {
    const needle = `data-vuemo-probe="${name}"`
    const n = count(html, needle)
    if (n === 0) {
      return fail(id, `slot "${name}" is not rendered in the post layout. Render the plugin components with <component :is="c" v-for="c in useSlots('${name}')" /> (see PluginSlot in the default theme).`)
    }
    if (n > 1) return fail(id, `slot "${name}" is rendered ${n} times; it must be rendered exactly once.`)
    pos.push(html.indexOf(needle))
  }
  const start = contentStart(html)
  const marker = html.indexOf(FIXTURE.bodyMarkers[0])
  const [before, after, comments] = pos
  if (start < 0 || marker < 0) {
    return fail(id, 'cannot verify the slot order without the post body inside .vuemo-content (see vuemo-content).')
  }
  if (!(before < start)) return fail(id, 'slot "post-before-content" must come before the post content (.vuemo-content).')
  if (!(after > marker)) return fail(id, 'slot "post-after-content" must come after the post content.')
  if (!(comments > after)) return fail(id, 'slot "post-comments" must come after "post-after-content".')
  return pass(id, 'the three standard slots are rendered once each, in order')
}

export const checkEnhanceApp = (html: string) =>
  contains(
    'enhance-app',
    html,
    'data-vuemo-probe="enhance-app"',
    'enhanceApp runs the plugins (runEnhanceApps)',
    "plugins' enhanceApp did not run: call runEnhanceApps(ctx) from @vuemo/core/client in the theme's enhanceApp (and return it)."
  )

/** Every build-based assertion. `post` is the HTML of a fixture post, `page` of a page without a layout, `about` of the About page. */
export function runAssertions(pages: PageHtml): CheckResult[] {
  const page = checkPage(pages.page)
  return [
    checkHome(pages.home),
    checkArchive(pages.archive),
    checkTag(pages.tag),
    checkCategory(pages.category),
    page,
    checkAbout(pages.about),
    checkPost(pages.post),
    checkVuemoContent(pages.post),
    checkSlots(pages.post),
    checkUnknownLayout(pages.unknown),
    // the probe sits in the page without a layout: if that page did not render, the result says nothing about enhanceApp
    page.status === 'fail' ? fail('enhance-app', 'skipped (layout-page failed)') : checkEnhanceApp(pages.page)
  ]
}
