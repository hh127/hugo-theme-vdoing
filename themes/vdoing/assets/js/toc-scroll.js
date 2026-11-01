/* 文章页交互 (原 RightMenu.vue / PageNav.vue / titleBadge.js 的浏览器端行为)
   1. 右侧大纲: 随滚动高亮当前标题 (IntersectionObserver/滚动计算), 点击平滑滚动, 考虑固定导航栏高度
   2. 页面中部左右固定翻页按钮: 跟随鼠标的 tooltip 定位
   3. 文章标题前的随机徽标: 每次页面加载随机取一张
   每个模块独立初始化, 找不到对应 DOM 时安全退出 */
(function () {
  'use strict';

  function getScrollTop() {
    return (
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0
    );
  }

  function getNavbarHeight() {
    var navbar = document.querySelector('.navbar');
    return navbar ? navbar.offsetHeight : 58;
  }

  /* 滚动到某个标题, 留出固定导航栏的高度 */
  function scrollToElement(el) {
    if (!el) return;
    var top = el.getBoundingClientRect().top + getScrollTop() - getNavbarHeight() - 10;
    if (top < 0) top = 0;
    try {
      window.scrollTo({ top: top, behavior: 'smooth' });
    } catch (e) {
      window.scrollTo(0, top);
    }
  }

  /* ---------------------------------------------------------
   *  右侧大纲 (原 RightMenu.vue)
   * --------------------------------------------------------- */
  function initRightMenu() {
    var wrapper = document.querySelector('.right-menu-wrapper');
    if (!wrapper) return;
    var content = wrapper.querySelector('.right-menu-content');
    var items = Array.prototype.slice.call(
      wrapper.querySelectorAll('.right-menu-item')
    );
    if (!items.length) return;

    var targets = [];
    items.forEach(function (item) {
      var link = item.querySelector('a');
      var href = link ? link.getAttribute('href') || '' : '';
      if (href.charAt(0) !== '#') return;
      var id = href.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch (e) {
        /* 保持原样 */
      }
      var heading = id ? document.getElementById(id) : null;
      if (!heading) return;
      targets.push({ item: item, el: heading });
      link.addEventListener('click', function (e) {
        e.preventDefault();
        scrollToElement(heading);
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', href);
        }
      });
    });
    if (!targets.length) return;

    var active = null;

    /* 让高亮项在 .right-menu-content 可视范围内 */
    function scrollContentTo(item) {
      if (!content || content.scrollHeight <= content.clientHeight) return;
      var itemTop = item.offsetTop;
      var viewTop = content.scrollTop;
      var viewBottom = viewTop + content.clientHeight;
      var itemHeight = item.offsetHeight;
      if (itemTop < viewTop) {
        content.scrollTop = itemTop;
      } else if (itemTop + itemHeight > viewBottom) {
        content.scrollTop = itemTop + itemHeight - content.clientHeight;
      }
    }

    function update() {
      var offset = getNavbarHeight() + 20;
      var current = null;
      for (var i = 0; i < targets.length; i++) {
        var rect = targets[i].el.getBoundingClientRect();
        if (rect.top - offset <= 0) {
          current = targets[i].item;
        } else {
          break;
        }
      }
      if (!current) current = targets[0].item;
      if (current === active) return;
      if (active) active.classList.remove('active');
      active = current;
      active.classList.add('active');
      scrollContentTo(active);
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      var raf = window.requestAnimationFrame || function (fn) { setTimeout(fn, 16); };
      raf(function () {
        ticking = false;
        update();
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();

    /* 初始化时链接带锚点, 手动滚动到对应位置 (原 Layout.vue mounted 行为) */
    if (window.location.hash.length > 1) {
      var hashId = window.location.hash.slice(1);
      try {
        hashId = decodeURIComponent(hashId);
      } catch (e) {
        /* 保持原样 */
      }
      var hashEl = hashId ? document.getElementById(hashId) : null;
      if (hashEl) {
        window.setTimeout(function () {
          scrollToElement(hashEl);
        }, 0);
      }
    }
  }

  /* ---------------------------------------------------------
   *  页面中部左右固定翻页按钮 tooltip (原 PageNav.vue showTooltip)
   * --------------------------------------------------------- */
  function initPageNavTooltip() {
    var centres = document.querySelectorAll(
      '.page-nav-centre-wrap .page-nav-centre'
    );
    Array.prototype.forEach.call(centres, function (el) {
      var tooltip = el.querySelector('.tooltip');
      if (!tooltip) return;

      function move(e) {
        var clientW = document.body.clientWidth;
        var x = e.clientX;
        tooltip.style.top = e.clientY + 10 + 'px';
        if (x < clientW / 2) {
          tooltip.style.right = '';
          tooltip.style.left = x + 10 + 'px';
        } else {
          tooltip.style.left = '';
          tooltip.style.right = clientW - x + 10 + 'px';
        }
      }

      el.addEventListener('mouseenter', move);
      el.addEventListener('mousemove', move);
    });
  }

  /* ---------------------------------------------------------
   *  文章标题前随机徽标 (原 mixins/titleBadge.js)
   * --------------------------------------------------------- */
  function initTitleBadge() {
    var badge = document.querySelector(
      '.theme-vdoing-wrapper h1 img[data-badges]'
    );
    if (!badge) return;
    var list = (badge.getAttribute('data-badges') || '')
      .split(',')
      .filter(function (s) {
        return s.length > 0;
      });
    if (list.length < 2) return;
    badge.src = list[Math.floor(Math.random() * list.length)];
  }

  function init() {
    initRightMenu();
    initPageNavTooltip();
    initTitleBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
