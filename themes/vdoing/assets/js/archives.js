/* 归档页渐进加载 (原 ArchivesPage.vue: perPage=80, 滚动到底部 250px 内自动 loadmore)
   - 服务端输出全部条目 (SEO), 首屏之后由 archives.html 加 hidden
   - 滚动接近底部或点击「加载更多」时按 archivePageSize 批次显示, 并同步显示对应年份标题 */
(function () {
  'use strict';

  var root = document.querySelector('.archives-page');
  if (!root) return;

  var list = document.getElementById('archive-list');
  var button = document.getElementById('archive-loadmore');
  if (!list) return;

  var pageSize = parseInt(root.getAttribute('data-page-size'), 10) || 80;
  var items = Array.prototype.slice.call(list.querySelectorAll('.archive-item'));
  if (!items.length) return;

  var visible = 0;
  for (var i = 0; i < items.length; i++) {
    if (!items[i].hidden) visible++;
  }
  if (!visible) visible = Math.min(pageSize, items.length);

  var headers = Array.prototype.slice.call(list.querySelectorAll('.year'));
  var finished = visible >= items.length;

  function revealYear(year) {
    if (!year) return;
    for (var h = 0; h < headers.length; h++) {
      if (headers[h].getAttribute('data-year') === year) {
        headers[h].hidden = false;
        return;
      }
    }
  }

  function show(upTo) {
    upTo = Math.min(upTo, items.length);
    for (var i = 0; i < upTo; i++) {
      if (items[i].hidden) {
        items[i].hidden = false;
        revealYear(items[i].getAttribute('data-year'));
      }
    }
    visible = upTo;
    finished = visible >= items.length;
    updateButton();
  }

  function updateButton() {
    if (!button) return;
    if (finished) {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    var rest = items.length - visible;
    button.textContent = '加载更多（还有 ' + rest + ' 篇）';
  }

  function loadMore() {
    if (finished) return;
    show(visible + pageSize);
  }

  if (button) {
    button.addEventListener('click', loadMore);
    button.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        loadMore();
      }
    });
  }

  /* 滚动到底部附近自动加载 (原版阈值 250px, 加 debounce) */
  var scrollTimer = null;
  function onScroll() {
    if (finished) return;
    if (scrollTimer) return;
    scrollTimer = window.setTimeout(function () {
      scrollTimer = null;
      if (finished) return;
      var docEl = document.documentElement;
      var docBody = document.body;
      var scrollTop = docEl.scrollTop || docBody.scrollTop;
      var clientHeight = docEl.clientHeight || docBody.clientHeight;
      var scrollHeight = docEl.scrollHeight || docBody.scrollHeight;
      if (scrollHeight > clientHeight && scrollTop + clientHeight >= scrollHeight - 250) {
        loadMore();
      }
    }, 200);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  updateButton();
})();
