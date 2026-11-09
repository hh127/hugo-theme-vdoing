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

  // ---------- 4. demo 容器: 预览 / 代码 切换 + iframe 预览 ----------
  // 原 vuepress-plugin-demo-block 的能力对应:
  //   · 预览 / 代码 切换 (默认预览) -> 由 block.html 输出 data-demo-mode + tab 按钮, 这里接管点击
  //   · horizontal 横向模式 -> 纯 CSS (data-demo-horizontal="true")
  //   · 纯 HTML demo -> 注入 sandbox iframe (srcdoc)
  //   · Vue <template> demo -> 静态站无运行时编译, 服务端已输出降级说明, 这里不注入 iframe
  //   · CodePen / JSFiddle -> 表单 POST 外链 (ensureDemoOutlinks, 开关见 [params.demoblock])
  var DEMO_DOC_STYLE =
    'body{margin:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#333;}';

  function buildDemoDoc(html) {
    var doc = html;
    if (!/<html[\s>]/i.test(doc)) {
      doc =
        '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
        DEMO_DOC_STYLE +
        '</style></head><body>' +
        doc +
        '</body></html>';
    } else if (!/^\s*<!DOCTYPE/i.test(doc)) {
      doc = '<!DOCTYPE html>' + doc;
    }
    return doc;
  }

  function demoCodeText(block) {
    var code = block.querySelector('.demo-block-code code');
    if (!code) return null;
    var lang = (code.getAttribute('data-lang') || '').toLowerCase();
    // 只预览 html demo (与旧实现一致); 语言未知时允许尝试
    if (lang && lang !== 'html') return null;
    var html = stripLineNumbers(code);
    if (!html) return null;
    // vue 单文件模板 demo 无法在普通 iframe 里跑
    if (/<template[\s>]/i.test(html)) return null;
    if (!/<[a-z!/]/i.test(html)) return null;
    return html;
  }

  function ensureDemoPreview(block) {
    var codeWrap = block.querySelector('.demo-block-code');
    var pane = block.querySelector('.demo-block-preview');
    if (!pane) {
      // 兼容旧标记: 没有预览容器时按原逻辑插到代码前面
      if (!codeWrap) return;
      var html0 = demoCodeText(block);
      if (html0 === null) return;
      pane = document.createElement('div');
      pane.className = 'demo-block-preview';
      block.insertBefore(pane, codeWrap);
    }
    if (pane.querySelector('iframe')) return;
    if (pane.querySelector('.demo-block-vue-tip')) return; // 服务端降级说明, 不伪造预览
    var html = demoCodeText(block);
    if (html === null) return;

    var iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts allow-modals');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'auto');
    iframe.setAttribute('title', 'demo preview');
    iframe.srcdoc = buildDemoDoc(html);
    pane.appendChild(iframe);
  }

  function setDemoMode(block, mode) {
    if (mode !== 'preview' && mode !== 'code') return;
    block.setAttribute('data-demo-mode', mode);
    var tabs = block.querySelectorAll('[data-demo-tab]');
    for (var i = 0; i < tabs.length; i++) {
      var active = tabs[i].getAttribute('data-demo-tab') === mode;
      if (active) tabs[i].classList.add('demo-block-tab--active');
      else tabs[i].classList.remove('demo-block-tab--active');
      tabs[i].setAttribute('aria-selected', active ? 'true' : 'false');
    }
    if (mode === 'preview') ensureDemoPreview(block);
  }

  /* CodePen / JSFiddle: 纯静态站点用表单 POST 把 demo 代码带到外部编辑器 */
  function submitExternalForm(action, fields) {
    var form = document.createElement('form');
    form.action = action;
    form.method = 'POST';
    form.target = '_blank';
    form.style.display = 'none';
    for (var key in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = fields[key];
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    window.setTimeout(function () {
      if (form.parentNode) form.parentNode.removeChild(form);
    }, 0);
  }

  function openCodePen(html) {
    submitExternalForm('https://codepen.io/pen/define', {
      data: JSON.stringify({ title: 'vdoing demo', html: html, css: '', js: '' })
    });
  }

  function openJSFiddle(html) {
    submitExternalForm('https://jsfiddle.net/api/post/library/pure/', {
      title: 'vdoing demo',
      html: html,
      css: '',
      js: ''
    });
  }

  function ensureDemoOutlinks(block) {
    if (!block || block.querySelector('.demo-block-outlinks')) return;
    var wantCodePen = block.getAttribute('data-demo-codepen') === 'true';
    var wantJSFiddle = block.getAttribute('data-demo-jsfiddle') === 'true';
    if (!wantCodePen && !wantJSFiddle) return;
    var html = demoCodeText(block);
    if (html === null) return; // 只对纯 HTML demo 生成 (Vue SFC 需运行时编译, 无法直接外链)
    var head = block.querySelector('.demo-block-head');
    if (!head) return;
    var wrap = document.createElement('div');
    wrap.className = 'demo-block-outlinks';
    if (wantCodePen) {
      var cp = document.createElement('a');
      cp.className = 'demo-block-outlink';
      cp.href = '#';
      cp.textContent = 'CodePen';
      cp.addEventListener('click', function (e) {
        e.preventDefault();
        openCodePen(html);
      });
      wrap.appendChild(cp);
    }
    if (wantJSFiddle) {
      var jf = document.createElement('a');
      jf.className = 'demo-block-outlink';
      jf.href = '#';
      jf.textContent = 'JSFiddle';
      jf.addEventListener('click', function (e) {
        e.preventDefault();
        openJSFiddle(html);
      });
      wrap.appendChild(jf);
    }
    head.appendChild(wrap);
  }

  function initDemoBlocks() {
    var demos = document.querySelectorAll('.theme-vdoing-content .demo-block');
    for (var i = 0; i < demos.length; i++) {
      (function (block) {
        var tabs = block.querySelectorAll('[data-demo-tab]');
        for (var t = 0; t < tabs.length; t++) {
          (function (tab) {
            tab.addEventListener('click', function (e) {
              if (e) e.preventDefault();
              setDemoMode(block, tab.getAttribute('data-demo-tab'));
            });
          })(tabs[t]);
        }
        // 默认预览: 首次渲染时注入 iframe
        if (block.getAttribute('data-demo-mode') === 'preview') ensureDemoPreview(block);
        ensureDemoOutlinks(block);
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
