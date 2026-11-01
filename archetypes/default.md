---
title: "{{ replace .File.ContentBaseName `-` ` ` | title }}"
date: {{ .Date }}
url: "/pages/{{ substr (md5 .File.ContentBaseName) 0 6 }}/"
categories: []
tags: []
author:
  name: xugaoyi
  link: https://github.com/xugaoyi
weight: 1
---

在这里开始写正文……
