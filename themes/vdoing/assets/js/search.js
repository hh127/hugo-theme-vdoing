/* 站内搜索: 读取首页输出的 index.json, 纯前端过滤 (原主题 SearchBox 的替代实现) */
(function () {
  'use strict';

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

  function highlight(text, keyword) {
    var safe = escapeHtml(text);
    if (!keyword) return safe;
    var k = escapeHtml(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(k, 'ig'), function (m) { return '<em>' + m + '</em>'; });
  }

  function openBox() {
    if (!searchBox) return;
    searchBox.classList.add('open');
    if (searchInput) searchInput.focus();
    loadIndex(function () {});
  }

  function closeBox() {
    if (searchBox) searchBox.classList.remove('open');
  }

  function renderResults(list, keyword) {
    if (!searchResults) return;
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

  function doSearch(keyword) {
    keyword = (keyword || '').trim();
    if (!keyword) { if (searchResults) searchResults.innerHTML = ''; return; }
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

  if (searchToggle) {
    searchToggle.addEventListener('click', function (e) {
      e.preventDefault();
      if (searchBox && searchBox.classList.contains('open')) { closeBox(); } else { openBox(); }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('focus', function () {
      if (searchBox) searchBox.classList.add('open');
      loadIndex(function () {});
    });
    var timer = null;
    searchInput.addEventListener('input', function () {
      clearTimeout(timer);
      var value = searchInput.value;
      timer = setTimeout(function () { doSearch(value); }, 200);
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeBox();
    });
  }

  document.addEventListener('click', function (e) {
    if (!searchBox || !searchBox.classList.contains('open')) return;
    if (!searchBox.contains(e.target)) closeBox();
  });

  /* 键盘快捷键: / 或 ctrl+k 打开搜索 */
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      openBox();
    }
  });
})();
