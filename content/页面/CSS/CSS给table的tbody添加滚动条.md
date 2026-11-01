---
title: CSS给table的tbody添加滚动条
date: 2022-06-29T09:34:23+08:00
url: "/pages/55f894/"
categories:
  - 页面
  - CSS
tags:
  - 
author: 
  name: xugaoyi
  link: https://github.com/xugaoyi
weight: 71
---

```css
table tbody {
  height: 200px;
  overflow-y: auto;
  display: block;
}

table thead,
tbody tr {
  display: table;
  width: 100%;
}
```
