# hugo-theme-vdoing 与 VuePress 原版的对齐计划

> 状态：**已完成**。四个区域（article / markdown / pages / shell）均已按本文约定实现并验收（构建 0 错误、站内链接 0 missing、关键页面截图核对）。
> 本文保留作为「原版组件 → Hugo 模板/样式/脚本」的映射说明，便于后续维护。

参考实现：`legacy/vdoing`（原 vuepress-theme-vdoing 源码）与 `legacy/docs`（原站点）。
目标：Hugo 版主题在 **DOM 结构 / 功能 / 视觉** 上尽量对齐原版，同时保持 Hugo 的静态能力与已有迁移内容不变。

## 架构（重要：所有人遵守）

- 模板复用原版的 class 名（`.theme-container` / `.page` / `.theme-vdoing-wrapper` / `.main-wrapper` / `.post-list` …），CSS 直接从 `legacy/vdoing/**/*.styl`、组件 `<style>` 中的 stylus 移植为 SCSS。
- 图标：原版的 iconfont 已下载并内置到 `themes/vdoing/static/css/iconfont.css` + `static/fonts/iconfont.*`。
  直接用原版的写法：`<a class="iconfont icon-github"></a>`，不要再造 SVG 图标。
- 图片：`/img/title-badge/{1,2,3}.png` 为原版标题前的随机徽标（对应 titleBadge）。
- 主题配置全部集中在 `hugo.toml` 的 `[params]`（由 Lead 维护，**其他人不要改 hugo.toml**）。
- 自定义 HTML 模块在 `data/htmlModules.yaml`（`site.Data.htmlModules`）。
- JS 采用多文件拼接：`assets/js/*.js` 会被 `scripts.html` 用 `resources.Match` 按文件名排序拼接成 `js/main.js`。
  每个文件用 IIFE 包裹，互不依赖执行顺序；不要修改别人的 js 文件。
- SCSS：`assets/scss/main.scss` 只做 `@import`，每个区域一个 partial（见下）。

## 文件归属（写作用域，互不重叠）

Lead：
```
hugo.toml  data/htmlModules.yaml  README.MD  docs/**
themes/vdoing/assets/scss/main.scss _variables.scss _base.scss _print.scss
themes/vdoing/layouts/_default/baseof.html
themes/vdoing/layouts/partials/head.html  scripts.html  icon.html(弃用)
themes/vdoing/layouts/partials/func/page-classes.html  func/has-sidebar.html
themes/vdoing/assets/js/search.js  gitalk.js
themes/vdoing/static/css/iconfont.css  static/fonts/*
tools/**
```

article（文章页 / 目录 / 翻页 / 评论容器）：
```
layouts/_default/single.html
layouts/partials/article-info.html  page-edit.html  page-nav.html
layouts/partials/update-bar.html  right-menu.html  page-slot.html  comment.html
assets/scss/_article.scss
assets/js/toc-scroll.js
```

markdown（正文渲染 / 代码块 / 容器 / 图片放大）：
```
layouts/_default/_markup/render-heading.html
layouts/shortcodes/block.html  badge.html  code-group.html  code-block.html
assets/scss/_markdown.scss  _code.scss  _containers.scss
assets/js/code.js  zoom.js
```

pages（首页 / 列表 / 归档 / 分类 / 标签 / 目录页 / 404）：
```
layouts/index.html
layouts/_default/archives.html  list.html  taxonomy.html  terms.html  catalogue.html  404.html
layouts/partials/post-list.html  post-meta.html  pagination.html
layouts/partials/blogger-bar.html  categories-bar.html  tags-bar.html  catalogue-links.html
layouts/partials/update-article.html
assets/scss/_home.scss  _lists.scss  _pages.scss
assets/js/home.js  pages.js
```

shell（导航 / 侧边栏 / 页脚 / 按钮 / 背景 / html 模块 / 主题模式）：
```
layouts/partials/header.html  nav.html  sidebar.html  sidebar-tree.html  sidebar-toc.html
layouts/partials/footer.html  buttons.html  body-bg.html  html-modules.html
layouts/partials/custom-windows.html  blogger-sidebar.html
assets/scss/_navbar.scss  _sidebar.scss  _shell.scss  _buttons.scss
assets/js/shell.js
```

## 页面骨架约定（baseof.html 已固定，不要改）

```html
<html class="theme-mode-light theme-style-card">
<body>
  <div class="theme-container {page-classes}">
    {{ partial "header.html" . }}          <!-- .navbar -->
    <div class="sidebar-mask"></div>
    <div class="sidebar-hover-trigger"></div>
    {{ partial "sidebar.html" . }}         <!-- .sidebar，内部自己决定显示什么 -->
    {{ block "main" . }}{{ end }}
    {{ partial "footer.html" . }}
    {{ partial "buttons.html" . }}
    {{ partial "body-bg.html" . }}
    {{ partial "custom-windows.html" . }}
  </div>
</body>
```

`page-classes` 会给出：`no-navbar` `sidebar-open` `no-sidebar` `have-rightmenu`
`have-body-img` `theme-style-line` `hide-navbar`（后两个由 JS 追加）。

各布局的 `{{ define "main" }}` 对应原版：

- **文章页** `Page.vue`：`<main class="page"><div class="theme-vdoing-wrapper">…`
- **首页** `Home.vue`：`<div class="home-wrapper"><div class="banner">…<div class="main-wrapper"><div class="main-left">…<div class="main-right">…`
- **归档** `ArchivesPage.vue`：`<div class="custom-page archives-page"><div class="theme-vdoing-wrapper">…`
- **分类页** `CategoriesPage.vue`：`<div class="custom-page categories-page"><div class="main-wrapper">…`
- **标签页** `TagsPage.vue`：`<div class="custom-page tags-page"><div class="main-wrapper">…`
- **目录页** `Catalogue.vue`：`<div class="theme-vdoing-content"><div class="column-wrapper">…<div class="catalogue-wrapper">…`
- **404** `404.vue`：`<div class="theme-vdoing-content custom-page">…`

## 注意事项

1. 迁移后的内容目录是中文目录名（`content/前端/…`），原版靠文件名序号生成侧边栏，
   Hugo 版靠 frontmatter `weight`。侧边栏顺序一律用 `ByWeight`。
2. 原文用 `::: cardList` / `::: cardImgList` 包住一段 ```yaml 列表，迁移脚本只保留了
   `{{% block type="cardList" %}}` 外壳，**内部还是 yaml 代码块**，需要 shortcode 解析 yaml 后
   渲染成原版的 `.cardListContainer > .card-list > .card-item`（这是当前页面渲染 bug）。
3. 文章内链锚点：原版标题 hover 显示 `#`。用 goldmark render-heading hook 实现。
4. 原版分页/分类/标签页是 **SPA 内 query 参数过滤**（`/categories/?category=xxx`），
   Hugo 端用纯前端 JS + `index.json` 数据实现同样的 URL 行为；同时保留 Hugo 自动生成的
   term 页作为兜底，但模板内链接一律用 query 形式，和原版一致。
5. 评论用 gitalk（配置见 hugo.toml `[params.gitalk]`），容器 id 沿用原版命名。
6. 不要引入 npm 依赖、不要联网请求外部资源（iconfont/徽标已本地化；gitalk/百度统计按配置可关闭）。
7. 每个区域完成后必须 `hugo --destination .tmp/build-<名字> --quiet` 构建通过，并用
   `tools/screenshot.ps1` 截图自查；完成后在 team task 里说明改了哪些文件、还有什么没做。

## 原版样式来源速查

| Hugo partial | legacy 来源 |
| --- | --- |
| _base | styles/index.styl(基础部分), wrapper.styl, arrow.styl, toc.styl, palette.styl |
| _navbar | components/Navbar.vue, NavLinks.vue, NavLink.vue, DropdownLink.vue, VuePress SearchBox 样式 |
| _sidebar | components/Sidebar.vue, SidebarGroup/Link/Links/Button.vue, styles/mobile.styl |
| _shell | components/MainLayout.vue, Footer.vue, Buttons.vue, BodyBgImg.vue, layouts/Layout.vue 内 style |
| _article | components/Page.vue, ArticleInfo.vue, PageEdit.vue, PageNav.vue, UpdateArticle.vue, RightMenu.vue |
| _markdown | styles/index.styl(内容部分), styles/markdown-container.styl |
| _code | styles/code.styl, code-theme.styl |
| _containers | styles/custom-blocks.styl, global-components/*.vue, index.js 里 cardList 的 DOM |
| _home | components/Home.vue 内 style |
| _lists | components/PostList.vue, Pagination.vue, BloggerBar.vue, CategoriesBar.vue, TagsBar.vue |
| _pages | components/ArchivesPage.vue, CategoriesPage.vue, TagsPage.vue, Catalogue.vue, layouts/404.vue |

## 宽屏布局与截图验证（踩坑记录）

1. **文章页 + 右侧大纲的整体居中**：右侧大纲是浮动元素
   （`.right-menu-wrapper { float: right; margin-right: -(230px + 55px) }`），会比 `.content-wrapper`
   右边界再溢出 285px。原版用 `.have-rightmenu .page { padding-right: $rightMenuWidth + 20rem }`
   给这块溢出留空间，副作用是正文在宽屏下明显左偏、右侧大片留白。
   Hugo 版改为 `padding-right: calc(#{$rightMenuWidth} + 1.75rem)`：正文 `max-width 860px`
   在 `.page` 内容区里居中，大纲贴住正文右侧，于是「正文 + 大纲」整体在「侧边栏右沿 ~ 视口右沿」
   这一区域里居中，各断点下正文左间距与大纲右间距相等
   （1280/1366/1440 为 13px；1520/1920 因正文 max-width 封顶，两侧同时增大）。
   改动前先用 CDP 量 `.right-menu-wrapper` 右边界与 `innerWidth` 的差值，不要凭截图猜。
2. **页脚**：不要再给 `have-rightmenu` 的 `.footer` 额外加右内边距。
   `.sidebar-open .footer { padding-left: $sidebarWidth + 1.5rem }` 已让页脚内容中心等于
   `(视口宽 + 侧边栏宽) / 2`，与「正文 + 大纲」整体中心一致。
3. **侧边栏 partial 只在 `baseof.html` 调用一次**，不要用 `Page.Store` 做防重标记：
   `hugo server` 增量重建会复用同一个 Page 对象，Store 里的标记会残留，导致热更新后侧边栏消失。
4. **截图必须用 `tools/screenshot.ps1`**（内部 `tools/screenshot.cjs`，通过 CDP
   `Emulation.setDeviceMetricsOverride` 精确设定视口宽度）。不要用
   `msedge --headless --screenshot --window-size=1280,1000`：窗口尺寸不等于 CSS 视口宽度，
   实测 innerWidth 只有 1225~1254，1279/1280 断点会截出「大纲被视口裁掉」的假 bug（已踩过）。

