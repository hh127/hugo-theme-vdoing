---
title: "{{ replace .File.ContentBaseName `-` ` ` | title }}"
date: {{ .Date }}
url: "/pages/{{ substr (md5 .File.ContentBaseName) 0 6 }}/"
# 分类: 结构性文章按所在目录自动归类; 碎片化文章(posts/)用 categoryText(默认「随笔」)
categories: []
tags: []
author:
  name: xugaoyi
  link: https://github.com/xugaoyi
weight: 1
# ---------------------------------------------------------------------------
# 可选字段 (对应原 vuepress-theme-vdoing 的 frontmatter, 详见 docs/parity-gaps.md 4.1)
# 取消注释即可生效; 它们是原版 extendFrontmatter 能力的等价替代
# ---------------------------------------------------------------------------
# titleTag: 原创            # 标题旁小徽标
# sticky: 1                 # 置顶, 数字越大越靠前
# description: ""           # 自定义摘要/描述 (列表摘要 & meta description)
# keywords: []              # 页面级 keywords
# sidebarDepth: 2           # 本页侧边栏/大纲层级 (优先级: 本页 > 分组 > 站点)
# sidebar: auto             # 本页左侧改为本页大纲 | sidebar: false 关闭左侧
# article: false            # 自定义页: 不进列表/归档/搜索
# editLink: false           # 关闭本页「编辑」链接
# prev: false               # 隐藏「上一篇」; 也可写 "/pages/xxxx/" 覆盖跳转目标
# next: false               # 隐藏「下一篇」; 也可写 "/pages/xxxx/" 覆盖跳转目标
---

在这里开始写正文……
