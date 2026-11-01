<p align="center"><img width="120" src="static/img/logo.png" alt="vdoing for hugo"></p>

<h2 align="center">hugo-theme-vdoing</h2>

<p align="center">
  由 <a href="https://github.com/xugaoyi/vuepress-theme-vdoing">vuepress-theme-vdoing</a> 迁移而来的 Hugo 主题：知识库 + 博客。
</p>

![首页](docs/screenshots/home.png)

---

## 这是什么

这个仓库原本是 xugaoyi 的 VuePress 版「vdoing」主题 + 博客工程（已完整保留在 `legacy/`）。
现在它被改造成一个 **Hugo 站点 + `themes/vdoing` 主题**，并完成了内容迁移：

- 230 个内容页（其中 214 篇正式文章）全部迁移，**保留了原来的 `/pages/xxx/` 永久链接**，老站外链不失效；
- 首页卡片式文章列表 + 分页、结构化可折叠侧边栏、目录页、分类 / 标签 / 归档、右侧文章大纲、上一篇 / 下一篇、面包屑；
- 浅色 / 深色 / 阅读三种外观（跟随系统）、站内搜索、代码块复制、返回顶部、移动端抽屉式侧边栏；
- 原 VuePress 的 `::: tip` 容器语法已转换为 Hugo shortcode，渲染效果保持一致。

| 文章页 | 目录页 |
| --- | --- |
| ![文章页](docs/screenshots/article.png) | ![目录页](docs/screenshots/catalogue.png) |

| 归档 | 深色模式 |
| --- | --- |
| ![归档](docs/screenshots/archives.png) | ![深色](docs/screenshots/dark.png) |

---

## 快速开始

```bash
# 本地预览（热更新）
hugo server --disableFastRender

# 构建静态站点到 public/
hugo --minify
```

依赖：**Hugo extended 0.120+**（需要 SCSS 编译能力）。

---

## 目录结构

```
.
├── hugo.toml              # 站点配置（站名、主题参数、taxonomy、markup）
├── data/nav.yaml          # 顶部导航菜单（支持三层嵌套）
├── content/               # 文章内容（由 VuePress docs/ 迁移而来）
│   ├── _index.md          # 首页（heroText / tagline / features）
│   ├── archives.md        # 归档页  -> /archives/
│   ├── catalogue/         # 目录页  -> /web/ /ui/ /technology/ /more/
│   ├── posts/             # 碎片化文章（原 _posts/）
│   ├── 前端/ 页面/ 技术/ 更多/ 关于/ 收藏夹/
│   └── 《ES6 教程》笔记/ 《Vue》笔记/ …… （学习笔记专辑）
├── static/                # 图片、favicon、CNAME 等静态资源
├── themes/vdoing/         # 主题源码
│   ├── layouts/           # 模板、partials、shortcodes
│   ├── assets/scss/       # 样式（SCSS -> 带指纹的 CSS）
│   ├── assets/js/         # 交互脚本（主题模式 / 侧边栏 / 搜索 / 复制）
│   └── static/            # 主题自带静态文件
├── tools/                 # 迁移与校验脚本
│   ├── migrate_content.py # legacy/docs -> content 的一次性迁移脚本
│   └── check_links.py     # 构建后站内链接检查
├── archetypes/default.md  # hugo new 的文章骨架
└── legacy/                # 原 VuePress 工程（含 vdoing 主题源码），仅作参考
```

---

## 写文章

在 `content/` 下任意目录新建 `.md` 文件即可（或 `hugo new content/前端/xxx/新文章.md`）：

```yaml
---
title: 文章标题
date: 2024-05-01T10:00:00+08:00   # 使用带时区的 RFC3339
url: "/pages/abc123/"             # 永久链接，等价于 VuePress 的 permalink
categories: [前端, JavaScript文章]
tags: [JavaScript]
author:
  name: xugaoyi
  link: https://github.com/xugaoyi
weight: 1                         # 同级排序，等价于原文件名 "01." 序号
titleTag: 原创                     # 可选：标题旁小徽标
sticky: 1                         # 可选：首页置顶，数字越大越靠前
---

正文……
```

### 侧边栏与排序

- 左侧边栏 = 当前文章所在**顶级目录**的整棵目录树，顺序由 `weight` 决定（从小到大）。
- 子目录自动变成**可折叠分组**，分组的先后由该目录 `_index.md` 的 `weight` 决定。
- 目录本身不生成页面（`_index.md` 中 `build.render: never`），分组标题只负责展开 / 收起。
- 文章写 `sidebar: auto` 时，左侧边栏改为显示**本页标题大纲**（原主题碎片化文章的用法）。
- 想关闭侧边栏：`sidebar: false`。

### 目录页（catalogue）

`content/catalogue/*.md` 用于「前端 / 页面 / 技术 / 更多」这类汇总页：

```yaml
---
layout: catalogue
catalogue: "前端"          # 对应 content/前端 这一顶级目录
imgUrl: /img/web.png
description: JavaScript、ES6、Vue框架等前端技术
url: "/web/"
sidebar: false
article: false            # 不进入首页列表 / 归档 / 搜索
---
```

页面会把该目录下所有子目录渲染成卡片，卡片内是该子目录下全部文章链接。

### VuePress 容器的替代写法

原来的 `::: tip 标题 … :::` 已由迁移脚本转换成 Hugo shortcode：

```markdown
{{% block type="tip" title="鸡汤1" %}}
支持 **markdown** 的内容
{{% /block %}}
```

`type` 支持：`tip` / `warning` / `danger` / `note` / `theorem` / `details` / `center` / `right` / `cardList` / `demo`。

---

## 主题配置

全部在 `hugo.toml` 的 `[params]` 下：

| 参数 | 说明 |
| --- | --- |
| `logo` / `repo` / `themeColor` | 导航栏 logo、GitHub 仓库、浏览器 theme-color |
| `pageStyle` | `card` 卡片式 / `line` 线条式 |
| `postPageSize` | 首页每页文章数 |
| `searchMaxSuggestions` | 搜索下拉最多显示条数 |
| `defaultMode` | `auto` / `light` / `dark` / `read` |
| `rightMenuBar` / `sidebarOpen` / `sidebarDepth` | 右侧大纲开关、侧边栏初始状态、层级 |
| `blogger.{avatar,name,slogan}` | 首页右侧博主信息卡 |
| `[[params.social]]` | 社交图标（`icon-github` / `icon-youjian` / `icon-erji`，其他走 rss） |
| `footer.{createYear,copyrightInfo}` | 页脚版权 / 备案信息 |
| `author` / `authorLink` | 默认作者（文章未指定 `author` 时使用） |
| `editLinkRepo` / `editLinkText` | 文章底部「编辑本页」链接前缀 |

顶部导航在 `data/nav.yaml` 中维护；某个条目不写 `link` 即为纯分组标题。

### 外观模式

- 点击导航栏右侧的月亮图标循环切换：浅色 → 深色 → 阅读；
- 也可以用 URL 直接指定：`/?mode=dark`；
- 用户的选择保存在 `localStorage`，未选择过时跟随系统。

### 站内搜索

构建时首页额外输出 `index.json`（标题、链接、日期、分类、标签、正文摘要），前端输入时做本地过滤，不依赖任何第三方服务。
快捷键：`/` 或 `Ctrl/⌘ + K`。

---

## 与 VuePress 版的差异

**已实现**：首页卡片列表与分页、结构化侧边栏、目录页、分类 / 标签 / 归档、右侧文章大纲、上一篇 / 下一篇、面包屑、深色 / 阅读模式、站内搜索、代码块复制、返回顶部、移动端抽屉侧边栏、自定义容器。

**未实现（可按需自行接入）**：

- Gitalk 评论（原 `vuepress-plugin-comment`）；
- `vuepress-plugin-demo-block` 的可运行示例（现渲染为普通代码块）；
- 图片点击放大（`zooming`）、百度统计 / 百度自动推送；
- 「最近更新时间」按 git 提交时间计算（现用文章 `date`）。

---

## 从 VuePress 重新迁移

原 VuePress 工程整体移动到了 `legacy/`，迁移逻辑保留在脚本中：

```bash
python tools/migrate_content.py
```

脚本会清空并重建 `content/`，完成：`permalink → url`、`date` 归一化、序号前缀 → `weight`、`_posts → posts`、`@pages` 归档页、`pageComponent(Catalogue) → layout: catalogue`、`::: 容器 → shortcode`、`public/ → static/`。

构建后可用脚本校验站内链接：

```bash
hugo && python tools/check_links.py
```

---

## 部署

```bash
hugo --minify      # 产物：public/
```

把 `public/` 部署到任意静态托管（GitHub Pages / Vercel / Netlify / Nginx）即可。原站点的 `CNAME`、备案图标等静态文件已保留在 `static/`。

## 许可证

[MIT](LICENSE) · Copyright (c) 2019-present Evan Xu

原始主题：[vuepress-theme-vdoing](https://github.com/xugaoyi/vuepress-theme-vdoing)
