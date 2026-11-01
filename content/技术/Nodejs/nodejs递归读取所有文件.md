---
title: nodejs递归读取所有文件
date: 2019-12-26T15:57:32+08:00
url: "/pages/117708e0af7f0bd9/"
categories: 
  - 技术
  - Nodejs
tags: 
author: 
  name: xugaoyi
  link: https://github.com/xugaoyi
weight: 2
---
```js

var fs = require('fs');
var path = require('path');
 
function readFileList(dir, filesList = []) {
    const files = fs.readdirSync(dir);
    console.log(files);
    files.forEach((item, index) => {
        var fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {      
            readFileList(path.join(dir, item), filesList);  //递归读取文件
        } else {                
            filesList.push(fullPath);                     
        }        
    });
    return filesList;
}
 
var filesList = [];
readFileList(__dirname,filesList);
```
