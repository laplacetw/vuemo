# Vuemo

[English](./README.md) · [繁體中文](./README.zh-TW.md) · **简体中文**

基于 [VitePress](https://vitepress.dev) 的轻量博客框架。用 Markdown 写文章，在一个配置文件里选择主题、启用插件。

Markdown、路由和构建交给 VitePress。Vuemo 只补充博客需要的部分：文章模型、主题约定和精简的插件接口。

> **Alpha 阶段。** API 仍可能变化。包以 `alpha` 标签发布。

## 快速开始

需要 Node.js 18.3 或更高版本。

```sh
npm create vuemo@alpha my-blog
cd my-blog
npm install
npm run dev                  # 打开 http://localhost:5173
npm run new my-first-post    # 创建 posts/my-first-post.md
```

`npm run build` 会把网站输出到 `.vitepress/dist`。发布方式见[部署](./docs/deployment.md)。

## 项目结构

```
my-blog/
├── posts/              # 文章
├── public/             # 图片等静态文件
├── vuemo.config.ts     # 所有配置
└── .vitepress/         # 自动生成，无需修改
```

```ts
// vuemo.config.ts
import { defineBlogConfig } from '@vuemo/core'

export default defineBlogConfig({
  title: 'My Blog',
  hostname: 'https://example.com',   // 用于 sitemap、RSS 和 JSON-LD
  theme: '@vuemo/theme-default',     // 或先 npm install vuemo-theme-trigger 再写 'trigger'
  nav: [{ text: 'Home', link: '/' }],
  search: true,
  comments: { provider: 'giscus', repo: 'me/blog' /* ... */ },
  aiSummary: false
})
```

每篇文章是一个带 frontmatter 的 Markdown 文件：

```yaml
---
title: My first post
date: 2026-01-01 10:00:00
category: Notes
tags: [vuemo]
---
```

## 功能

- 分页首页、归档、标签、分类、上一篇和下一篇
- RSS、sitemap、JSON-LD 和站内全文搜索
- 主题可以从 npm 安装，也可以解压到 `themes/`
- 官方插件：评论（Giscus、Utterances）、AI 摘要（Cloudflare Workers AI）、相册（Cloudflare R2）
- VitePress Markdown 的全部功能：代码高亮、提示容器、数学公式

## 文档

文档目前只有英文版。

| 指南 | 内容 |
| --- | --- |
| [Getting started](./docs/getting-started.md) | 创建博客、常用命令 |
| [Configuration](./docs/configuration.md) | 所有配置项和 frontmatter |
| [Markdown](./docs/markdown.md) | 提示容器、代码块、数学公式、脚注 |
| [Themes](./docs/themes.md) | 安装和切换主题 |
| [Theme authoring](./docs/theme-authoring.md) | 开发主题、主题约定 |
| [Plugins](./docs/plugins.md) | 官方功能、编写插件 |
| [Gallery](./docs/gallery.md) | 基于 Cloudflare R2 的相册 |
| [Deployment](./docs/deployment.md) | GitHub Pages、AWS Amplify |

## 包

| 包 | 用途 |
| --- | --- |
| [`@vuemo/core`](./packages/core) | 文章加载、`defineBlogConfig`、供主题使用的 composables、`vuemo` CLI |
| [`create-vuemo`](./packages/create-vuemo) | 创建博客；加 `--template theme` 则创建主题 |
| [`@vuemo/theme-default`](./themes/default) | 精简的默认主题，也是主题约定的参考实现 |
| [`@vuemo/plugin-comments`](./plugins/comments) | Giscus 或 Utterances 评论 |
| [`@vuemo/plugin-ai-summary`](./plugins/ai-summary) | “摘要”按钮，由你自己的 Cloudflare Worker 提供 |
| [`@vuemo/plugin-gallery`](./plugins/gallery) | 相册和 `vuemo-gallery` 上传 CLI |

本仓库以外的主题：[vuemo-theme-trigger](https://github.com/laplacetw/vuemo-theme-trigger)。

## 开发

```sh
corepack enable
pnpm install
pnpm build      # 先构建各个包，再构建示例博客
pnpm test
pnpm dev        # 启动 examples/blog 示例博客
```

`pnpm verify` 会依次运行构建、测试、网站测试和主题约定检查。

## 许可证

[MIT](./LICENSE)
