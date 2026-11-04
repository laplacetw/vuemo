# Vuemo

[English](./README.md) · **繁體中文** · [简体中文](./README.zh-CN.md)

以 [VitePress](https://vitepress.dev) 為基礎的輕量部落格框架。用 Markdown 寫文章，在一個設定檔裡選主題、開外掛。

Markdown、路由與建置交給 VitePress。Vuemo 只補上部落格需要的部分：文章模型、主題介面與精簡的外掛介面。

> **Alpha 階段。** API 仍可能變動。套件以 `alpha` 標籤發布。

## 快速開始

需要 Node.js 18.3 以上。

```sh
npm create vuemo@alpha my-blog
cd my-blog
npm install
npm run dev                  # 開啟 http://localhost:5173
npm run new my-first-post    # 建立 posts/my-first-post.md
```

`npm run build` 會把網站輸出到 `.vitepress/dist`。發布方式見[部署](./docs/deployment.md)。

## 專案結構

```
my-blog/
├── posts/              # 文章
├── public/             # 圖片等靜態檔案
├── vuemo.config.ts     # 所有設定
└── .vitepress/         # 自動產生，不需要修改
```

```ts
// vuemo.config.ts
import { defineBlogConfig } from '@vuemo/core'

export default defineBlogConfig({
  title: 'My Blog',
  hostname: 'https://example.com',   // 用於 sitemap、RSS 與 JSON-LD
  theme: '@vuemo/theme-default',     // 或先 npm install vuemo-theme-trigger 再寫 'trigger'
  nav: [{ text: 'Home', link: '/' }],
  search: true,
  comments: { provider: 'giscus', repo: 'me/blog' /* ... */ },
  aiSummary: false
})
```

每篇文章是一個帶 frontmatter 的 Markdown 檔案：

```yaml
---
title: My first post
date: 2026-01-01 10:00:00
category: Notes
tags: [vuemo]
---
```

## 功能

- 分頁首頁、歸檔、標籤、分類、上一篇與下一篇
- RSS、sitemap、JSON-LD 與站內全文搜尋
- 主題可從 npm 安裝，或解壓縮到 `themes/`
- 官方外掛：留言（Giscus、Utterances）、AI 摘要（Cloudflare Workers AI）、相簿（Cloudflare R2）
- VitePress Markdown 的所有功能：程式碼語法標示、提示區塊、數學式

## 文件

文件目前只有英文版。

| 指南 | 內容 |
| --- | --- |
| [Getting started](./docs/getting-started.md) | 建立部落格、常用指令 |
| [Configuration](./docs/configuration.md) | 所有設定與 frontmatter |
| [Markdown](./docs/markdown.md) | 提示區塊、程式碼區塊、數學式、註腳 |
| [Themes](./docs/themes.md) | 安裝與切換主題 |
| [Theme authoring](./docs/theme-authoring.md) | 製作主題、主題介面 |
| [Plugins](./docs/plugins.md) | 官方功能、撰寫外掛 |
| [Gallery](./docs/gallery.md) | 搭配 Cloudflare R2 的相簿 |
| [Deployment](./docs/deployment.md) | GitHub Pages、AWS Amplify |

## 套件

| 套件 | 用途 |
| --- | --- |
| [`@vuemo/core`](./packages/core) | 文章載入、`defineBlogConfig`、主題用的 composables、`vuemo` CLI |
| [`create-vuemo`](./packages/create-vuemo) | 建立部落格；加 `--template theme` 則建立主題 |
| [`@vuemo/theme-default`](./themes/default) | 精簡的預設主題，也是主題介面的參考實作 |
| [`@vuemo/plugin-comments`](./plugins/comments) | Giscus 或 Utterances 留言 |
| [`@vuemo/plugin-ai-summary`](./plugins/ai-summary) | 「摘要」按鈕，由你自己的 Cloudflare Worker 提供 |
| [`@vuemo/plugin-gallery`](./plugins/gallery) | 相簿與 `vuemo-gallery` 上傳 CLI |

本 repo 以外的主題：[vuemo-theme-trigger](https://github.com/laplacetw/vuemo-theme-trigger)。

## 開發

```sh
corepack enable
pnpm install
pnpm build      # 先建置套件，再建置範例部落格
pnpm test
pnpm dev        # 啟動 examples/blog 範例部落格
```

`pnpm verify` 會依序執行建置、測試、網站測試與主題介面檢查。

## 授權

[MIT](./LICENSE)
