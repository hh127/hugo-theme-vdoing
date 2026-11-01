/* 分类 / 标签页: 原版 query URL 行为的前端实现
   /categories/?category=xxx 、/tags/?tag=xxx 、&p=N
   - 服务端已渲染全部文章卡片 (无 JS 时仍可用)
   - 有 index.json 时按其顺序过滤 (置顶优先 + 日期倒序), 否则退回 DOM 上的 data-* 属性
   - 分页沿用原版 Pagination.vue 的 DOM 结构与样式 */
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

  var posts = Array.prototype.slice.call(list.querySelectorAll('.post'));
  if (!posts.length) return;

  var byPermalink = {};
  posts.forEach(function (el) {
    byPermalink[el.getAttribute('data-permalink')] = el;
  });

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

  function loadIndex(cb) {
    if (indexData) {
      cb(indexData);
      return;
    }
    if (!window.fetch) {
      cb(null);
      return;
    }
    fetch((window.__BASE__ || '/') + 'index.json')
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

  function attrMatch(el, value) {
    if (!value) return true;
    var attr = isTag ? 'data-tags' : 'data-categories';
    var raw = el.getAttribute(attr) || '';
    return raw.split('|').indexOf(value) !== -1;
  }

  function matchedPosts(value) {
    if (indexData) {
      var list2 = [];
      indexData.forEach(function (entry) {
        var arr = (isTag ? entry.tags : entry.categories) || [];
        if (!value || arr.indexOf(value) !== -1) {
          var el = byPermalink[entry.permalink];
          if (el) list2.push(el);
        }
      });
      if (list2.length || !value) return list2;
    }
    return posts.filter(function (el) {
      return attrMatch(el, value);
    });
  }

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

  function apply() {
    state.filter = currentFilter();
    var matched = matchedPosts(state.filter);
    state.total = matched.length;
    var pages = Math.max(1, Math.ceil(state.total / perPage));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;

    var start = (state.page - 1) * perPage;
    var shown = matched.slice(start, start + perPage);

    /* 全部摘出 DOM, 再把当前页的按顺序放回 (隐藏的留在 fragment 里) */
    var stored = document.createDocumentFragment();
    posts.forEach(function (el) {
      stored.appendChild(el);
    });
    shown.forEach(function (el) {
      list.appendChild(el);
    });

    renderEmpty(!matched.length);
    renderPager(pages);
    highlightBars(state.filter);
  }

  state.page = parseInt(getParam('p'), 10) || 1;
  state.filter = currentFilter();

  /* 先用服务端渲染的 DOM 快速出结果, 再用 index.json 的顺序校正 */
  apply();
  if (!lockedValue) {
    loadIndex(function (data) {
      if (data) apply();
    });
  }
  scrollActiveIntoView();
})();
