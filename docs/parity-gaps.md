# hugo-theme-vdoing 与原版差距审计（还有哪些没开发）

> 审计时间：2026-11-02。对照对象：
> - 原版：`legacy/vdoing`（vuepress-theme-vdoing v1.12.9 主题源码）+ `legacy/docs/.vuepress/`（原站点真实配置）
> - Hugo 版：`themes/vdoing`（主题）+ `hugo.toml` / `data/*.yaml`（站点）
>
> 方法：三个区域（shell / 文章与 Markdown / 首页列表搜索）逐组件只读对比 + 配置与插件层单独核对，
> 并对运行中的预览 `http://127.0.0.1:1313/` 取实际 HTML 交叉验证。每条差距都带两侧 `file:line` 证据；
> 标「存疑」的是仓库内无法取证（依赖未入库的 npm 包或需真机验证）的项。
>
> 规模：约 280 个功能点，其中约 8 成已实现或等价替代；**确认未实现 / 部分实现 60 余项**，下面按优先级列出。
>
> **2026-11-08 更新**：评论区已按需求整体移除（`comment.html` / `assets/js/gitalk.js` / `static/gitalk/` / `_comment.scss` 已删除，`[params.gitalk]` 配置与「去评论」按钮已移除）。本文 1.1 与 4.2 中与 gitalk 有关的条目不再适用。同日补齐：正文 Markdown 外链自动 target/rel + 外链图标、docsRepo 缺失时回落 repo、原站 5 条 thirdparty-search 外链迁移（兼容原版 title/frontUrl/behindUrl schema）、页面级 `frontmatter.search:false`、`/posts/` 段页不再生成、迁移脚本跳过 HTML 注释内语法（修复被注释掉的 demo 复活）；另补 MPA 版 nprogress、侧边栏外链项、demo CodePen/JSFiddle 外链、prevLinks/nextLinks 字符串覆盖（绝对/相对路径）、一键复制参数化（copyMessage/duration/showInMobile）；经核对原版 UpdateArticle 对 article:false 页面同样加 no-article-list 隐藏，故目录页不渲染「最近更新」栏与原版一致（旧审计该项撤销）；Vue SFC 实时预览 / SPA 路由 / 多语言 locales 仍为架构边界。

---

## 0.5 修复进展（2026-11-02 第二轮：P0~P3 已落地）

> 本节记录上面审计项的落地情况；未列出的项见第 5 节「有意替代」与第 6 节「存疑」。
> 验收方式：`powershell -File tools/verify_parity.ps1 -Toggles`（54 项断言全 PASS）、
> `powershell -File tools/verify.ps1`（构建 + 站内链接 0 missing + 12 张截图）、逐项 CDP/构建产物核对。

| 审计项 | 状态 | 落地说明 |
| --- | --- | --- |
| 1.1 gitalk 配置键 | ✅ | `head.html` 用 `dict` 显式输出 camelCase（clientID/clientSecret/pagerDirection/distractionFreeMode）；`gitalk.js` 双兼容小写键；gitalk 资源已本地化到 `static/gitalk/`；补 loading/失败提示 |
| 2.1 上/下一篇重复 | ✅ | `page-nav.html` 只用单一有序集合（`FirstSection.RegularPagesRecursive.ByWeight` 索引 i±1）；全站扫描 prev==next 由 **24 处 → 0**；支持 `prevLinks`/`nextLinks` 与 frontmatter `prev`/`next` 覆盖 |
| 2.2 code-group 残留标签 | ✅ | 内容已转短代码（`content/前端/JavaScript文章/三级目录/四级文件.md`）；`tools/migrate_content.py` 新增原始标签→短代码规则 |
| 2.3 demo 容器 | ✅ | `block.html` + `code.js`：预览/代码切换、`horizontal` 并排、Vue `<template>` demo 明确降级说明；CodePen/JSFiddle 为有意替代 |
| 2.4 分类/标签全量渲染 | ✅ | `terms.html` 只渲染首屏 `postPageSize` 条 + `<noscript>` 原生 term 链接 + `rel=canonical`；`/categories/` 309KB→47KB、`/tags/` 304KB→39KB；`pages.js` 前端过滤/分页保持 `?category=x&p=N` |
| 2.5 首页摘要丢富文本 | ✅ | `post-list.html` 改用 `.Summary`（HTML，图片限高 280px），无 `<!-- more -->` 才回落纯文本；带标签配平检查 |
| 2.6 站内搜索 | ✅ | `index.json` 增加 `headers`（h2~h6，2612 条）与全文；`search.js` 命中片段高亮、锚点直达、↑↓/Enter/Esc、条数上限、无结果文案、`search=false`/`searchPlaceholder`、thirdparty 外链、可选 Algolia REST |
| 3.1 结构化侧边栏（7 项） | ✅ | 当前页标题子项、`displayAllHeaders`、`sidebarDepth` 优先级（frontmatter > 分组 > 站点）、默认展开第一个分组、`collapsable:false`、`sidebar:auto` 滚动高亮；外链项不适用（侧边栏由 content 树生成） |
| 3.2 图片放大 | ✅ | `zoom.js`：滚轮缩放 0.5~4x（锚点跟随鼠标）、双击缩放/复位、拖拽平移、双指手势、关闭重置；`bgColor` 键兼容；遮罩样式改到根选择器 |
| 3.3 配置空转（6 项） | ✅ | `updateBar.showToArticle`、`smoothScroll`（JS 三路统一 + `html[data-smooth-scroll]` 原生 CSS）、`search`/`searchPlaceholder`、`categoryText`/`extendFrontmatter`（迁移脚本 CLI + archetype）、`bodyBgImgOpacity/Interval=0`、`pageStyle` 非法值回落 card |
| 3.4 首页/列表/归档（8 项） | ✅ | 轮播首尾克隆无缝循环/100px 阈值/鼠标拖拽/惯性；分类按首次出现顺序、标签 shuffle 配色；统一排序 partial（首页/index.json/term 页）；归档 80 条 + 加载更多；`?p=N` 老链接重定向；空卡片判断；列表过渡动画 |
| 3.5 文章页细节（14 项） | ✅ | 404 文案改运行时随机（`data-msgs` + `404.js`）；Bitbucket 编辑链接；外链图标；上次更新取 `GitInfo.AuthorDate`（新增 `lastUpdatedFallbackToDate` 开关）；目录页补 page-edit/page-nav；catalogue 配错 warnf；删除 `catalogue-links.html` 死代码；`titleBadgeIcons` relURL；Prism token 补齐；gitalk 本地化；`hl_lines` 语法差异仅文档说明（内容未使用）；`update-article` 过滤不适用（Hugo 无 pageComponent/home:true 页） |
| 3.6 导航/外壳细节（10 项） | ✅ | nav 外链 target/rel/图标、`repoLabel` 平台推断、logo 时站名 can-hide、`no-navbar` 间距、navbar 宽度自适应、返回顶部/主题框/下拉动画、localStorage 旧键 `mode` 迁移、`only-sidebarItem` 死代码、blogger 回退 slogan、空 nav 不输出 |
| 4.1 配置项 | ✅ | `search`/`searchPlaceholder`、`[[params.thirdpartySearch]]`、`[params.algolia]`、`[params.sidebar]`、`head`/`customCss`/`customStyleFile` 注入点、`prevLinks`/`nextLinks`、`lastUpdatedFallbackToDate`、`categoryText` 全部接线 |
| 4.2 插件层 | ✅ / 不适用 | active-header-links、@vuepress/search、smooth-scroll、demo-block、zooming、gitalk 已补齐；nprogress 与 SPA 能力不适用（MPA 架构）；one-click-copy 固定参数与原版一致 |

**仍需注意的已知限制**（非缺陷，取舍或环境相关）：

1. 索引已拆分为两级：`/index.json` 轻索引（210KB / gzip 45KB，列表与分类标签过滤用）与 `/search-index.json` 全文索引（2.77MB / gzip 873KB，**仅首次输入关键词时拉取**）。不搜索的访客不会下载全文索引。
2. 标签配色改为按标签名 `hash.FNV32a` 稳定取色：同一标签跨构建颜色固定、不同标签分布随机（原版运行时随机，静态构建无法等价，这是取舍；已验证两次构建产物完全一致）。
3. Algolia 需自备 `appId/apiKey/indexName` 且站点未启用；thirdparty-search 默认未配置。
4. Vue SFC 实时预览与 CodePen/JSFiddle 为有意替代（纯静态站无运行时编译）。
5. Hugo 的 git 集成在 `core.quotepath=true` 时对中文文件名返回 nil：中文文章显示 git 时间需 `git config core.quotepath false`，否则按 `lastUpdatedFallbackToDate` 回落 frontmatter date。
6. 无 JS 时分类/标签页只有首屏 10 条 + noscript 原生 term 页链接（分页/过滤需 JS）。
7. 锚点算法仍是 Hugo `anchorize`，已加 `assets/js/anchor-compat.js` 运行时兼容：旧 VuePress slug 深链匹配不到 id 时按 VuePress slugify 重新匹配标题并滚动，同时把 hash 换成新 id（best-effort，非逐字节等价）；`hl_lines` 语法差异内容未使用，见第 6 节。

---

## 0. 总体结论

**已经对齐的部分**（不再逐条列，见文末「已对齐概览」）：页面骨架、导航/侧边栏/页脚/按钮组、首页 banner 与文章列表、
文章页（面包屑/作者/日期/titleTag/编辑链接/右侧大纲/翻页/最近更新）、归档、分类标签页、目录页、404、
Markdown 排版与锚点、容器体系（note/tip/warning/danger/right/theorem/details/center/cardList/cardImgList/Badge）、
代码块与 CodeGroup 主题实现、图片放大基础能力、gitalk 容器、百度统计/自动推送、sitemap/RSS、三套主题模式、html 模块。

**真正影响可用性的缺口**（详见第 1、2 节）：

| 优先级 | 问题 | 影响 |
| --- | --- | --- |
| P0 | gitalk 配置键大小写不匹配（`clientid` vs `clientID`） | **评论完全不可用**（生产环境也挂） |
| P1 | 上/下一篇混用两种顺序来源 | 213 篇里 24 篇「上一篇 == 下一篇」（同一 URL） |
| P1 | 迁移内容残留 Vue 组件标签 `<code-group>` | 个别文章标签页代码块裸露、破损 |
| P1 | demo 容器退化为 iframe | Vue demo 无预览，无 CodePen |
| P1 | 分类/标签页无 JS 时全量渲染（261KB/257KB）且过滤失效 | 无 JS / 爬虫看到全站文章 |
| P1 | 首页列表摘要 `plainify` | 摘要中的图片、富文本全部丢失 |
| P1 | 站内搜索能力弱于原版 | 无标题级定位、正文只索引前 1500 字、无键盘选择 |
| P2 | 结构化侧边栏不显示当前文章标题子项、`displayAllHeaders`/分组 `sidebarDepth` 缺失 | 文档型页面的侧边栏体验弱于原版 |
| P2 | 图片放大不能缩放/拖拽/手势 | 只能看原图 |
| P2 | `updateBar.showToArticle`、`smoothScroll`、`search` 等配置空转 | 配置项写了不生效 |
| P2 | 404 文案构建期随机、归档无渐进加载、分类栏排序/标签配色偏离 | 观感/行为与原版不同 |
| P3 | 一批细节（Bitbucket 编辑链接、nav 外链 target、动画、配置注入点等） | 细节差异 |

**建议实施顺序**：P0 gitalk（约 10 分钟）→ P1 上/下一篇 + CodeGroup 内容转换（约 1 小时）→
P1 分类/标签与摘要（约 2 小时）→ P1 搜索增强 + demo（约半天）→ P2 分批。

---

## 1. P0：功能失效

### 1.1 gitalk 评论初始化失败（配置键被 Hugo 小写化）

- 原版：`legacy/docs/.vuepress/config.ts:328-347` 以 `clientID` / `clientSecret` / `pagerDirection` / `distractionFreeMode` 传入插件。
- Hugo：`themes/vdoing/layouts/partials/head.html:51-53` 用 `site.Params.gitalk | jsonify` 注入；Hugo 的参数 key 一律小写，
  实测页面里是 `{"clientid":"…","clientsecret":"…","pagerdirection":"last","distractionfreemode":false,…}`。
  而 `themes/vdoing/assets/js/gitalk.js:22-23` 读 `cfg.clientID` / `cfg.clientSecret` → `undefined`，
  `new Gitalk()` 抛错被 `gitalk.js:35-37` 静默吞掉 → **评论永远不渲染**。
- 修复建议（二选一）：
  1. `gitalk.js` 兼容小写键：`cfg.clientid || cfg.clientID`、`cfg.clientsecret || cfg.clientSecret`、`cfg.pagerdirection`、`cfg.distractionfreemode`；
  2. `head.html` 用 `dict` 手工拼固定大小写的 JSON（`dict "clientID" site.Params.gitalk.clientid …`）。
- 顺带：`[params.zooming]` 有同样问题（见 3.2）。

---

## 2. P1：明显缺陷 / 内容破损

### 2.1 上一篇 / 下一篇重复（同一 URL）

- 原版：`legacy/vdoing/components/PageNav.vue:123-141` 从**侧边栏有序列表**（`sidebarItems`）解析 prev/next，
  并支持 `themeConfig.prevLinks/nextLinks` 与 frontmatter `prev/next` 覆盖（`PageNav.vue:108-117`）。
- Hugo：`themes/vdoing/layouts/partials/page-nav.html:10-24` 先用 `.PrevInSection/.NextInSection`，
  缺一个时再用 `FirstSection.RegularPagesRecursive.ByWeight` 兜底——两套顺序混用。
  当所在 section 恰好只有 2 篇时，`PrevInSection` 与 `NextInSection` 返回同一篇。
  全量扫描 213 篇有双导航的页面，**24 篇 prev == next**（例：`/pages/922650/` 两侧都指向 `/pages/4e8444e2d534d14f/`）。
- 修复建议：只用一个有序集合算索引（按侧边栏顺序的扁平列表：`i-1` / `i+1`），再支持 `site.Params.prevLinks/nextLinks`
  与 frontmatter `prev/next` 覆盖；`page-nav.html:12-24` 的兜底逻辑可整体删掉。

### 2.2 迁移内容残留 `<code-group>` / `<code-block>` 原始标签

- 主题侧已实现：`themes/vdoing/layouts/shortcodes/code-group.html`、`code-block.html`、`assets/js/code.js:134-189`（点击切换正常）。
- 但内容未转换：`content/前端/JavaScript文章/三级目录/四级文件.md:19-32` 仍是 `<code-group><code-block …>` 原始 HTML，
  渲染页 `/pages/8481d1/` 把标签原样输出、代码围栏文本裸露，标签页完全失效。
- 修复建议：把内容改成 `{{< code-group >}}` / `{{< code-block title="…" active="true" >}}` 短代码
  （可加进 `tools/migrate_content.py` 的转换规则，避免以后再犯）。

### 2.3 demo 容器能力退化

- 原版：`legacy/docs/.vuepress/config.ts:304-317` 使用 `vuepress-plugin-demo-block`：Vue SFC 实时预览、
  CodePen/JSFiddle 外链、`horizontal` 横向模式。
- Hugo：`themes/vdoing/layouts/shortcodes/block.html:123-128` + `assets/js/code.js:191-235` 只对纯 HTML demo 注入 iframe；
  Vue `<template>` demo 无预览（实测 `/pages/40b4db2d38ba85f2/` 只剩「示例」+ 代码），无 CodePen/JSFiddle。
- 修复建议：至少补「预览/代码」切换与 Vue demo 的说明降级；若要完全等价需引入运行时编译，成本高，可文档声明为有意替代。

### 2.4 分类页 / 标签页无 JS 时退化 + 全量渲染

- 原版是 SPA：`legacy/vdoing/components/CategoriesPage.vue:50-71` 前端过滤，无 JS 时整页空白。
- Hugo：`themes/vdoing/layouts/_default/terms.html:17-36` 服务端先渲染**全部**文章，再由 `pages.js` 前端过滤。
  实测 `/categories/` 单页 261.8KB、`/tags/` 257.3KB；无 JS 时 `?category=x` 被忽略、仍显示全部 214 篇，
  `<div class="pagination" hidden>` 也无分页（不崩，但过滤与分页失效）。
- 修复建议：`terms.html` 只输出第一页条数（`postPageSize`），分页交给 `pages.js`；或保留全量但在页面加 `<noscript>` 提示，
  并输出 `rel=canonical` 指向 Hugo 原生 term 页。

### 2.5 首页列表摘要丢失图片 / 富文本

- 原版：`legacy/vdoing/components/PostList.vue:73-74` 用 `v-html` 渲染 `excerpt`，`PostList.vue:232-240` 还专门给
  `.excerpt img` 限高 280px。
- Hugo：`themes/vdoing/layouts/partials/post-list.html:13` 用 `plainify`，摘要只剩纯文本。
  实测 sticky 文章 `content/更多/实用技巧/一行代码“黑”掉任意网站.md:18-20` 的配图在列表里消失。
- 修复建议：改用 `.Summary`（HTML）输出 + 保留 `.excerpt img` 限高；仓库内 77 篇都带 `<!-- more -->`，可去掉 `truncate 220`。

### 2.6 站内搜索能力弱于原版

- 原版：`legacy/vdoing/components/Navbar.vue:33` 用 `@vuepress/search` 内存索引（整页正文、标题级建议）。
- Hugo：`themes/vdoing/layouts/index.json.json` + `assets/js/search.js`，差距：
  - 索引无 `headers` 字段 → 结果无法定位到具体小节（`search.js:54` 整页跳转）；
  - 正文只索引 `.Plain | truncate 1500` → 长文后半段搜不到；
  - 结果项只有标题+日期，无正文命中片段（`search.js:52-58`）；
  - 无 ↑↓ / Enter 键盘选择（`search.js:95-97` 只处理 Esc）；
  - 无 `search: false` 开关、placeholder 不可配（见 4.1）；
  - 无 Algolia、无 thirdparty-search 外链（见 4.2）。
- 修复建议：`index.json` 增加 `headers`（h2/h3 标题+锚点）与分段正文；结果项输出命中片段；
  补键盘导航；`header.html:20` 外包 `search` 开关。

---

## 3. P2：体验 / 能力缺口

### 3.1 结构化侧边栏

| 差距 | 证据 | 建议 |
| --- | --- | --- |
| 当前文章不显示 h2~h6 标题子项（原版结构化模式会在当前页展开） | 原版 `SidebarLink.vue:46-50,71-80`；Hugo `sidebar-tree.html:29-32` 只输出页链接 | 当前页用 `$page.Fragments.Headings` 递归复用 `sidebar-toc.html` |
| `displayAllHeaders`（所有页都显示标题子项）完全缺失 | 原版 `SidebarLink.vue:43-48`；Hugo grep 0 命中 | 增加站点参数并在 `sidebar-tree.html` 判断 |
| `sidebarDepth` 只支持站点级，忽略 frontmatter / 分组级 | 原版 `SidebarLink.vue:35-41`、`SidebarGroup.vue:49`；Hugo 仅 `sidebar-toc.html:7` | 解析优先级：frontmatter > 分组 > 站点 |
| 折叠分组不再「默认展开第一个分组」 | 原版 `SidebarLinks.vue:34-38`；Hugo `sidebar-tree.html:11` 只展开当前分支 | depth=0 且无活跃分支时给第一个分组加 `open` |
| `sidebar: auto` 页面左侧大纲不随滚动高亮 | 原版靠 `@vuepress/plugin-active-header-links`（`index.js:82`）；Hugo `toc-scroll.js` 只管右侧大纲，`_sidebar.scss:271-279` 的 `.active` 样式无 JS 置类 | 在 `toc-scroll.js` 增加 sidebar toc 高亮 |
| `collapsable: false` 全局配置缺失 | 原版 `index.js:29-31`；Hugo `sidebar-tree.html:14` 写死 | 增加 `[params.sidebar] collapsable` |
| 侧边栏外链项（`type: external`）不支持 | 原版 `SidebarLink.vue:31-33,82-93`；Hugo 无 | 低优先，站点未用 |

### 3.2 图片放大（zooming）

- 原版 `vuepress-plugin-zooming` 内置：滚轮缩放、拖拽平移、双指手势。
- Hugo `assets/js/zoom.js:19-73` 只有 open/close（点击放大、遮罩/ESC 关闭、禁滚动）→ **不能缩放/拖动**。
- 另：`[params.zooming].bgColor` 被 `jsonify` 小写为 `bgcolor`，`zoom.js:15` 读 `config.bgColor` 恒 `undefined`
  （当前配置值恰等于默认值，暂不可见；改自定义色就失效）。
- 建议：补 wheel / touch 缩放平移状态机；键名兼容同 1.1。

### 3.3 配置空转 / 未接线

| 配置 | 现状 | 证据 |
| --- | --- | --- |
| `updateBar.showToArticle` | 文章页恒显示「最近更新」栏，设 false 无效 | 原版 `Page.vue:72-76`；Hugo `single.html:54` 恒调用 `update-bar` |
| `smoothScroll` | `hugo.toml:80` 有参数，主题/JS 0 引用；`_base.scss:11-14` 的 `scroll-behavior:smooth` 恒开 | 原版 `index.js:70,85` |
| `search` / `searchPlaceholder` | 搜索框恒渲染、placeholder 写死「搜索」 | 原版 `Navbar.vue:34`；Hugo `header.html:20`、`search.html:6` |
| `categoryText` / `extendFrontmatter` | 未接线；迁移已固化 frontmatter，新文章需手写分类/标签（`archetypes/default.md` 的 categories/tags 为空） | 原版 `setFrontmatter.js:18,128-157` |
| `bodyBgImgOpacity` / `bodyBgImgInterval` 设 0 | `default` 把 0 当空值吞掉 | 原版 `BodyBgImg.vue:42-44` 用 `!== undefined` |
| `pageStyle` 非法值 | 原版回落 card，Hugo 输出 `theme-style-foo` | 原版 `Layout.vue:284-288` |

### 3.4 首页 / 列表 / 归档

| 差距 | 证据 | 建议 |
| --- | --- | --- |
| 移动端 features 轮播无无缝循环、拖动阈值 50px（原版 100px）、无鼠标拖拽/惯性 | 原版 `Home.vue:66-107,293-328`（better-scroll `loop:true`）；Hugo `assets/js/home.js:7-126` | 首尾克隆 + 无动画回跳；阈值对齐 |
| 分类栏排序改为「文章数降序」（原版按文章排序后首次出现顺序）；标签配色固定轮转（原版每次随机） | 原版 `CategoriesBar.vue:11-19` + `postData.js:87-108`、`TagsBar.vue:42-52`；Hugo `categories-bar.html:25-29`、`tags-bar.html:37` | 按 `$posts` 顺序记录首次出现；标签色用 `shuffle` |
| `index.json` 置顶排序 `desc`，首页 `asc`，两处方向相反 | `index.json.json:14` vs `index.html:15` | 统一抽公共 partial；`desc` 改 `asc` |
| 原生 term 页不置顶（`/categories/实用技巧/`），与 query 版行为不一致 | `taxonomy.html:9-12` | 复用同一排序 partial |
| 归档页一次性输出 214 条（47.5KB），无原版「80 条 + 滚动加载」 | 原版 `ArchivesPage.vue:55,77-102`；Hugo `archives.html:30-47` | 可接受（SEO 更好）；如需对齐加分页/加载更多 |
| 首页分页 URL 从 `?p=N` 变为 `/page/N/`，老外链 `/?p=2` 落到第 1 页 | 原版 `PostList.vue:118-127`；实测 `/?p=2` 返回首页 | `home.js` 检测 `?p=N` 并 `location.replace` 兼容 |
| 分类/标签为空时右侧仍渲染空卡片 | `index.html:124-125` 无条件 include | 卡片 partial 内加长度判断 |
| 列表切换过渡动画缺失（类名在，无效果） | 原版 `PostList.vue:3,177-181`；`_lists.scss:62-69` | 低优先 |

### 3.5 文章页细节

| 差距 | 证据 | 建议 |
| --- | --- | --- |
| 404 随机文案是**构建期**随机（所有访客同一句） | 原版 `404.vue:12-25` 每次加载随机；Hugo `404.html:7` `shuffle` | 输出全部文案到 `data-msgs`，JS 随机选 |
| 编辑链接缺 Bitbucket 分支 | 原版 `PageEdit.vue:86-97`；Hugo `page-edit.html:21-28` 只有 GitHub/GitLab/Gitee | 补 `bitbucket.org/src/<branch>/?mode=edit` |
| 编辑链接缺外链图标（OutboundLink） | 原版 `PageEdit.vue:3-8` | 低优先 |
| 无 git 信息时仍显示「上次更新」（回落到 date） | 原版 `@vuepress/last-updated` 仅 git 时间；Hugo `hugo.toml` `frontmatter.lastmod=[":git",…]` | 区分来源或提供开关 |
| 翻页覆盖配置缺失（frontmatter `prev/next`、`prevLinks/nextLinks`） | 原版 `PageNav.vue:108-143` | 随 2.1 一起补 |
| 目录页缺「编辑 / 上下篇」（原版 pageComponent 页仍渲染） | 原版 `Page.vue:31-40`；Hugo `catalogue.html` 无 | 低优先 |
| 目录页 `catalogue:` 配错时无任何提示；`catalogue-links.html` 是死代码 | `catalogue.html:6-7,19`；grep `catalogue-links` 仅命中自身 | 加 `warnf`；死代码删除或接入 |
| `titleBadgeIcons` 自定义相对路径未 `relURL` | `single.html:29` | 低优先 |
| 代码行高亮语法不同（原版 ` ```js{1,3}` → Hugo `{hl_lines=[..]}`） | 内容暂未使用 | 迁移规范注明 |
| Prism token 少量未逐一映射（`.token.operator` 浅色背景、`.function-name`） | `_code.scss:122-341` | 低优先 |
| 行号渲染方式不同（原版独立列 / Hugo inline） | 有意替代 | 保持 |
| 锚点算法不同（VuePress slugify vs Hugo anchorize），旧深链可能失效 | `render-heading.html:7`；站内 `check_links` 0 missing | 存疑，见第 6 节 |
| gitalk 依赖 unpkg CDN（原版随包本地化） | `scripts.html:6-8` | 可本地化 |
| update-article 未排除 `pageComponent`/`home:true`（当前内容无此类页） | 原版 `postData.js:8-15` | 低优先 |

### 3.6 导航 / 外壳细节

| 差距 | 证据 | 建议 |
| --- | --- | --- |
| nav 外链 / `mailto:` / `tel:` 无 `target/rel` 与外链图标 | 原版 `NavLink.vue:9-19`；Hugo `nav.html:37,90,95,101` 一律 `relURL` | 抽链接 partial 判断外链 |
| `repoLabel` 缺省永远 GitHub，无平台推断（GitLab/Bitbucket/Source） | 原版 `NavLinks.vue:89-116`；Hugo `nav.html:45` | 按 repo 域名推断 |
| 有 logo 时站名被无条件 `can-hide`（原版无 logo 时应显示站名） | 原版 `Navbar.vue:19`；Hugo `header.html:16` | `{{ if site.Params.logo }} can-hide{{ end }}` |
| `no-navbar` 下正文标题上间距覆盖缺失 | 原版 `index.styl:294-301`；Hugo grep 仅 `_shell.scss:20` | 补 CSS |
| navbar 链接区无最大宽度自适应，长菜单会压住站名 | 原版 `Navbar.vue:56-69`；Hugo 无 | `shell.js` 加 resize 计算 |
| 返回顶部淡入淡出、主题选择框扇出、下拉高度过渡三个动画缺失 | 原版 `Buttons.vue:3-10,24-43`、`DropdownTransition.vue:1-27`；Hugo 只有 `display` 切换 | 低优先，补 CSS transition |
| 主题模式 localStorage 键名由 `mode` 改为 `vdoing-mode`，老用户偏好丢失 | 原版 `Layout.vue:110,218`；Hugo `shell.js:12` | 读旧键并迁移 |
| `only-sidebarItem` 与 `have-rightmenu` 被判定为互斥，宽屏「单条目+右栏」隐藏侧栏的规则成死代码 | `page-classes.html:30`；`_shell.scss:154-168`、`_article.scss:199-217` | 去掉 `not $showRightMenu` 条件 |
| blogger 卡回退显示社交图标（原版无 `blogger.social` 时显示 slogan） | 原版 `Sidebar.vue:8-18`；Hugo `blogger-sidebar.html:9-10` | 与原版语义对齐 |
| nav 为空时仍输出空 `<nav>` | 原版 `NavLinks.vue:4` | 低优先 |

---

## 4. 配置项 / 插件层对照

### 4.1 `themeConfig` → `hugo.toml [params]`

| 原版配置 | Hugo | 状态 |
| --- | --- | --- |
| `nav` | `data/nav.yaml` + `nav.html` | 已实现（三层嵌套、分组、当前项高亮）；外链 target 缺失 |
| `sidebar: 'structuring'` / `auto` / `false` | `weight` 树 / frontmatter `sidebar: auto` / `false` | 已实现；`collapsable:false`、分组/页级 `sidebarDepth`、`displayAllHeaders` 缺失 |
| `logo` / `repo` / `repoLabel` | `params.logo/repo/repoLabel` | 部分（平台推断、外链图标缺失） |
| `searchMaxSuggestions` | `params.searchMaxSuggestions` | 已实现 |
| `search: false` / `searchPlaceholder` | 无 | **未实现** |
| `algolia` / `thirdparty-search` | 无 | **未实现**（原站点未启用 algolia，属主题能力缺失） |
| `lastUpdated` / `editLinks` / `editLinkText` / `docsRepo` / `docsDir` / `docsBranch` | 同名参数 | 已实现（Bitbucket 分支缺失） |
| `category` / `tag` / `archive` | 同名参数 | 已实现 |
| `categoryText` / `extendFrontmatter` | 无 | 未接线（迁移已固化，新文章靠 archetype 手写） |
| `pageStyle` | `params.pageStyle` | 已实现（非法值无兜底） |
| `bodyBgImg` / `bodyBgImgOpacity` / `bodyBgImgInterval` | 同名参数 | 已实现（0 值被吞） |
| `titleBadge` / `titleBadgeIcons` | 同名参数 | 已实现（JS 每次加载随机，等价原版） |
| `contentBgStyle` | 同名参数 | 已实现 |
| `updateBar.showToArticle` / `moreArticle` | `params.updateBar` | `moreArticle` ✓，`showToArticle` **未接线** |
| `rightMenuBar` / `sidebarOpen` / `sidebarHoverTriggerOpen` / `pageButton` / `defaultMode` / `navbar` | 同名参数 | 已实现 |
| `author` / `authorLink` | 同名参数 | 已实现 |
| `blogger` / `social` / `footer` | 同名参数 + `[[params.social]]` | 已实现（blogger 回退差异） |
| `social.iconfontCssFile` | `params.iconfontCssFile` | 已实现（命名位置不同） |
| `htmlModules`（含 `showMode`） | `data/htmlModules.yaml` | 已实现，且 showMode 推广到所有 key |
| `smoothScroll` | `params.smoothScroll` | **空转** |
| VuePress `head` 自定义注入 | 无 | **未实现**（无法通过配置加 meta/script） |
| 站点级自定义样式（`.vuepress/styles/*.styl`） | 无注入点（原站点样式已内化到 `_docs-extras.scss`） | 未提供扩展点 |
| `markdown.lineNumbers` / `extractHeaders` | `[markup.highlight].lineNos` / `tableOfContents.startLevel~endLevel` | 已实现（行号为 inline，视觉差异） |

### 4.2 原版插件 → Hugo 对应

| 原版插件 | Hugo 现状 | 状态 |
| --- | --- | --- |
| `@vuepress/plugin-active-header-links` | `toc-scroll.js` 右侧大纲高亮 | 部分（sidebar: auto 页不生效） |
| `@vuepress/plugin-search` | `index.json` + `search.js` | 部分（见 2.6） |
| `@vuepress/plugin-nprogress` | 无 | 不适用（MPA 无路由切换；如需首屏进度可另做） |
| `vuepress-plugin-smooth-scroll` | CSS `scroll-behavior:smooth` 恒开 | 部分（参数空转） |
| `vuepress-plugin-container`（note/tip/warning/danger/right/theorem/details/center/cardList/cardImgList） | `shortcodes/block.html` + `_containers.scss` | 已实现 |
| `vuepress-plugin-one-click-copy` | `code.js` 复制按钮 | 已实现（`copyMessage`/`showInMobile`/`copySelector` 不可配） |
| `vuepress-plugin-demo-block` | iframe 简化版 | 部分（见 2.3） |
| `vuepress-plugin-zooming` | `zoom.js` | 部分（无缩放/拖拽，见 3.2） |
| `vuepress-plugin-comment`（gitalk） | `comment.html` + `gitalk.js` | **P0 失效**（见 1.1） |
| `vuepress-plugin-baidu-tongji` / `-baidu-autopush` | `head.html` / `scripts.html` | 已实现 |
| `vuepress-plugin-sitemap` | Hugo 原生 sitemap.xml | 已实现 |
| `@vuepress/last-updated` | `enableGitInfo` + `frontmatter.lastmod` | 已实现 |
| VuePress 默认 SearchBox / 外链 `OutboundLink` 组件 | 自研搜索框 / 无 OutboundLink | 部分（见 3.6、6.1） |
| VuePress SPA 能力（无刷新路由、链接预取、滚动位置恢复、页面过渡） | 静态多页 | 不适用（架构差异） |

---

## 5. 有意替代（不建议改）

| 项 | 说明 |
| --- | --- |
| 分类/标签页「服务端渲染 + 前端 query 过滤」 | 原版纯 SPA；Hugo 版无 JS 时仍能看内容（但需修 2.4 的全量渲染） |
| 分页 URL `/page/N/` 取代 `?p=N` | 静态站点标准形式；可加老链接兼容（见 3.4） |
| 文章列表摘要纯文本 | 这是待修项（2.5），修好后此项移除 |
| demo 容器简化 | 见 2.3，若要等价成本高 |
| 行号内联（`lineNos="inline"`） | 视觉不同、功能等价 |
| 404 页带全站外壳（导航/侧栏/页脚） | Hugo 模板体系使然，体验不差 |
| 面包屑一级目录直接链到目录页 | 原版会拼出目录页上不存在的锚点（原版缺陷） |
| `?mode=dark` URL 指定主题、搜索快捷键、`sidebar-ready` 防闪、body 背景首图 SSR | Hugo 增强项，非缺失 |
| titleBadge 随机时机（JS 每次加载随机 vs 原版 mixin） | 已等价 |
| nprogress / SPA 路由动画 | 架构差异 |

---

## 6. 存疑（仓库内无法取证）

1. **VuePress 默认 SearchBox 的交互细节**（↑↓/Enter、空结果文案、`searchPlaceholder`、`search: false` 的精确语义）：
   `@vuepress/search` 与 `vuepress-plugin-thirdparty-search` 未入库（无 `node_modules`），只能按 VuePress 1.x 默认行为推断。
2. **VuePress markdown 正文外链是否自动加 `target="_blank" rel`**：仓库内只能看到 `legacy/docs` 里手工粘贴的渲染结果
   （`legacy/docs/02.页面/20.CSS/07.CSS3之transition过渡.md:56`），无法确认是否由渲染器自动生成。
   Hugo 当前正文外链是裸 `<a>`；若需要，加一个 goldmark `render-link.html` hook 即可。
3. **锚点算法逐字符一致性**：VuePress slugify vs Hugo `anchorize` 在全角标点、重复标题 `-1` 后缀、emoji 上未穷举；
   站内链接 `check_links.py` 为 0 missing，但站外旧深链可能失效。
4. **`.PrevInSection/.NextInSection` 返回同页的完整机制**：已复现症状（2.1）并定位可疑代码，未在 Hugo 内部深挖。
5. **gitalk 原插件 DOM/loading 态**：`vuepress-plugin-comment` 未入库，容器 id `#vuepress-plugin-comment` 无法与原插件核对。
6. **better-scroll 轮播的精确手感**（惯性、阈值、loop 边界）需真机对照。
7. **hide-navbar 的滚动方向判定时机**：原版 `_.throttle(300)` vs Hugo rAF 逐帧，快速抖动时表现可能不同。
8. **旧 URL 兼容范围**：`/?p=N` 已确认失效；原站是否还有其它已发布的分页/筛选外链形式无证据。
9. **cardImgList 无内容样例**，仅静态审查了短代码与样式。
10. **`/posts/` 章节列表页是迁移遗留孤儿页**（导航无入口），是否应 `build.render: never` 需确认。

---

## 7. 已对齐概览（按区域）

- **外壳**：导航结构/当前项高亮/下拉三层/移动端导航/搜索框渲染/repo 链接、侧边栏按钮与抽屉/遮罩/滑动手势/悬停触发/`sidebar:false`/`sidebar:auto`/结构化树/折叠互斥、页脚（版权/备案/社交）、按钮组（返回顶部/去评论/4 档主题模式/localStorage/系统跟随）、body 背景单图与轮播、html 模块全部 7 个槽位 + showMode、角落窗口、打印样式、iconfont 本地化。
- **文章页**：面包屑（二级/三级锚点）、作者/日期/titleTag/titleBadge、contentBgStyle、编辑链接（GitHub/GitLab/Gitee）、tags、上次更新、上/下一篇（存在 2.1 缺陷）、页面中部翻页按钮 + tooltip、右侧大纲（条件/层级/高亮/平滑滚动/sticky/断点）、最近更新栏、pageT/pageB、gitalk 容器（存在 1.1 缺陷）。
- **Markdown**：标题 hover 锚点、表格/引用/kbd/列表/hr、外链箭头（原版正文本来没有）、TOC 样式、代码语言标签/行号/行高亮/一键复制（剔行号、移动端隐藏）/CodeGroup/CodeBlock 主题实现、note/tip/warning/danger/right/theorem/details/center/cardList/cardImgList/Badge、图片放大基础（点击/遮罩/ESC）、代码主题浅色+深色+阅读模式。
- **首页/列表**：banner（auto/none/图片/自定义 CSS/bodyBgImg 互斥/非首页隐藏）、heroImage/heroText/tagline/actionButton、PC features、移动端 features 轮播（基础）、postList detailed/simple/none、sticky 排序与置顶图标、摘要（存在 2.5）、作者/日期/分类/标签元信息、阅读全文、分页（页码/省略号/边界禁用）、右侧博主/分类/标签/homeSidebarB、hideRightBar。
- **分类/标签/归档/目录/404**：query 过滤（存在 2.4）、计数、空态、双份左右栏、移动端激活项定位、归档年分组/总数/年度篇数/MM-DD、目录页 column-wrapper/编号大纲/锚点/面包屑联动、404 文案与返回首页。
- **其它**：站内搜索基础能力（存在 2.6）、百度统计/自动推送/站长验证、OpenGraph/Twitter Card、RSS、sitemap、robots.txt、`index.json`、主题配置体系（大部分参数同名映射）。

---

## 8. 建议实施顺序（可拆成 4 个提交）

1. **P0 修复**（30 分钟）：gitalk 键名兼容 + zooming 键名兼容 + `[params]` 读取小写化说明。
2. **P1 正确性**（半天）：上/下一篇统一顺序 + 覆盖配置；`<code-group>` 内容转换（含迁移脚本规则）；分类/标签只渲染首页；摘要改 `.Summary`；`search` 开关与 placeholder。
3. **P1/P2 能力补齐**（1 天）：搜索索引加 headers/片段/键盘导航；侧边栏当前页标题子项 + `displayAllHeaders` + `sidebarDepth` 优先级；图片放大缩放/拖拽；`updateBar.showToArticle`；404 JS 随机；归档分页/加载更多；分类栏排序与标签配色；`index.json`/term 页排序统一。
4. **P3 细节**（按需）：外链 target/图标、repoLabel 推断、navbar 自适应、动画、Bitbucket、head/自定义 CSS 注入点、老链接兼容、死代码清理。
