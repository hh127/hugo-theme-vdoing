/* 站内搜索: 读取首页输出的 index.json 做纯前端检索 (原主题 @vuepress/search 的替代实现)
   能力:
   - 标题 / h2~h6 小节标题 / 全文正文三处匹配, 多关键词空格分词 (全部命中)
   - 结果输出正文命中片段并高亮关键词; 命中标题时链接直达 #anchor
   - ↑↓ 选择、Enter 打开、Esc 关闭; searchMaxSuggestions 限制条数
   - [[params.thirdpartySearch]] 第三方搜索外链 ({query} 占位)
   - 可选 [params.algolia]: 配置 appId/apiKey/indexName 时走 Algolia REST 检索, 失败回退本地索引
   - site.Params.search=false 时页面上没有搜索框, 本脚本自动不执行任何操作 */
(function () {
  'use strict';

  var box = document.getElementById('search-box');
  if (!box) return; /* B12: 首页/任何页面无搜索框时快捷键也不报错 */

  var toggle = document.getElementById('search-toggle');
  var input = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  if (!input || !results) return;

  var MAX = parseInt(window.__SEARCH_MAX__, 10) || 10;
  var THIRDPARTY = window.__THIRDPARTY_SEARCH__ || [];
  var ALGOLIA = window.__ALGOLIA__ || null;

  var indexData = null;
  var loadingIndex = false;
  var indexCallbacks = [];
  var searchTimer = null;
  var activeIndex = -1;
  var currentItems = [];
  var requestSeq = 0;
  var lastKeyword = '';

  /* ---------- 索引加载 ---------- */
  function loadIndex(cb) {
    if (indexData) { if (cb) cb(indexData); return; }
    if (cb) indexCallbacks.push(cb);
    if (loadingIndex) return;
    loadingIndex = true;
    var url = (window.__BASE__ || '/') + 'index.json';
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        indexData = Array.isArray(data) ? data : [];
        loadingIndex = false;
        flushIndexCallbacks();
      })
      .catch(function () {
        loadingIndex = false;
        indexData = [];
        flushIndexCallbacks();
      });
  }

  function flushIndexCallbacks() {
    var list = indexCallbacks;
    indexCallbacks = [];
    for (var i = 0; i < list.length; i++) {
      try { list[i](indexData); } catch (e) { /* ignore */ }
    }
  }

  /* ---------- 文本工具 ---------- */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function splitTerms(keyword) {
    return String(keyword || '').toLowerCase().split(/\s+/).filter(function (t) { return !!t; });
  }

  function allMatch(text, terms) {
    var lower = String(text || '').toLowerCase();
    for (var i = 0; i < terms.length; i++) {
      if (lower.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  function anyMatch(text, terms) {
    var lower = String(text || '').toLowerCase();
    for (var i = 0; i < terms.length; i++) {
      if (lower.indexOf(terms[i]) > -1) return true;
    }
    return false;
  }

  function highlight(text, terms) {
    text = String(text == null ? '' : text);
    if (!terms.length) return escapeHtml(text);
    var re = new RegExp('(' + terms.map(escapeRe).join('|') + ')', 'gi');
    var out = '';
    var last = 0;
    var m;
    while ((m = re.exec(text)) !== null) {
      out += escapeHtml(text.slice(last, m.index)) + '<em>' + escapeHtml(m[0]) + '</em>';
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    return out + escapeHtml(text.slice(last));
  }

  /* 截取关键词附近的正文片段 */
  function makeSnippet(content, terms) {
    content = String(content || '');
    if (!content) return '';
    var lower = content.toLowerCase();
    var hit = -1;
    var hitLen = 0;
    for (var i = 0; i < terms.length; i++) {
      var pos = lower.indexOf(terms[i]);
      if (pos > -1 && (hit === -1 || pos < hit)) {
        hit = pos;
        hitLen = terms[i].length;
      }
    }
    if (hit === -1) return '';
    var context = 40;
    var start = Math.max(0, hit - context);
    var end = Math.min(content.length, hit + hitLen + context);
    var text = content.slice(start, end);
    return (start > 0 ? '…' : '') + highlight(text, terms) + (end < content.length ? '…' : '');
  }

  /* ---------- 本地索引检索 ---------- */
  function searchLocal(keyword) {
    var terms = splitTerms(keyword);
    if (!terms.length) return [];
    var hits = [];
    var data = indexData || [];
    for (var i = 0; i < data.length; i++) {
      var entry = data[i];
      var titleHit = allMatch(entry.title, terms);
      var contentHit = allMatch(entry.content, terms);
      var headerHits = [];
      var headers = entry.headers || [];
      for (var h = 0; h < headers.length; h++) {
        if (allMatch(headers[h].title, terms)) headerHits.push(headers[h]);
      }
      if (!titleHit && !contentHit && !headerHits.length) continue;
      var score = titleHit ? 4 : headerHits.length ? 2 : 1;
      if (entry.sticky) score += 0.5;
      var anchor = headerHits.length ? '#' + (headerHits[0].anchor || '') : '';
      hits.push({
        entry: entry,
        score: score,
        date: entry.date || '',
        href: (entry.permalink || '#') + anchor,
        title: entry.title || '',
        snippet: contentHit ? makeSnippet(entry.content, terms) : '',
        headers: headerHits.slice(0, 3)
      });
    }
    hits.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.date).localeCompare(String(a.date));
    });
    return hits.slice(0, MAX);
  }

  /* ---------- Algolia REST (可选) ---------- */
  function searchAlgolia(keyword, done) {
    var appId = ALGOLIA.appId;
    var apiKey = ALGOLIA.apiKey;
    var indexName = ALGOLIA.indexName;
    var url = 'https://' + appId + '-dsn.algolia.net/1/indexes/' + encodeURIComponent(indexName) + '/query';
    fetch(url, {
      method: 'POST',
      headers: {
        'X-Algolia-Application-Id': appId,
        'X-Algolia-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: keyword,
        hitsPerPage: MAX,
        attributesToRetrieve: ['title', 'permalink', 'date', 'content'],
        attributesToSnippet: ['content:20']
      })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('algolia http ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var hits = (data.hits || []).map(function (hit) {
          var snippet = '';
          if (hit._snippetResult && hit._snippetResult.content) {
            snippet = hit._snippetResult.content.value || '';
          }
          return {
            entry: hit,
            score: 10,
            date: hit.date || '',
            href: hit.permalink || hit.url || '#',
            title: hit.title || '',
            snippet: snippet,
            headers: []
          };
        });
        done(hits);
      })
      .catch(function () {
        done(searchLocal(keyword)); /* Algolia 不可用时回退本地索引 */
      });
  }

  /* ---------- 渲染 ---------- */
  function thirdpartyItems(keyword) {
    var items = [];
    for (var i = 0; i < THIRDPARTY.length; i++) {
      var tp = THIRDPARTY[i] || {};
      if (!tp.link) continue;
      var href = String(tp.link).replace(/\{query\}/g, encodeURIComponent(keyword));
      items.push({
        external: true,
        href: href,
        title: '在 ' + (tp.name || '外部搜索') + ' 中搜索 “' + keyword + '”'
      });
    }
    return items;
  }

  function itemHtml(item, index) {
    var title = item.external ? escapeHtml(item.title) : highlight(item.title, splitTerms(lastKeyword));
    var html = '<li class="search-result-item' + (item.external ? ' search-result-thirdparty' : '') +
      '" role="option" data-index="' + index + '" data-href="' + escapeHtml(item.href) + '">';
    html += '<a class="search-result-link" href="' + escapeHtml(item.href) + '"' +
      (item.external ? ' target="_blank" rel="noopener"' : '') + '>';
    html += '<span class="search-result-title">' + title + '</span>';
    if (!item.external) html += '<span class="search-result-date">' + escapeHtml(item.date) + '</span>';
    html += '</a>';
    if (item.snippet) html += '<div class="search-result-snippet">' + item.snippet + '</div>';
    if (item.headers && item.headers.length) {
      html += '<div class="search-result-headers">';
      for (var h = 0; h < item.headers.length; h++) {
        var head = item.headers[h];
        html += '<a href="' + escapeHtml((item.entry.permalink || '') + '#' + head.anchor) + '">' +
          '<span class="search-result-header-level">h' + escapeHtml(head.level) + '</span>' +
          highlight(head.title, splitTerms(lastKeyword)) + '</a>';
      }
      html += '</div>';
    }
    html += '</li>';
    return html;
  }

  function render(keyword, hits, seq) {
    if (seq !== requestSeq) return;
    currentItems = hits.concat(thirdpartyItems(keyword));
    activeIndex = -1;
    if (!currentItems.length) {
      results.innerHTML = '<li class="search-empty">没有找到相关文章</li>';
      setExpanded(true);
      return;
    }
    var html = '';
    for (var i = 0; i < currentItems.length; i++) html += itemHtml(currentItems[i], i);
    results.innerHTML = html;
    setExpanded(true);
  }

  function setExpanded(open) {
    if (input.setAttribute) {
      input.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (toggle && toggle.setAttribute) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }

  function openBox() {
    box.classList.add('open');
    setExpanded(true);
    if (input) input.focus();
    loadIndex(function () {
      if (input.value.trim()) doSearch(input.value);
    });
  }

  function closeBox() {
    box.classList.remove('open');
    setExpanded(false);
    activeIndex = -1;
  }

  function highlightActive() {
    var nodes = results.querySelectorAll('.search-result-item');
    for (var i = 0; i < nodes.length; i++) {
      if (i === activeIndex) {
        nodes[i].classList.add('active');
        if (nodes[i].scrollIntoView) nodes[i].scrollIntoView({ block: 'nearest' });
      } else {
        nodes[i].classList.remove('active');
      }
    }
  }

  function openItem(item) {
    if (!item || !item.href) return;
    if (item.external) {
      window.open(item.href, '_blank', 'noopener');
    } else {
      window.location.href = item.href;
    }
    closeBox();
  }

  /* ---------- 检索入口 ---------- */
  function doSearch(keyword) {
    keyword = String(keyword || '').trim();
    lastKeyword = keyword;
    var seq = ++requestSeq;
    if (!keyword) {
      currentItems = [];
      results.innerHTML = '';
      setExpanded(false);
      return;
    }
    if (ALGOLIA) {
      searchAlgolia(keyword, function (hits) { render(keyword, hits, seq); });
      return;
    }
    loadIndex(function () {
      if (seq !== requestSeq) return;
      render(keyword, searchLocal(keyword), seq);
    });
  }

  /* ---------- 事件绑定 ---------- */
  if (toggle) {
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      if (box.classList.contains('open')) closeBox(); else openBox();
    });
  }

  input.addEventListener('focus', function () {
    box.classList.add('open');
    loadIndex(function () {});
    if (input.value.trim() && !currentItems.length) doSearch(input.value);
  });

  input.addEventListener('input', function () {
    clearTimeout(searchTimer);
    var value = input.value;
    searchTimer = setTimeout(function () { doSearch(value); }, 150);
  });

  input.addEventListener('keydown', function (e) {
    var key = e.key;
    if (key === 'Escape') {
      e.preventDefault();
      if (box.classList.contains('open')) { closeBox(); } else { input.blur(); }
      return;
    }
    if (!currentItems.length) return;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault();
      var total = currentItems.length;
      if (key === 'ArrowDown') {
        activeIndex = (activeIndex + 1) % total;
      } else {
        activeIndex = (activeIndex - 1 + total) % total;
      }
      highlightActive();
      return;
    }
    if (key === 'Enter') {
      e.preventDefault();
      var item = currentItems[activeIndex >= 0 ? activeIndex : 0];
      openItem(item);
    }
  });

  document.addEventListener('click', function (e) {
    if (!box.classList.contains('open')) return;
    if (!box.contains(e.target)) closeBox();
  });

  /* 键盘快捷键: / 或 Ctrl/⌘+K 打开搜索 (输入框内不劫持) */
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    if (e.key === '/' || ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k')) {
      e.preventDefault();
      openBox();
    }
  });
})();
