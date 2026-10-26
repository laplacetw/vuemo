# @vuemo/plugin-ai-summary

A "summarize" button above the post content (`post-before-content` slot). The article text is sent to a Cloudflare Worker you own, which asks Workers AI (through AI Gateway) for a summary.

Enable it in `.vitepress/config.ts`; remove the key or set it to `false` to turn it off:

```ts
export default defineBlogConfig({
  aiSummary: { api: 'https://vuemo-summary.<you>.workers.dev' }
})
```

| Option | Description |
| --- | --- |
| `api` | Required. URL of your Worker. |
| `buttonText` | Label of the button. Default `🤖 AI Summary`. |
| `resultPrefix` | Text before the summary. Default `🤖 AI Summary : `. |

The theme must mark the article body with the class `vuemo-content` (the default theme does). Code blocks and footnotes are removed before sending.

## Styling contract

The plugin is theme-neutral: it ships no theme or utility classes and only a minimal base style, written with `:where()` so its specificity is 0 and any theme rule wins. Themes style these stable class names:

| Class | Element |
| --- | --- |
| `.vuemo-ai-summary` | root wrapper (`is-loading` is added while a request runs) |
| `.vuemo-ai-summary-button` | the button (the label is `buttonText`) |
| `.vuemo-ai-summary-dots` | loading indicator inside the button, containing three `.vuemo-ai-summary-dot` spans |
| `.vuemo-ai-summary-result` | the `<p>` with `resultPrefix` + the summary (replaces the button) |
| `.vuemo-ai-summary-error` | the `<p>` with the error message |

Custom properties: `--vuemo-ai-summary-dot-size` (default `0.5rem`) and `--vuemo-ai-summary-dot-gap` (default `0.5rem`). The dots bounce with a CSS animation that is turned off under `prefers-reduced-motion: reduce`. Put theme rules outside any CSS layer (or after the plugin) so they win over the base style.

## API contract

- Request: `POST <api>` with JSON `{ "message": "<article text>" }`
- Response: JSON `{ "summary": "<text>" }`. The AI Gateway shape `{ "response": { "result": { "response": "<text>" } } }` is also accepted.

## Worker example

`wrangler.toml`:

```toml
name = "vuemo-summary"
main = "src/index.js"
compatibility_date = "2025-01-01"

[ai]
binding = "AI"

[vars]
ALLOWED_ORIGIN = "https://your-blog.example.com"
GATEWAY_ID = "your-ai-gateway-id"
```

`src/index.js`:

```js
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin'
    }

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

    const { message } = await request.json().catch(() => ({}))
    if (typeof message !== 'string' || !message.trim()) {
      return Response.json({ error: 'message is required' }, { status: 400, headers: cors })
    }

    const result = await env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct',
      {
        messages: [
          { role: 'system', content: 'Summarize the article in 3 sentences, in the same language as the article.' },
          { role: 'user', content: message.slice(0, 12000) }
        ]
      },
      { gateway: { id: env.GATEWAY_ID } }
    )

    return Response.json({ summary: result.response }, { headers: cors })
  }
}
```

## CORS

The browser calls the Worker directly, so the Worker must answer the preflight `OPTIONS` request and send `Access-Control-Allow-Origin` with your blog's origin (scheme + host, no path, no trailing slash). During `pnpm dev` the origin is `http://localhost:5173`; change `ALLOWED_ORIGIN` temporarily, or return the request's `Origin` when it is on an allowlist. Avoid `*` in production: any website could then call the Worker from a visitor's browser. Note that CORS only restricts browsers: `curl` or a script ignores it, so it does not protect your quota. Use AI Gateway rate limits (below) or a check in the Worker for that.

Also consider rate limits on AI Gateway, since the endpoint is public.
