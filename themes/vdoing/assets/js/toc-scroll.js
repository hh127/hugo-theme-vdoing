/* 文章页交互 (原 RightMenu.vue / PageNav.vue / titleBadge.js / @vuepress/plugin-active-header-links)
   1. 右侧大纲: 随滚动高亮当前标题, 点击滚动, 考虑固定导航栏高度
   2. 左侧 sidebar toc (sidebar:auto / 结构化侧边栏当前页的标题子项): 随滚动高亮 (C6)
   3. 页面内锚点链接: 统一走同一个滚动函数 (C7)
   smoothScroll (site.Params.smoothScroll): false 时 behavior:'auto' (即时), true 时 smooth。
   参数由 sidebar.html 输出到 [data-smooth-scroll]; 三处滚动共用 scrollToElement()。
   4. 页面中部左右固定翻页按钮: 跟随鼠标的 tooltip 定位
   5. 文章标题前的随机徽标: 每次页面加载随机取一张
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

  /* ---------------------------------------------------------
   *  C7: smoothScroll 配置 (原 themeConfig.smoothScroll)
   *  sidebar.html 把 site.Params.smoothScroll 输出为 data-smooth-scroll="0|1"
   * --------------------------------------------------------- */
  function isSmoothScroll() {
    var el = document.querySelector('[data-smooth-scroll]');
    return !!el && el.getAttribute('data-smooth-scroll') === '1';
  }

  /* 所有“滚动到标题”路径 (右栏大纲 / 左侧 sidebar toc / 正文锚点) 共用的唯一实现 */
  function scrollToElement(el, hash) {
    if (!el) return;
    var top = el.getBoundingClientRect().top + getScrollTop() - getNavbarHeight() - 10;
    if (top < 0) top = 0;
    var smooth = isSmoothScroll();
    var root = document.documentElement;
    var restore = null;
    /* 审计 3.3: _base.scss 的 html{scroll-behavior:smooth} 恒开, 即使 behavior:'auto'
       也会被 CSS 平滑; smoothScroll=false 时临时内联覆盖, 保证是即时跳转 */
    if (!smooth && root && root.style) {
      restore = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
    }
    try {
      window.scrollTo({ top: top, behavior: smooth ? 'smooth' : 'auto' });
    } catch (e) {
      window.scrollTo(0, top);
    }
    if (restore !== null) {
      window.setTimeout(function () {
        root.style.scrollBehavior = restore;
      }, 0);
    }
    if (hash && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', hash);
    }
  }

  function decodeId(id) {
    try {
      return decodeURIComponent(id);
    } catch (e) {
      return id;
    }
  }

  /* 同一页面内的 hash 链接 (支持 "/path/#id" 与 "#id") */
  function isSamePageHash(href) {
    if (!href) return false;
    var hashIndex = href.indexOf('#');
    if (hashIndex < 0) return false;
    var path = href.slice(0, hashIndex);
    if (!path) return true;
    try {
      var url = new URL(href, window.location.href);
      return url.pathname === window.location.pathname;
    } catch (e) {
      return false;
    }
  }

  function hashTarget(href) {
    var hashIndex = href.indexOf('#');
    if (hashIndex < 0) return null;
    var id = decodeId(href.slice(hashIndex + 1));
    return id ? document.getElementById(id) : null;
  }

  /* ---------------------------------------------------------
   *  滚动监听的统一调度 (两处大纲共用, 避免重复 rAF)
   * --------------------------------------------------------- */
  var updateHandlers = [];
  var ticking = false;

  function runUpdates() {
    for (var i = 0; i < updateHandlers.length; i++) updateHandlers[i]();
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    var raf = window.requestAnimationFrame || function (fn) { setTimeout(fn, 16); };
    raf(function () {
      ticking = false;
      runUpdates();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* 按滚动位置找当前标题: 最后一个越过导航栏下沿的标题 */
  function currentByScroll(targets) {
    var offset = getNavbarHeight() + 20;
    var current = null;
    for (var i = 0; i < targets.length; i++) {
      var rect = targets[i].el.getBoundingClientRect();
      if (rect.top - offset <= 0) {
        current = targets[i];
      } else {
        break;
      }
    }
    if (!current) current = targets[0];
    return current;
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
        scrollToElement(heading, href);
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
      var current = currentByScroll(targets).item;
      if (current === active) return;
      if (active) active.classList.remove('active');
      active = current;
      active.classList.add('active');
      scrollContentTo(active);
    }

    updateHandlers.push(update);
    update();
  }

  /* ---------------------------------------------------------
   *  C6 左侧 sidebar toc: 滚动高亮 (原 @vuepress/plugin-active-header-links)
   *  sidebar:auto 页面与结构化侧边栏当前页的标题子项都是 .sidebar-sub-headers 里的
   * 页面内 hash 链接; 只处理指向“当前页面”的链接 (displayAllHeaders 下其它页的标题不参与)
   * --------------------------------------------------------- */
  function initSidebarToc() {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    var links = Array.prototype.slice.call(
      sidebar.querySelectorAll('.sidebar-sub-headers a.sidebar-link')
    );
    if (!links.length) return;

    var targets = [];
    links.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (href.indexOf('#') < 0 || !isSamePageHash(href)) return;
      var heading = hashTarget(href);
      if (!heading) return;
      targets.push({ link: link, el: heading });
      link.addEventListener('click', function (e) {
        e.preventDefault();
        scrollToElement(heading, href);
      });
    });
    if (!targets.length) return;

    var active = null;

    function setActive(target) {
      if (active === target) return;
      if (active) active.classList.remove('active');
      active = target;
      if (active) active.classList.add('active');
    }

    function update() {
      setActive(currentByScroll(targets).link);
    }

    updateHandlers.push(update);
    update();
  }

  /* ---------------------------------------------------------
   *  C7 正文/标题锚点链接: 与右栏大纲、sidebar toc 共用 scrollToElement
   *  (右栏/左栏的点击已各自 preventDefault, 这里用 defaultPrevented 去重)
   * --------------------------------------------------------- */
  function initAnchorScroll() {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var el = e.target;
      while (el && el.nodeType === 1 && el.tagName !== 'A') el = el.parentElement;
      if (!el || el.tagName !== 'A') return;
      if (el.target && el.target !== '_self') return;
      var href = el.getAttribute('href') || '';
      if (!isSamePageHash(href)) return;
      var target = hashTarget(href);
      if (!target) return;
      e.preventDefault();
      scrollToElement(target, href);
    });
  }

  /* ---------------------------------------------------------
   *  打开带 hash 的 URL 时滚动到对应标题 (原 Layout.vue mounted 行为)
   * --------------------------------------------------------- */
  function initHashScroll() {
    if (window.location.hash.length <= 1) return;
    var el = hashTarget(window.location.hash);
    if (!el) return;
    window.setTimeout(function () {
      scrollToElement(el);
    }, 0);
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
    initSidebarToc();
    initAnchorScroll();
    initHashScroll();
    initPageNavTooltip();
    initTitleBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
