/* =========================================================
   代码块交互:
     1. 语言标签 (读取 code.language-xxx, 写到 .highlight[data-lang], 由 _code.scss 显示)
     2. 一键复制 (原 vuepress-plugin-one-click-copy: 复制时去掉 chroma inline 行号 .ln)
     3. CodeGroup 标签页切换 (原 CodeGroup.vue / CodeBlock.vue)
     4. demo 容器 iframe 预览 (原 vuepress-plugin-demo-block 的安全简化版)
   每个文件独立 IIFE, 由 scripts.html 拼接为 js/main.js
   ========================================================= */
(function () {
  'use strict';

  // 语言别名 (原 code.styl 里 language-javascript -> js 等)
  var LANG_ALIAS = {
    javascript: 'js',
    typescript: 'ts',
    markup: 'html',
    html: 'html',
    markdown: 'md',
    ruby: 'rb',
    python: 'py',
    py: 'py',
    bash: 'sh',
    sh: 'sh',
    shell: 'sh',
    zsh: 'sh',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    css: 'css',
    scss: 'scss',
    less: 'less',
    stylus: 'styl',
    styl: 'styl',
    php: 'php',
    go: 'go',
    golang: 'go',
    rust: 'rs',
    java: 'java',
    c: 'c',
    'c++': 'cpp',
    cpp: 'cpp',
    csharp: 'cs',
    xml: 'xml',
    sql: 'sql',
    graphql: 'graphql',
    vue: 'vue',
    dockerfile: 'dockerfile',
    nginx: 'nginx',
    text: 'text',
    plaintext: 'text',
    txt: 'text'
  };

  function langLabel(lang) {
    return LANG_ALIAS[lang] || lang;
  }

  // 去掉 chroma 的行号 (.ln/.lnt/.line-numbers-wrapper) 后取纯代码文本
  function stripLineNumbers(codeEl) {
    var clone = codeEl.cloneNode(true);
    var junk = clone.querySelectorAll('.ln, .lnt, .line-numbers-wrapper, .copy-button');
    for (var i = 0; i < junk.length; i++) {
      if (junk[i].parentNode) junk[i].parentNode.removeChild(junk[i]);
    }
    return clone.textContent.replace(/\n$/, '');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  // ---------- 1. 语言标签 ----------
  function initLanguageLabels() {
    var blocks = document.querySelectorAll('.theme-vdoing-content .highlight');
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (block.getAttribute('data-lang')) continue;
      var code = block.querySelector('code[class*="language-"]');
      if (!code) continue;
      var match = /(?:^|\s)language-([^\s]+)/.exec(code.className);
      if (!match) continue;
      block.setAttribute('data-lang', langLabel(match[1]));
    }
  }

  // ---------- 2. 一键复制 ----------
  function initCopyButtons() {
    var blocks = document.querySelectorAll('.theme-vdoing-content .highlight');
    for (var i = 0; i < blocks.length; i++) {
      (function (block) {
        if (block.querySelector('.copy-button')) return;
        var code = block.querySelector('pre code');
        if (!code) return;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'copy-button';
        btn.textContent = '复制';
        btn.title = '复制代码';
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var done = function () {
            btn.textContent = '复制成功';
            window.setTimeout(function () {
              btn.textContent = '复制';
            }, 1000);
          };
          copyText(stripLineNumbers(code)).then(done, done);
        });
        block.appendChild(btn);
      })(blocks[i]);
    }
  }

  // ---------- 3. CodeGroup 标签页 ----------
  function initCodeGroups() {
    var groups = document.querySelectorAll('.theme-code-group');
    for (var g = 0; g < groups.length; g++) {
      (function (group) {
        var ul = group.querySelector('.theme-code-group__ul');
        if (!ul || ul.children.length) return;

        var blocks = [];
        for (var i = 0; i < group.children.length; i++) {
          var child = group.children[i];
          if (child.classList && child.classList.contains('theme-code-block')) {
            blocks.push(child);
          }
        }
        if (!blocks.length) return;

        var activeIndex = 0;
        for (var j = 0; j < blocks.length; j++) {
          (function (block, index) {
            var title = block.getAttribute('data-title') || 'Tab ' + (index + 1);
            var li = document.createElement('li');
            li.className = 'theme-code-group__li';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'theme-code-group__nav-tab';
            btn.textContent = title;
            btn.addEventListener('click', function () {
              activate(index);
            });
            li.appendChild(btn);
            ul.appendChild(li);

            if (block.classList.contains('theme-code-block__active')) {
              activeIndex = index;
            }
            block.classList.remove('theme-code-block__active');
          })(blocks[j], j);
        }

        function activate(index) {
          var tabs = ul.querySelectorAll('.theme-code-group__nav-tab');
          for (var k = 0; k < tabs.length; k++) {
            if (k === index) tabs[k].classList.add('theme-code-group__nav-tab-active');
            else tabs[k].classList.remove('theme-code-group__nav-tab-active');
          }
          for (var m = 0; m < blocks.length; m++) {
            if (m === index) blocks[m].classList.add('theme-code-block__active');
            else blocks[m].classList.remove('theme-code-block__active');
          }
        }

        activate(activeIndex);
      })(groups[g]);
    }
  }

  // ---------- 4. demo 容器 iframe 预览 ----------
  function initDemoBlocks() {
    var demos = document.querySelectorAll('.theme-vdoing-content .demo-block');
    for (var i = 0; i < demos.length; i++) {
      (function (block) {
        if (block.querySelector('.demo-block-preview')) return;
        var body = block.querySelector('.demo-block-code');
        if (!body) return;
        var code = body.querySelector('code');
        if (!code) return;

        var lang = (code.getAttribute('data-lang') || '').toLowerCase();
        if (lang && lang !== 'html') return; // 只预览 html demo

        var html = stripLineNumbers(code);
        // vue 单文件模板 demo 无法在普通 iframe 里跑, 跳过
        if (!html || /<template[\s>]/i.test(html)) return;
        if (!/<[a-z!/]/i.test(html)) return;

        var doc = html;
        if (!/<html[\s>]/i.test(doc)) {
          doc =
            '<!DOCTYPE html><html><head><meta charset="utf-8">' +
            '<style>body{margin:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#333;}</style>' +
            '</head><body>' +
            doc +
            '</body></html>';
        } else if (!/^\s*<!DOCTYPE/i.test(doc)) {
          doc = '<!DOCTYPE html>' + doc;
        }

        var wrap = document.createElement('div');
        wrap.className = 'demo-block-preview';
        var iframe = document.createElement('iframe');
        iframe.setAttribute('sandbox', 'allow-scripts allow-modals');
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('scrolling', 'auto');
        iframe.setAttribute('title', 'demo preview');
        iframe.srcdoc = doc;
        wrap.appendChild(iframe);
        // 原版顺序: 标题 / 预览 / 代码
        block.insertBefore(wrap, body);
      })(demos[i]);
    }
  }

  function init() {
    initLanguageLabels();
    initCopyButtons();
    initCodeGroups();
    initDemoBlocks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
