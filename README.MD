<p align="center">
  <img width="120" src="static/img/logo.png" alt="vdoing for hugo">
</p>

<h2 align="center">hugo-theme-vdoing</h2>

<p align="center">
  由 <a href="https://github.com/xugaoyi/vuepress-theme-vdoing">vuepress-theme-vdoing</a> 完整迁移而来的 Hugo 主题：知识库 + 博客。
</p>

![首页](docs/screenshots/home.png)

---

## 这是什么

这个仓库原本是 xugaoyi 的 VuePress 版「vdoing」主题 + 博客工程（已完整保留在 `legacy/` 作为对照）。
现在它是一个 **Hugo 站点 + `themes/vdoing` 主题**：不仅完成了内容迁移，主题的 DOM 结构、样式与交互也按原版 `legacy/vdoing` 逐组件移植并对齐。

- 230 个内容页（其中 214 篇正式文章）全部迁移，**保留原 `/pages/xxx/` 永久链接**，老站外链不失效；
- 保留原版的全部主题配置项（`pageStyle`、`bodyBgImg`、`contentBgStyle`、`titleBadge`、`rightMenuBar`、`pageButton`、`updateBar`、`htmlModules`、`baidu`、`zooming`、`sidebar`、`prevLinks/nextLinks` …）；
- 原版 vendored 的 iconfont 图标库、标题徽标、Prism 浅色/深色代码主题均已本地化，**不依赖任何外部 CDN**（统计按配置可关）；评论区按需求移除。

| 文章页 | 目录页 |
| --- | --- |
| ![文章页](docs/screenshots/article.png) | ![目录页](docs/screenshots/catalogue.png) |

| 归档 | 深色模式 |
| --- | --- |
| ![归档](docs/screenshots/archives.png) | ![深色](docs/screenshots/dark.png) |

---

## 与原版对齐的功能

**外壳 / 导航**

- 顶栏 `.navbar.blur`：logo + 站名、搜索框、三层嵌套导航（`data/nav.yaml`，桌面 hover / 移动端点击展开）、当前页高亮、仓库链接（GitHub/GitLab/Bitbucket/Source 按域名自动推断）、向下滚动自动隐藏；
- 导航外链 / `mailto:` / `tel:` 自动加 `target/_blank` `rel=noopener noreferrer` 与外链箭头图标；导航区宽度随视口自适应，长菜单不压住站名；
- 左侧边栏：结构化目录树（按 `weight` 排序、可折叠分组、同时只展开当前分支）、**当前文章在侧边栏展开 h2~h6 标题子项**、`displayAllHeaders`、页面/分组/站点三级 `sidebarDepth`、`collapsable:false`、默认展开第一个分组、`sidebar: auto` 碎片文章显示本页大纲并随滚动高亮、桌面左缘悬停弹出、收起状态记忆、移动端抽屉 + 遮罩 + 右滑手势；
- 移动端侧边栏博主信息卡（`.blogger`，无 `blogger.social` 时显示 slogan，与原版一致）；
- 右下角圆形按钮组：返回顶部（淡入淡出）、主题模式选择框（扇出动画，`auto / light / dark / read` 四项），旧版 `mode` localStorage 键自动迁移到 `vdoing-mode`；
- `bodyBgImg` 背景大图（单图 / 多图轮播 + 透明度，`0` 值合法）、`theme-style-line` 线条风格、footer 社交图标与备案信息；
- 自定义 HTML 模块（`data/htmlModules.yaml`）：`homeSidebarB` / `sidebarT` / `sidebarB` / `pageT` / `pageB` / `windowLB` / `windowRB`，支持 `*showMode: article|custom`。

**文章页**

- 面包屑（首页 / 顶级目录 → 目录页 / 子目录 → 目录页锚点）、作者 / 日期 / 分类；
- 标题前随机徽标（`titleBadge`，`titleBadgeIcons` 可自定义且支持相对路径）、`titleTag` 小徽标、`contentBgStyle` 1~6 内容区背景纹；
- 右侧文章大纲（h2~h6，滚动高亮、点击平滑滚动，`smoothScroll` 开关生效）、中部左右固定快捷翻页按钮 + tooltip、底部上一篇 / 下一篇（**顺序与侧边栏一致，不再出现「上一篇 == 下一篇」**，支持 `prevLinks`/`nextLinks` 总开关与 frontmatter `prev`/`next` 单页覆盖）；
- 编辑链接（GitHub / GitLab / Gitee / Bitbucket 自动识别，带外链图标，`editLink: false` 可关）、标签列表、最近更新时间（优先 `enableGitInfo` 的 git 提交时间，可用 `lastUpdatedFallbackToDate` 回落到 frontmatter 日期）；
- 「最近更新」栏（`updateBar.showToArticle` 可关）、`pageT` / `pageB` 自定义 HTML 槽位。

**首页 / 列表 / 归档 / 分类 / 标签 / 目录页**

- 首页 banner：网格纹背景、`bannerBg`（auto / none / 图片 / 自定义 CSS）、heroImage / heroText / tagline / actionButton、features 卡片 + 移动端轮播（首尾克隆无缝循环、100px 拖动阈值、鼠标拖拽、惯性、自动播放）；
- 首页文章列表：`postList: detailed | simple | none`、`sticky` 置顶、`postPageSize` 分页、`hideRightBar`、右侧博主卡 / 分类 / 标签 / `homeSidebarB`；**摘要保留图片与富文本**（`.Summary`，图片限高 280px）；
- 归档页：年份 sticky 分组、总数 / 年度篇数、日期 + 标题 + `titleTag` + 标题徽标，**首屏 80 条 + 滚动/点击加载更多**（无 JS 时全量可见）；
- 分类 / 标签页：原版 URL 行为 `/categories/?category=xxx`、`/tags/?tag=xxx`（轻索引 `index.json` 前端过滤 + 分页；服务端只渲染首屏，页面体积 -85%，带 `<noscript>` 与 `rel=canonical` 降级），分类按文章首次出现顺序、标签按名称哈希稳定配色，term 页置顶排序与首页一致；
- 目录页：`column-wrapper`（图片 + 标题 + 描述）+ 原版编号大纲 `1. / 1-1. / 1-1-1.`，`#锚点` 与面包屑联动，并渲染「编辑 / 上次更新 / 上下篇」；`catalogue:` 配置错误构建时 `WARN`；
- 404：大号 404 + **每次加载随机文案**（`data-msgs` + JS）+ 返回首页。

**Markdown 渲染**

- 标题 hover 显示 `#` 锚点；代码块：语言标签、行号（`lineNos = inline`）、`{hl_lines=[..]}` 行高亮、一键复制（自动剔除行号）、`CodeGroup` / `CodeBlock` 标签页；
- 自定义容器：`tip / warning / danger / note / theorem / details / center / right / cardList / cardImgList`（含原版配色、深色适配；`cardList` 直接解析容器内的 YAML 数据渲染成卡片，`demo` 容器带「预览 / 代码」切换、sandbox iframe 实时预览、`horizontal` 并排模式，Vue `<template>` demo 给出降级说明）；
- `Badge` 短代码、kbd、表格、引用、居中容器等原版排版；图片点击放大后支持**滚轮缩放、双击缩放/复位、拖拽平移、移动端双指手势**（`zooming` 可配背景色/选择器）；
- Prism 浅色/深色/阅读模式 token 配色（含 `operator`、`function-name` 等补齐）。

**其他**

- 站内搜索（轻/重索引分离）：列表用 `/index.json`（约 210KB，gzip 45KB），全文检索用 `/search-index.json`（约 2.8MB，gzip 873KB，**首次输入关键词才拉取**）；索引全部正文 + h2~h6 小节标题，结果带命中片段高亮、可直达小节锚点，支持 ↑↓/Enter/Esc、`searchMaxSuggestions`、`search: false`、`searchPlaceholder`、第三方搜索外链（`[[params.thirdpartySearch]]`）与可选 Algolia（`[params.algolia]`）；
- 主题模式三套配色 + `auto` 跟随系统，`localStorage` 记忆，`?mode=dark` 直接指定；
- 百度统计 / 百度自动推送 / 百度站长验证 meta、OpenGraph、Twitter Card、canonical、RSS、robots.txt、sitemap.xml；
- 自定义 `<head>` 注入点与自定义样式（`head` / `customCss` / `customStyleFile`，对应原 VuePress `head` 与 `.vuepress/styles`）；
- 打印样式、419 / 719 / 959 / 1279 / 1520 断点响应式。

---

## 快速开始

```bash
# 本地预览（热更新）
hugo server --disableFastRender

# 构建静态站点到 public/
hugo --minify

# 一键验收：构建 + 站内链接检查 + 关键页面截图（输出到 .tmp/verify-*.png）
powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify.ps1

# 与原版差距修复项的逐条断言（-Toggles 会额外验证配置开关是否真的生效）
powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify_parity.ps1 -Toggles
```

依赖：**Hugo extended 0.156+**（需要 SCSS 编译能力），Python 3（迁移/校验脚本），Node（截图脚本）。

> 「上次更新」取 git 提交时间：Hugo 的 git 集成在 `core.quotepath=true`（git 默认）时对中文文件名返回 nil。
> 想让中文文章也显示 git 时间，在本仓库执行一次 `git config core.quotepath false`；
> 否则会按 `lastUpdatedFallbackToDate`（默认 `true`）回落到 frontmatter 的 `date`。

---

## 目录结构

```
.
├── hugo.toml              # 站点配置（站名、主题参数、taxonomy、markup、git 信息）
├── data/
│   ├── nav.yaml           # 顶部导航菜单（支持三层嵌套、外链、mailto/tel）
│   └── htmlModules.yaml   # 自定义 HTML 模块（侧边栏 / 页面顶部底部 / 左右下角窗口）
├── content/               # 文章内容（由 VuePress docs/ 迁移而来）
│   ├── _index.md          # 首页（heroText / tagline / features / bannerBg / postList …）
│   ├── archives.md        # 归档页  -> /archives/
│   ├── catalogue/         # 目录页  -> /web/ /ui/ /technology/ /more/
│   ├── posts/             # 碎片化文章（原 _posts/，sidebar: auto）
│   ├── 前端/ 页面/ 技术/ 更多/ 关于/ 收藏夹/
│   └── 《ES6 教程》笔记/ 《Vue》笔记/ …… （学习笔记专辑）
├── static/                # 站点图片、favicon、CNAME、备案图标
├── themes/vdoing/
│   ├── layouts/           # 模板 / partials / shortcodes / _markup 渲染钩子
│   ├── assets/scss/       # 样式，按区域拆分为 partial（variables/base/navbar/sidebar/article/…）
│   ├── assets/js/         # 交互脚本，构建时按文件名拼接成一个 main.js
│   └── static/            # 主题自带静态资源（iconfont、标题徽标、兜底 css）
├── tools/                 # 迁移与校验脚本（migrate_content.py / check_links.py / verify.ps1 / verify_parity.ps1）
├── docs/                  # 截图 + 与原版的对齐说明（parity-plan.md / parity-gaps.md）
├── archetypes/default.md  # hugo new 的文章骨架（含全部可选 frontmatter 说明）
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
sticky: 1                         # 可选：置顶，数字越大越靠前
editLink: false                   # 可选：关闭本页「编辑」链接
sidebar: auto                     # 可选：左侧边栏改为本页大纲（碎片文章）
sidebar: false                    # 可选：关闭左侧边栏
sidebarDepth: 2                   # 可选：本页侧边栏/大纲层级（覆盖分组/站点）
article: false                    # 可选：自定义页（不进列表 / 归档 / 搜索）
search: false                     # 可选：本页隐藏顶部搜索框（页面级，原 Navbar 行为）
prev: false                       # 可选：隐藏「上一篇」（也可写 "/pages/xxx/" 覆盖目标）
next: false                       # 可选：隐藏「下一篇」（也可写 "/pages/xxx/" 覆盖目标）
---
```

`archetypes/default.md` 已列出全部可选字段（对应原版 `extendFrontmatter` 能力），`hugo new` 生成后按需取消注释。
碎片化文章（`content/posts/`）未写分类时，迁移脚本会使用 `categoryText`（默认「随笔」）作为默认分类。

### 侧边栏与排序

- 左侧边栏 = 当前文章所在**顶级目录**的整棵目录树，顺序由 `weight` 决定（从小到大）；
- 子目录自动变成**可折叠分组**，分组先后由该目录 `_index.md` 的 `weight` 决定；分组可用 `_index.md` 的 `sidebarDepth` 控制子项层级；
- 目录本身不生成页面（`_index.md` 中 `build.render: never`），分组标题只负责展开 / 收起；
- 当前文章的 h2~h6 会作为子项展开在侧边栏中（`[params.sidebar].displayAllHeaders = true` 可让所有页面都展开）。

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
article: false
---
```

### VuePress 容器的替代写法

原来的 `::: tip 标题 … :::` 已由迁移脚本转换成 Hugo shortcode：

```markdown
{{% block type="tip" title="鸡汤1" %}}
支持 **markdown** 的内容
{{% /block %}}
```

`type` 支持：`tip` / `warning` / `danger` / `note` / `theorem` / `details` / `center` / `right` / `cardList` / `cardImgList` / `demo`；
`cardList` / `cardImgList` 容器内直接放一段 ```yaml 数据即可渲染成原版卡片列表（见 `content/更多/友情链接.md`）。

---

## 主题配置

站点配置在 `hugo.toml` 的 `[params]` 下（注意 TOML 子表要放在普通 key 之后）：

| 参数 | 说明 |
| --- | --- |
| `logo` / `repo` / `repoLabel` / `themeColor` | 导航栏 logo、仓库、仓库链接文字（缺省按仓库域名推断平台）、浏览器 theme-color |
| `pageStyle` | `card` 卡片式 / `line` 线条式（非法值回落 `card`；有 `bodyBgImg` 时强制 `card`） |
| `bodyBgImg` / `bodyBgImgOpacity` / `bodyBgImgInterval` | body 背景大图（数组则轮播；`0` 也是合法值） |
| `contentBgStyle` | 内容区背景纹 `1~6`，`0` 为无 |
| `titleBadge` / `titleBadgeIcons` | 标题前随机徽标（自定义图标支持相对路径） |
| `sidebarOpen` / `sidebarHoverTriggerOpen` / `sidebarDepth` | 侧边栏初始状态 / 悬停弹出 / 站点级层级 |
| `[params.sidebar]` | `depth` / `collapsable` / `displayAllHeaders`（结构化侧边栏行为） |
| `rightMenuBar` / `pageButton` / `smoothScroll` | 右侧大纲 / 中部快捷翻页 / 大纲与锚点平滑滚动 |
| `defaultMode` | `auto` / `light` / `dark` / `read` |
| `navbar` | 是否显示顶部导航 |
| `postPageSize` / `searchMaxSuggestions` / `archivePageSize` | 首页每页文章数 / 搜索下拉条数 / 归档首屏条数 |
| `search` / `searchPlaceholder` | 关闭站内搜索 / 搜索框占位符 |
| `[[params.thirdpartySearch]]` | 第三方搜索外链（`name` + `link`，`{query}` 为关键词占位符） |
| `[params.algolia]` | 可选 Algolia 检索（`appId` / `apiKey` / `indexName` 全部非空时启用，失败回落本地） |
| `prevLinks` / `nextLinks` | 是否显示上一篇 / 下一篇（frontmatter `prev`/`next` 可单页覆盖） |
| `editLinks` / `editLinkText` / `docsRepo` / `docsDir` / `docsBranch` | 文章底部「编辑本页」（GitHub/GitLab/Gitee/Bitbucket 自动识别） |
| `lastUpdated` / `lastUpdatedFallbackToDate` | 「上次更新」文案 / 无 git 信息时是否回落 frontmatter 日期 |
| `author` / `authorLink` | 默认作者（文章未指定 `author` 时使用） |
| `category` / `tag` / `archive` / `categoryText` | 分类 / 标签 / 归档开关与碎片文章默认分类 |
| `head` / `customCss` / `customStyleFile` | 自定义 head HTML / 内联 CSS / 额外 CSS 文件（原 VuePress head 与自定义样式） |
| `blogger.{avatar,name,slogan}` | 首页右侧 / 移动端侧边栏博主信息卡 |
| `[[params.social]]` | 社交图标（`iconClass` 取 iconfont 类名，如 `icon-github`） |
| `footer.{createYear,copyrightInfo}` | 页脚版权 / 备案信息 |
| `[params.updateBar]` | 最近更新栏（`showToArticle` / `moreArticle`） |
| `[params.baidu]` | 百度统计 / 自动推送 / 站长验证（留空即关闭） |
| `[params.zooming]` | 图片放大（`enable` / `bgColor` / `selector`） |

自定义 HTML 模块放在 `data/htmlModules.yaml`，顶部导航在 `data/nav.yaml` 中维护（某个条目不写 `link` 即为纯分组标题；外链写完整 URL 即自动加 `target/rel` 与图标）。

### 外观模式

- 右下角圆形按钮组的主题选择框：浅色 → 深色 → 阅读 → 跟随系统（`auto`）；
- 也可以用 URL 直接指定：`/?mode=dark`；
- 用户的选择保存在 `localStorage`（键 `vdoing-mode`），未选择过时跟随系统；旧版 `mode` 键会自动迁移。

### 评论

本复刻不提供评论区（gitalk 相关模板、初始化脚本、本地静态资源均已移除；构建产物中不会出现评论区、去评论按钮，也不会有任何 gitalk 网络请求）。

### 站内搜索

构建时首页额外输出两个 JSON：

- `/index.json`（轻索引，约 210KB / gzip 45KB）：标题、链接、日期、分类、标签、HTML 摘要 —— 供分类/标签页过滤分页与列表重建；
- `/search-index.json`（全文索引，约 2.8MB / gzip 873KB）：正文全文 + h2~h6 小节标题与锚点 —— 只在用户**首次输入关键词**时才拉取一次，不搜索的访客不会下载。

前端本地过滤，不依赖任何第三方服务：结果带命中片段高亮、可直达小节锚点，支持 ↑↓/Enter/Esc，
`/` 或 `Ctrl/⌘ + K` 唤起；可选 Algolia（`[params.algolia]`，失败自动回退本地索引）。

---

## 与 VuePress 版的差异

**已对齐**：导航（含外链）/ 侧边栏（含当前页标题子项、层级、折叠）/ 首页 banner 与文章列表（含富文本摘要、轮播）/ 文章页（面包屑、徽标、编辑链接四平台、上次更新、右侧大纲、上下篇、最近更新栏）/ 归档（渐进加载）/ 分类 / 标签（前端过滤 + 无 JS 降级）/ 目录页 / 404 运行时随机文案 / 代码块与自定义容器 / CodeGroup / demo 预览 / 正文外链自动 target/rel + 外链图标 / 图片放大缩放拖拽手势 / 三套主题模式 / body 背景图 / 自定义 HTML 模块 / 百度统计 / 站内搜索（轻/重索引分离、小节定位、键盘导航）/ 原站 5 条第三方搜索外链（MDN / Runoob / Vue API / Bing / 百度站内）/ 平滑滚动开关 / 自定义 head 与样式注入 / 旧 VuePress 锚点深链兼容。

**有意不同 / 已知限制**：

- 分类、标签页为「服务端渲染首屏 + 前端 query 过滤分页」：无 JS 时只有首屏 10 条 + 原生 term 页链接（原版是纯 SPA，无 JS 时整页空白）；
- `demo` 容器的 Vue SFC 实时预览与 CodePen/JSFiddle 外链为有意替代：纯静态站无运行时编译，Vue demo 给出降级说明、可查看源码，HTML demo 仍可实时预览；
- 未接入 `nprogress` 进度条与 SPA 路由能力（无刷新路由、链接预取、滚动位置恢复）——多页架构使然；
- Algolia 为可选能力（需自备凭据），默认使用本地索引：轻索引 `/index.json`（约 210KB / gzip 45KB）供列表过滤，全文 `/search-index.json`（约 2.8MB / gzip 873KB）仅在首次输入关键词时拉取；
- 标签配色改为按标签名哈希稳定取色（原版每次加载随机；静态构建无法在运行时随机，这里保证同一标签跨构建颜色固定、不同标签分布随机）；
- `hl_lines` 行高亮语法改为 Hugo 的 `{hl_lines=[..]}`（原版 ` ```js{1,3}`）；行号仍为内联渲染（原版独立列，视觉差异、功能等价）；
- 锚点算法本身是 Hugo `anchorize`（与原版 VuePress slugify 不同），已内置 `assets/js/anchor-compat.js`：旧 `#slug` 深链找不到 id 时按 VuePress 规则重新匹配标题并跳转、同时把 hash 换成新 id（best-effort，站内链接已校验 0 missing）；
- 中文文件名的「上次更新」需 `git config core.quotepath false` 才能取到 git 时间，否则回落 frontmatter 日期。

完整的逐项对比、证据（两侧 `file:line`）、优先级与修复记录见
**[docs/parity-gaps.md](docs/parity-gaps.md)**（约 280 个功能点；第二轮已修复 P0~P3 共 60 余项，见该文 `0.5 修复进展`）。

---

## 从 VuePress 重新迁移 / 开发校验

原 VuePress 工程整体保留在 `legacy/`，迁移与校验脚本都在 `tools/`：

```bash
# 重新生成 content/（会清空重建，谨慎）
python tools/migrate_content.py

# 迁移脚本支持的参数（对应原 setFrontmatter 能力）
python tools/migrate_content.py --config hugo.toml        # 读取 categoryText / category / tag 等
python tools/migrate_content.py --category-text 随笔      # 覆盖碎片文章默认分类
python tools/migrate_content.py --extend-frontmatter 备注=xxx
python tools/migrate_content.py --static-dir static

# 构建后校验站内链接（0 missing 为通过）
hugo --minify && python tools/check_links.py

# 一键验收：构建 + 链接检查 + 关键页面截图（截图输出到 .tmp/verify-*.png）
powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify.ps1

# 与原版差距修复项的逐条断言（上下篇/搜索/列表/侧边栏/外壳；-Toggles 验证配置开关）
powershell -NoProfile -ExecutionPolicy Bypass -File tools/verify_parity.ps1 -Toggles

# 单个页面截图（本地静态服务 + Edge/Chrome headless）
# 视口宽度由 CDP Emulation 精确设定（tools/screenshot.cjs）；不要用浏览器 --window-size 截图，
# 窗口尺寸 ≠ CSS 视口宽度，1279/1280 断点会截出「大纲被裁掉」的假象
tools\screenshot.cmd -BuildDir public -Page "/pages/8143cc480faf9a11/" -Port 8899 -Out .tmp/a.png -Width 1440 -Height 1000
```

> 构建时如需并行/避免构建锁：`hugo --noBuildLock --cacheDir "<绝对路径>/.tmp/cache"`；
> 无外网环境做截图验收时用 `tools/qa.toml` 覆盖配置关闭百度统计：`--config hugo.toml,tools/qa.toml`。
> 截图依赖本机 Edge/Chrome 与 Node（`tools/screenshot.cjs` 走 CDP，无需 npm 依赖）。
> `docs/parity-plan.md` 记录了与 `legacy/vdoing` 逐组件的对齐方式、文件映射和宽屏布局/截图踩坑记录。

---

## 部署

```bash
hugo --minify      # 产物：public/
```

把 `public/` 部署到任意静态托管（GitHub Pages / Vercel / Netlify / Nginx）即可。原站点的 `CNAME`、备案图标等静态文件已保留在 `static/`。

## 许可证

[MIT](LICENSE) · Copyright (c) 2019-present Evan Xu

原始主题：[vuepress-theme-vdoing](https://github.com/xugaoyi/vuepress-theme-vdoing)
