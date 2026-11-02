/* =========================================================
   旧版 VuePress 锚点兼容 (best-effort)
   背景: VuePress 1.x 的标题 id 由 @vuepress/shared-utils 的 slugify 生成,
   与 Hugo 的 anchorize 规则不同 (前导数字加 `_`、标点替换为 `-` 等),
   老站外链的 #深链 可能在新站匹配不到元素。
   做法: hash 在页面里找不到对应 id 时, 用 VuePress slugify 规则重新计算
   每个标题的旧 id, 匹配到就把滚动定位过去 (并静默把 hash 换成新 id)。
   本文件位于 assets/js/, 会被 scripts.html 的 resources.Match "js/*.js" 自动打包。
   ========================================================= */
(function () {
  'use strict';

  // VuePress 1.x (markdown-it-anchor) 的 slugify 规则
  var rControl = /[\u0000-\u001f]/g;
  var rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g;
  var rCombining = /[\u0300-\u036f]/g;

  function vpSlug(str) {
    var s = String(str == null ? '' : str);
    if (s.normalize) {
      s = s.normalize('NFKD').replace(rCombining, '');
    }
    return s
      .replace(rControl, '')
      .replace(rSpecial, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/^(\d)/, '_$1')
      .toLowerCase();
  }

  function headingText(el) {
    var clone = el.cloneNode(true);
    var anchors = clone.querySelectorAll('.header-anchor, a.anchor');
    for (var i = 0; i < anchors.length; i++) {
      if (anchors[i].parentNode) anchors[i].parentNode.removeChild(anchors[i]);
    }
    var text = clone.textContent || '';
    return text.trim();
  }

  function decodeHash(raw) {
    var out = [];
    var h = String(raw || '').replace(/^#/, '');
    if (!h) return out;
    out.push(h);
    try {
      var d = decodeURIComponent(h);
      if (d !== h) out.push(d);
    } catch (e) { /* ignore */ }
    return out;
  }

  function findByHash(candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var el = document.getElementById(candidates[i]);
      if (el) return el;
    }
    return null;
  }

  function findByVuePressSlug(candidates) {
    var content = document.querySelector('.theme-vdoing-content');
    if (!content) return null;
    var headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (var i = 0; i < headings.length; i++) {
      var el = headings[i];
      if (!el.id) continue;
      var text = headingText(el);
      if (!text) continue;
      var slug = vpSlug(text);
      if (!slug) continue;
      var forms = [slug, encodeURIComponent(slug)];
      if (candidates.indexOf(slug) > -1 || candidates.indexOf(forms[1]) > -1) return el;
    }
    return null;
  }

  function scrollToEl(el) {
    if (!el) return;
    try {
      el.scrollIntoView({ block: 'start', behavior: 'auto' });
    } catch (e) {
      el.scrollIntoView();
    }
  }

  function compat() {
    var raw = window.location.hash;
    if (!raw || raw === '#') return;
    var candidates = decodeHash(raw);
    if (findByHash(candidates)) return; // Hugo 自己就能定位
    var el = findByVuePressSlug(candidates);
    if (!el) return;
    scrollToEl(el);
    // 把 URL 的 hash 换成新 id, 后续刷新/复制都能直接命中 (不产生历史记录)
    if (el.id && window.history && window.history.replaceState) {
      try { window.history.replaceState(null, '', '#' + el.id); } catch (e) { /* ignore */ }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(compat, 0); });
  } else {
    setTimeout(compat, 0);
  }
  window.addEventListener('hashchange', compat);
})();
