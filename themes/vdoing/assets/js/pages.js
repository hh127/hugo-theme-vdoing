/* 分类 / 标签页: 原版 query URL 行为的前端实现
   /categories/?category=xxx 、/tags/?tag=xxx 、&p=N
   - 分类/标签总览页 (terms): 服务端只渲染第一页, 这里用 index.json 数据按 query 过滤 + 分页并重建卡片
     (无 JS 时仍有第一页内容 + <noscript> 提示)
   - 原生 term 页 (/categories/vue/): 服务端已渲染该 term 全部文章, 这里只做 DOM 分页
   - 分页沿用原版 Pagination.vue 的 DOM 结构与样式, URL 语义保持 ?category=x&p=N
   - 过滤生效时把 rel=canonical 指向对应的原生 term 页 */
(function () {
  'use strict';

  var root = document.querySelector('.custom-page[data-taxonomy]');
  if (!root) return;

  var list = root.querySelector('.post-list');
  if (!list) return;

  var plural = root.getAttribute('data-taxonomy') || 'categories';
  var isTag = plural === 'tags';
  var paramKey = isTag ? 'tag' : 'category';
  var perPage = parseInt(root.getAttribute('data-per-page'), 10) || 10;
  var pagerBox = root.querySelector('[data-pagination]');
  /* term 页由服务端过滤, 不再响应 query 里的过滤参数 */
  var lockedValue = root.getAttribute('data-taxonomy-value') || '';
  var showCategory = root.getAttribute('data-show-category') !== '0';
  var showTag = root.getAttribute('data-show-tag') !== '0';
  /* 服务端渲染时已知的文章总数: 默认视图(无过滤/第 1 页)可以只靠它出分页条, 不必拉 3MB 的 index.json */
  var serverTotal = parseInt(root.getAttribute('data-total'), 10) || 0;
  var BASE = window.__BASE__ || '/';

  var posts = Array.prototype.slice.call(list.querySelectorAll('.post'));

  var indexData = null;
  var state = { filter: '', page: 1, total: posts.length };

  function getParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    if (!m) return '';
    var value = m[1].replace(/\+/g, ' ');
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  }

  function currentFilter() {
    if (lockedValue) return lockedValue;
    return getParam(paramKey) || '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadIndex(cb) {
    if (indexData) {
      cb(indexData);
      return;
    }
    if (!window.fetch) {
      cb(null);
      return;
    }
    fetch(BASE + 'index.json')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        indexData = Array.isArray(data) ? data : null;
        cb(indexData);
      })
      .catch(function () {
        cb(null);
      });
  }

  /* ---------- DOM 模式 (原生 term 页): 只做分页 ---------- */
  function attrMatch(el, value) {
    if (!value) return true;
    var attr = isTag ? 'data-tags' : 'data-categories';
    var raw = el.getAttribute(attr) || '';
    return raw.split('|').indexOf(value) !== -1;
  }

  /* ---------- JSON 模式 (分类/标签总览页): 过滤 + 重建卡片 ---------- */
  function matchedEntries(value) {
    if (!value) return indexData.slice();
    return indexData.filter(function (entry) {
      var arr = (isTag ? entry.tags : entry.categories) || [];
      return arr.indexOf(value) !== -1;
    });
  }

  function catTagLinks(values, pluralKey, queryKey) {
    return values
      .filter(function (v) {
        return !!v;
      })
      .map(function (v) {
        return '<a href="' + esc(BASE + pluralKey + '/?' + queryKey + '=' + encodeURIComponent(v)) + '">' + esc(v) + '</a>';
      })
      .join('');
  }

  /* 卡片结构与 layouts/partials/post-list.html 保持一致 */
  function renderCard(entry) {
    var cats = (entry.categories || []).filter(Boolean);
    var tags = (entry.tags || []).filter(Boolean);
    var attrs = ' data-permalink="' + esc(entry.permalink || '') + '" data-date="' + esc(entry.date || '') + '"';
    if (cats.length) attrs += ' data-categories="' + esc(cats.join('|')) + '"';
    if (tags.length) attrs += ' data-tags="' + esc(tags.join('|')) + '"';
    var html = '<div class="post card-box' + (entry.sticky ? ' iconfont icon-zhiding' : '') + '"' + attrs + '>';
    html += '<div class="title-wrapper"><h2><a href="' + esc(entry.permalink) + '">' + esc(entry.title);
    if (entry.titleTag) html += '<span class="title-tag">' + esc(entry.titleTag) + '</span>';
    html += '</a></h2><div class="article-info">';
    if (entry.author) {
      if (entry.authorLink) {
        html += '<a title="作者" class="iconfont icon-touxiang" href="' + esc(entry.authorLink) + '" target="_blank" rel="noopener">' + esc(entry.author) + '</a>';
      } else {
        html += '<span title="作者" class="iconfont icon-touxiang">' + esc(entry.author) + '</span>';
      }
    }
    if (entry.date) html += '<span title="创建时间" class="iconfont icon-riqi">' + esc(entry.date) + '</span>';
    if (showCategory && cats.length) {
      html += '<span title="分类" class="iconfont icon-wenjian">' + catTagLinks(cats, 'categories', 'category') + '</span>';
    }
    if (showTag && tags.length) {
      html += '<span title="标签" class="iconfont icon-biaoqian tags">' + catTagLinks(tags, 'tags', 'tag') + '</span>';
    }
    html += '</div></div>';
    if (entry.excerpt) {
      html += '<div class="excerpt-wrapper"><div class="excerpt">' + entry.excerpt + '</div>' +
        '<a class="readmore iconfont icon-jiantou-you" href="' + esc(entry.permalink) + '">阅读全文</a></div>';
    }
    html += '</div>';
    return html;
  }

  function animateIn() {
    var nodes = list.querySelectorAll('.post');
    if (!nodes.length || !window.requestAnimationFrame) return;
    var i;
    for (i = 0; i < nodes.length; i++) nodes[i].classList.add('post-enter');
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        for (i = 0; i < nodes.length; i++) nodes[i].classList.remove('post-enter');
      });
    });
  }

  function renderList(entries) {
    var html = '';
    for (var i = 0; i < entries.length; i++) html += renderCard(entries[i]);
    list.innerHTML = html;
    animateIn();
  }

  /* ---------- 分页 ---------- */
  function pageUrl(n) {
    var params = [];
    if (state.filter && !lockedValue) {
      params.push(paramKey + '=' + encodeURIComponent(state.filter));
    }
    if (n > 1) params.push('p=' + n);
    return params.length ? '?' + params.join('&') : window.location.pathname;
  }

  function pageItem(n, active) {
    return (
      '<a class="card-box' +
      (active ? ' active' : '') +
      '" href="' +
      pageUrl(n) +
      '">' +
      n +
      '</a>'
    );
  }

  function renderPager(pages) {
    if (!pagerBox) return;
    if (pages <= 1) {
      pagerBox.innerHTML = '';
      pagerBox.hidden = true;
      return;
    }
    var cur = state.page;
    var html = '';
    html +=
      '<a class="card-box prev iconfont icon-jiantou-zuo' +
      (cur === 1 ? ' disabled' : '') +
      '"' +
      (cur > 1 ? ' href="' + pageUrl(cur - 1) + '"' : '') +
      '><p>上一页</p></a>';
    html += '<div class="pagination-list">';
    if (pages <= 5) {
      for (var i = 1; i <= pages; i++) html += pageItem(i, i === cur);
    } else {
      html += pageItem(1, cur === 1);
      if (cur > 3) {
        html +=
          '<a class="ellipsis ell-two" href="' +
          pageUrl(cur - 2) +
          '" title="上两页"></a>';
      } else {
        html += pageItem(2, cur === 2);
      }
      var three = cur < 3 ? 3 : cur > pages - 3 ? pages - 2 : cur;
      html += pageItem(three, cur >= 3 && cur <= pages - 2);
      if (cur < pages - 2) {
        html +=
          '<a class="ellipsis ell-four" href="' +
          pageUrl(cur + 2) +
          '" title="下两页"></a>';
      } else {
        html += pageItem(pages - 1, cur === pages - 1);
      }
      html += pageItem(pages, cur === pages);
    }
    html += '</div>';
    html +=
      '<a class="card-box next iconfont icon-jiantou-you' +
      (cur === pages ? ' disabled' : '') +
      '"' +
      (cur < pages ? ' href="' + pageUrl(cur + 1) + '"' : '') +
      '><p>下一页</p></a>';
    pagerBox.innerHTML = html;
    pagerBox.hidden = false;
  }

  function renderEmpty(empty) {
    var el = root.querySelector('.post-list-empty');
    if (empty && !el) {
      el = document.createElement('div');
      el.className = 'post-list-empty card-box';
      el.textContent = '没有找到相关文章';
      list.parentNode.insertBefore(el, list);
    } else if (!empty && el) {
      el.parentNode.removeChild(el);
    }
  }

  /* ---------- 高亮分类/标签栏当前项 ---------- */
  function highlightBars(value) {
    var bars = root.querySelectorAll('.categories, .tags');
    Array.prototype.forEach.call(bars, function (bar) {
      var links = bar.querySelectorAll('a[href]');
      Array.prototype.forEach.call(links, function (a) {
        var query = (a.getAttribute('href') || '').split('?')[1] || '';
        var m = new RegExp('(?:^|&)' + paramKey + '=([^&]*)').exec(query);
        var v = '';
        if (m) {
          v = m[1].replace(/\+/g, ' ');
          try {
            v = decodeURIComponent(v);
          } catch (e) {
            /* 保持原值 */
          }
        }
        if (v && v === value) {
          a.classList.add('active');
        } else {
          a.classList.remove('active');
        }
      });
    });
  }

  function scrollActiveIntoView() {
    var cateEl = root.querySelector('.categories, .tags');
    if (!cateEl || !cateEl.scrollTo) return;
    var activeEl = cateEl.querySelector('.active');
    var topVal = activeEl ? activeEl.offsetTop : 0;
    window.setTimeout(function () {
      cateEl.scrollTo({ top: topVal, behavior: 'smooth' });
    }, 300);
  }

  /* 过滤生效时 canonical 指向原生 term 页 (无过滤时保留服务端输出的自引用) */
  function updateCanonical(filter) {
    if (lockedValue || !filter || !indexData) return;
    var known = indexData.some(function (entry) {
      var arr = (isTag ? entry.tags : entry.categories) || [];
      return arr.indexOf(filter) !== -1;
    });
    if (!known) return;
    var link = document.querySelector('link[rel="canonical"]');
    if (!link) return;
    var origin = window.location && window.location.origin ? window.location.origin : '';
    if (origin === 'null') origin = '';
    link.setAttribute('href', origin + BASE + plural + '/' + encodeURIComponent(filter) + '/');
  }

  /* ---------- 应用状态 ---------- */
  function clampPage(total) {
    var pages = Math.max(1, Math.ceil(total / perPage));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;
    return pages;
  }

  /* 原生 term 页: 服务端已渲染全部文章, 只按分页搬动 DOM 节点 */
  function applyDom() {
    var matched = posts.filter(function (el) {
      return attrMatch(el, state.filter);
    });
    state.total = matched.length;
    var pages = clampPage(state.total);
    var start = (state.page - 1) * perPage;
    var shown = matched.slice(start, start + perPage);

    var stored = document.createDocumentFragment();
    posts.forEach(function (el) {
      stored.appendChild(el);
    });
    shown.forEach(function (el) {
      list.appendChild(el);
    });

    renderEmpty(!matched.length);
    renderPager(pages);
    animateIn();
  }

  /* 分类/标签总览页: 用 index.json 数据过滤 + 分页并重建卡片 */
  function applyJson() {
    var matched = matchedEntries(state.filter);
    state.total = matched.length;
    var pages = clampPage(state.total);
    var start = (state.page - 1) * perPage;
    var shown = matched.slice(start, start + perPage);

    /* 第一页且无过滤时保留服务端渲染的 DOM (顺序已与 index.json 一致), 避免无谓重绘 */
    if (!(state.page === 1 && !state.filter)) {
      renderList(shown);
    }
    renderEmpty(!matched.length);
    renderPager(pages);
  }

  function apply() {
    state.filter = currentFilter();
    if (lockedValue) {
      applyDom();
    } else if (indexData) {
      applyJson();
    }
    highlightBars(state.filter);
    updateCanonical(state.filter);
  }

  state.page = parseInt(getParam('p'), 10) || 1;
  state.filter = currentFilter();

  if (lockedValue) {
    apply();
  } else {
    highlightBars(state.filter);
    if (!state.filter && state.page === 1 && serverTotal > 0) {
      /* 默认视图(无过滤第 1 页): 服务端第一页已就绪, 只需用总数生成分页条,
         避免为了分页条去拉一次 ~3MB 的 index.json */
      state.total = serverTotal;
      renderPager(clampPage(state.total));
    } else {
      loadIndex(function (data) {
        if (data) {
          indexData = data;
          apply();
        }
      });
    }
  }
  scrollActiveIntoView();
})();
