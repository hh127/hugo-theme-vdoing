/* hugo-theme-vdoing 交互脚本: 主题模式 / 侧边栏 / 搜索 / 代码复制 / 返回顶部 */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var STORE_MODE = 'vdoing-mode';
  var MODES = ['light', 'dark', 'read'];

  function getMode() {
    var m = 'light';
    MODES.forEach(function (x) {
      if (docEl.classList.contains('theme-mode-' + x)) m = x;
    });
    return m;
  }

  function setMode(mode) {
    MODES.forEach(function (x) { docEl.classList.remove('theme-mode-' + x); });
    docEl.classList.add('theme-mode-' + mode);
    try { localStorage.setItem(STORE_MODE, mode); } catch (e) {}
    var btn = document.getElementById('mode-toggle');
    if (btn) btn.title = '当前: ' + ({ light: '浅色', dark: '深色', read: '阅读' }[mode] || mode) + ' (点击切换)';
  }

  /* ---------------- 主题模式 ---------------- */
  var modeBtn = document.getElementById('mode-toggle');
  if (modeBtn) {
    modeBtn.title = '切换主题模式';
    modeBtn.addEventListener('click', function () {
      var i = MODES.indexOf(getMode());
      setMode(MODES[(i + 1) % MODES.length]);
    });
  }
  /* 支持 ?mode=light|dark|read 直接指定外观(便于分享/调试) */
  try {
    var qmode = new URLSearchParams(window.location.search).get('mode');
    if (qmode && MODES.indexOf(qmode) > -1) setMode(qmode);
  } catch (e) {}

  /* ---------------- 侧边栏 ---------------- */
  var sidebar = document.getElementById('sidebar');
  var mask = document.getElementById('sidebar-mask');
  var toggleBtn = document.getElementById('sidebar-toggle');

  function isMobile() { return window.innerWidth <= 960; }

  function openSidebar(open) {
    document.body.classList.toggle('sidebar-open', open);
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      openSidebar(!document.body.classList.contains('sidebar-open'));
    });
  }
  if (mask) {
    mask.addEventListener('click', function () { openSidebar(false); });
  }
  if (sidebar && !isMobile()) openSidebar(true);

  /* 侧边栏分组折叠 */
  document.addEventListener('click', function (e) {
    var title = e.target.closest ? e.target.closest('.sidebar-group-title') : null;
    if (title && title.parentNode) {
      title.parentNode.classList.toggle('open');
    }
  });

  /* ---------------- 返回顶部 ---------------- */
  var topBtn = document.getElementById('back-to-top');
  if (topBtn) {
    topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('scroll', function () {
      var y = window.pageYOffset || docEl.scrollTop;
      topBtn.classList.toggle('show', y > 400);
    }, { passive: true });
  }

  /* ---------------- 代码块复制 ---------------- */
  document.querySelectorAll('.article-body pre').forEach(function (pre) {
    var btn = document.createElement('button');
    btn.className = 'copy-button';
    btn.type = 'button';
    btn.textContent = '复制';
    btn.addEventListener('click', function () {
      var code = pre.querySelector('code');
      var text = code ? code.innerText : pre.innerText;
      var done = function () {
        btn.textContent = '已复制';
        setTimeout(function () { btn.textContent = '复制'; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        done();
      }
    });
    pre.appendChild(btn);
  });

  /* ---------------- 移动端导航下拉 ---------------- */
  document.addEventListener('click', function (e) {
    if (window.innerWidth > 719) return;
    var link = e.target.closest ? e.target.closest('.nav-item.has-dropdown > .nav-link') : null;
    if (link) {
      e.preventDefault();
      var item = link.parentNode;
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.nav-item.open').forEach(function (el) { el.classList.remove('open'); });
      if (!wasOpen) item.classList.add('open');
    }
  });

  /* ---------------- 站内搜索 ---------------- */
  var searchBox = document.getElementById('search-box');
  var searchToggle = document.getElementById('search-toggle');
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  var searchIndex = null;
  var loadingIndex = false;

  function loadIndex(cb) {
    if (searchIndex) { cb(searchIndex); return; }
    if (loadingIndex) return;
    loadingIndex = true;
    fetch((window.__BASE__ || '/') + 'index.json')
      .then(function (r) { return r.json(); })
      .then(function (data) { searchIndex = data; loadingIndex = false; cb(data); })
      .catch(function () { loadingIndex = false; });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function renderResults(list, keyword) {
    if (!list.length) {
      searchResults.innerHTML = '<li class="search-empty">没有找到相关文章</li>';
      return;
    }
    var max = (window.__SEARCH_MAX__ || 10);
    searchResults.innerHTML = list.slice(0, max).map(function (item) {
      return '<li class="search-result-item"><a href="' + item.permalink + '">' +
        '<span class="search-result-title">' + highlight(item.title, keyword) + '</span>' +
        '<span class="search-result-date">' + (item.date || '') + '</span>' +
        '</a></li>';
    }).join('');
  }

  function highlight(text, keyword) {
    var safe = escapeHtml(text);
    if (!keyword) return safe;
    var k = escapeHtml(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(k, 'ig'), function (m) { return '<em>' + m + '</em>'; });
  }

  function doSearch(keyword) {
    keyword = (keyword || '').trim();
    if (!keyword) { searchResults.innerHTML = ''; return; }
    loadIndex(function (data) {
      var kw = keyword.toLowerCase();
      var hits = [];
      data.forEach(function (item) {
        var titleHit = item.title.toLowerCase().indexOf(kw) > -1;
        var contentHit = (item.content || '').toLowerCase().indexOf(kw) > -1;
        if (titleHit || contentHit) hits.push({ item: item, score: titleHit ? 2 : 1 });
      });
      hits.sort(function (a, b) { return b.score - a.score; });
      renderResults(hits.map(function (h) { return h.item; }), keyword);
    });
  }

  if (searchToggle && searchBox) {
    searchToggle.addEventListener('click', function () {
      searchBox.classList.toggle('open');
      if (searchBox.classList.contains('open') && searchInput) {
        searchInput.focus();
        loadIndex(function () {});
      }
    });
  }
  if (searchInput) {
    var timer = null;
    searchInput.addEventListener('input', function () {
      clearTimeout(timer);
      var value = searchInput.value;
      timer = setTimeout(function () { doSearch(value); }, 200);
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && searchBox) searchBox.classList.remove('open');
    });
  }
  document.addEventListener('click', function (e) {
    if (!searchBox || !searchBox.classList.contains('open')) return;
    if (!searchBox.contains(e.target)) searchBox.classList.remove('open');
  });

  /* 键盘快捷键: / 或 ctrl+k 打开搜索 */
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      if (searchBox) {
        searchBox.classList.add('open');
        if (searchInput) searchInput.focus();
      }
    }
  });
})();
