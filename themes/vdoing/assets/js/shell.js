/* 外壳交互 (对应原版 Layout.vue / Buttons.vue / Navbar.vue / DropdownLink.vue /
   SidebarLinks.vue / BodyBgImg.vue):
   主题模式 / 侧边栏抽屉与悬停 / 导航栏滚动隐藏 / 下拉菜单 / 侧边栏分组折叠 /
   返回顶部 + 去评论 / body 背景图轮播 / 自定义 html 窗口 */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var body = document.body;
  var MOBILE = 719; // 原版 config.styl $MQMobile
  var NAVBAR_HEIGHT = 58;
  var STORE_MODE = 'vdoing-mode';
  var STORE_MODE_LEGACY = 'mode'; // 原版 Layout.vue 使用的 localStorage 键名
  var MODES = ['auto', 'light', 'dark', 'read'];

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function closest(el, sel) {
    while (el && el.nodeType === 1) {
      if (el.matches ? el.matches(sel) : false) return el;
      el = el.parentElement;
    }
    return null;
  }

  function isMobile() {
    return docEl.clientWidth <= MOBILE;
  }

  function getScrollTop() {
    return window.pageYOffset || docEl.scrollTop || body.scrollTop || 0;
  }

  /* =========================================================
   *  1. 主题模式 (原版 Layout.vue toggleThemeMode + Buttons.vue)
   * ========================================================= */
  var themeBut = $('#theme-mode-but');
  var themeBox = $('#mode-select-box');
  var modeMq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function readStore() {
    try { return localStorage.getItem(STORE_MODE); } catch (e) { return null; }
  }

  function writeStore(mode) {
    try { localStorage.setItem(STORE_MODE, mode); } catch (e) {}
  }

  // 老用户偏好迁移: 原版 Layout.vue 用 localStorage 'mode' 存主题模式,
  // 本主题改成 'vdoing-mode'; 首次访问时把旧值搬过来并清掉旧键, 避免偏好丢失
  function migrateLegacyStore() {
    try {
      var legacy = localStorage.getItem(STORE_MODE_LEGACY);
      if (legacy === null) return;
      if (MODES.indexOf(legacy) > -1 && !localStorage.getItem(STORE_MODE)) {
        localStorage.setItem(STORE_MODE, legacy);
      }
      localStorage.removeItem(STORE_MODE_LEGACY);
    } catch (e) {}
  }

  function currentPref() {
    var stored = readStore();
    if (stored && MODES.indexOf(stored) > -1) return stored;
    var active = themeBox ? $('li.active[data-mode]', themeBox) : null;
    return (active && active.getAttribute('data-mode')) || 'auto';
  }

  function systemMode() {
    return modeMq && modeMq.matches ? 'dark' : 'light';
  }

  function applyMode(pref) {
    var effective = pref === 'auto' ? systemMode() : pref;
    if (effective !== 'light' && effective !== 'dark' && effective !== 'read') effective = 'light';
    ['light', 'dark', 'read'].forEach(function (m) {
      docEl.classList.remove('theme-mode-' + m);
    });
    docEl.classList.add('theme-mode-' + effective);
    if (themeBox) {
      $$('li[data-mode]', themeBox).forEach(function (li) {
        li.classList.toggle('active', li.getAttribute('data-mode') === pref);
      });
    }
  }

  function setMode(pref) {
    if (MODES.indexOf(pref) === -1) pref = 'auto';
    writeStore(pref);
    applyMode(pref);
  }

  (function initMode() {
    migrateLegacyStore();
    var pref = currentPref();
    // 支持 ?mode=dark 之类的手动指定 (便于分享/截图)
    var fromUrl = /[?&]mode=(auto|light|dark|read)(?:&|$)/.exec(window.location.search);
    if (fromUrl) pref = fromUrl[1];
    applyMode(pref);
    if (modeMq) {
      var onChange = function () {
        if (currentPref() === 'auto') applyMode('auto');
      };
      if (modeMq.addEventListener) modeMq.addEventListener('change', onChange);
      else if (modeMq.addListener) modeMq.addListener(onChange);
    }
  })();

  if (themeBut && themeBox) {
    themeBut.addEventListener('mouseenter', function () {
      if (!isMobile()) themeBut.classList.add('open');
    });
    themeBut.addEventListener('mouseleave', function () {
      if (!isMobile()) themeBut.classList.remove('open');
    });
    themeBut.addEventListener('click', function (e) {
      if (closest(e.target, '.select-box')) return;
      themeBut.classList.toggle('open');
    });
    themeBox.addEventListener('click', function (e) {
      var li = closest(e.target, 'li[data-mode]');
      if (!li) return;
      e.stopPropagation();
      setMode(li.getAttribute('data-mode'));
      if (isMobile()) themeBut.classList.remove('open');
    });
    document.addEventListener('click', function (e) {
      if (themeBut.classList.contains('open') && !themeBut.contains(e.target)) {
        themeBut.classList.remove('open');
      }
    });
    // 移动端: 滚动时关闭选择框
    window.addEventListener('scroll', function () {
      if (isMobile() && themeBut.classList.contains('open')) themeBut.classList.remove('open');
    }, { passive: true });
  }

  /* =========================================================
   *  2. 侧边栏抽屉 (原版 Layout.vue toggleSidebar / isSidebarOpenOfclientWidth)
   * ========================================================= */
  var container = $('#theme-container');
  var sidebarEl = $('.sidebar');
  var sidebarMask = $('#sidebar-mask');
  var sidebarButton = $('#sidebar-button');
  var hoverTrigger = $('#sidebar-hover-trigger');

  function sidebarIsOpen() {
    return !!container && container.classList.contains('sidebar-open');
  }

  function setSidebar(open) {
    if (!container) return;
    if (open) {
      container.classList.add('sidebar-open');
      container.classList.remove('hide-navbar');
    } else {
      container.classList.remove('sidebar-open');
    }
  }

  if (container) {
    if (sidebarButton) {
      sidebarButton.addEventListener('click', function () {
        setSidebar(!sidebarIsOpen());
      });
      sidebarButton.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setSidebar(!sidebarIsOpen());
        }
      });
    }
    if (sidebarMask) {
      sidebarMask.addEventListener('click', function () {
        setSidebar(false);
      });
    }
    // 移动端初始收起 (原版 beforeMount 的 isSidebarOpenOfclientWidth)
    if (isMobile()) setSidebar(false);

    // 触屏滑动: 左侧右滑打开, 左滑关闭 (原版 Layout.vue side swipe)
    var touchStart = null;
    container.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    container.addEventListener('touchend', function (e) {
      if (!touchStart) return;
      var t = e.changedTouches && e.changedTouches[0];
      var start = touchStart;
      touchStart = null;
      if (!t) return;
      var dx = t.clientX - start.x;
      var dy = t.clientY - start.y;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        if (dx > 0 && start.x <= 80) setSidebar(true);
        else if (dx < 0) setSidebar(false);
      }
    }, { passive: true });
  }

  // sidebarHoverTriggerOpen === false 时禁用左边缘悬停弹出
  if (sidebarEl && hoverTrigger && sidebarEl.getAttribute('data-hover-trigger') === '0') {
    hoverTrigger.style.display = 'none';
  }

  /* =========================================================
   *  3. 下拉菜单: 移动端点击展开 (原版 DropdownLink.vue toggle)
   * ========================================================= */
  $$('.dropdown-title').forEach(function (title) {
    title.addEventListener('click', function (e) {
      if (!isMobile()) return;
      if (closest(e.target, '.link-title')) return;
      e.preventDefault();
      var wrapper = closest(title, '.dropdown-wrapper');
      if (!wrapper) return;
      var open = !wrapper.classList.contains('open');
      wrapper.classList.toggle('open', open);
      var arrow = $('.arrow', title);
      if (arrow) {
        arrow.classList.toggle('right', !open);
        arrow.classList.toggle('down', open);
      }
    });
  });

  /* =========================================================
   *  4. 侧边栏分组折叠: 同级同时只展开一个 (原版 SidebarLinks openGroupIndex)
   * ========================================================= */
  function setGroupArrow(heading, open) {
    if (!heading) return;
    heading.classList.toggle('open', open);
    var arrow = $('.arrow', heading);
    if (arrow) {
      arrow.classList.toggle('right', !open);
      arrow.classList.toggle('down', open);
    }
  }

  if (sidebarEl) {
    sidebarEl.addEventListener('click', function (e) {
      var heading = closest(e.target, '.sidebar-heading');
      if (!heading || !sidebarEl.contains(heading)) return;
      var group = heading.parentElement;
      if (!group || group.tagName.toLowerCase() !== 'section') return;
      var li = group.parentElement;
      var list = li ? li.parentElement : null;
      if (!list) return;
      var willOpen = !group.classList.contains('open');
      // 收起同级其它分组
      $$(':scope > li > .sidebar-group', list).forEach(function (g) {
        if (g === group) return;
        g.classList.remove('open');
        setGroupArrow($(':scope > .sidebar-heading', g), false);
      });
      group.classList.toggle('open', willOpen);
      setGroupArrow(heading, willOpen);
    });
  }

  /* =========================================================
   *  5. 滚动: 返回顶部按钮 + 向下滚动隐藏导航栏 (原版 Layout.vue)
   * ========================================================= */
  var goTop = $('#go-to-top');
  var prevScroll = getScrollTop();
  var scrollTicking = false;

  function onScroll() {
    var top = getScrollTop();
    scrollTicking = false;

    // 返回顶部按钮: 用 .show 做淡入淡出 (原版 Buttons.vue 的 <transition name="fade">)
    if (goTop) goTop.classList.toggle('show', top > 100);

    if (container) {
      if (!sidebarIsOpen()) {
        if (top > prevScroll && top > NAVBAR_HEIGHT) container.classList.add('hide-navbar');
        else container.classList.remove('hide-navbar');
      } else {
        container.classList.remove('hide-navbar');
      }
    }

    prevScroll = top;
  }

  window.addEventListener('scroll', function () {
    if (scrollTicking) return;
    scrollTicking = true;
    if (window.requestAnimationFrame) window.requestAnimationFrame(onScroll);
    else setTimeout(onScroll, 16);
  }, { passive: true });

  if (goTop) {
    goTop.addEventListener('click', function () {
      if (container) container.classList.remove('hide-navbar');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      goTop.classList.remove('show');
    });
  }

  /* =========================================================
   *  6. 去评论 (原版 Buttons.vue scrollToComment)
   * ========================================================= */
  var goComment = $('#go-to-comment');
  var COMMENT_SELECTORS = ['#vuepress-plugin-comment', '#valine-vuepress-comment', '.vssue'];
  var commentScrollTimer = null;
  var commentTextarea = null;

  function getCommentEl() {
    for (var i = 0; i < COMMENT_SELECTORS.length; i++) {
      var el = $(COMMENT_SELECTORS[i]);
      if (el) return el;
    }
    return null;
  }

  function focusCommentInput() {
    if (!commentTextarea) return;
    try { commentTextarea.focus(); } catch (e) {}
    commentTextarea.classList.add('yellowBorder');
    setTimeout(function () {
      if (commentTextarea) commentTextarea.classList.remove('yellowBorder');
    }, 500);
  }

  function getCommentButtonState() {
    setTimeout(function () {
      var el = getCommentEl();
      if (goComment) goComment.classList.toggle('show', !!el);
    }, 500);
  }

  if (goComment) {
    goComment.addEventListener('click', function () {
      var el = getCommentEl();
      if (!el) return;
      var target = el.offsetTop - NAVBAR_HEIGHT;
      window.scrollTo({ top: target, behavior: 'smooth' });
      commentTextarea = $('textarea', el) || $('input', el);
      if (!commentTextarea) return;
      // 滚动停止后再聚焦, 避免 focus 打断平滑滚动
      var lastTop = getScrollTop();
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        var top = getScrollTop();
        if (Math.abs(top - lastTop) < 1 || tries > 30) {
          clearInterval(timer);
          clearTimeout(commentScrollTimer);
          commentScrollTimer = setTimeout(focusCommentInput, 60);
        } else {
          lastTop = top;
        }
      }, 60);
    });
  }

  window.addEventListener('load', getCommentButtonState);
  getCommentButtonState();

  /* =========================================================
   *  7. body 背景大图轮播 (原版 BodyBgImg.vue)
   * ========================================================= */
  var bodyBg = $('#body-bg');
  if (bodyBg) {
    var bgImgs = [];
    try { bgImgs = JSON.parse(bodyBg.getAttribute('data-imgs') || '[]') || []; } catch (e) { bgImgs = []; }
    if (bgImgs.length > 1) {
      var bgInterval = parseFloat(bodyBg.getAttribute('data-interval')) || 15;
      var bgIndex = 0;
      setInterval(function () {
        bgIndex = (bgIndex + 1) % bgImgs.length;
        bodyBg.style.background = 'url(' + bgImgs[bgIndex] + ') center center / cover no-repeat';
        var next = bgImgs[(bgIndex + 1) % bgImgs.length];
        if (next) {
          var preload = new Image();
          preload.src = next;
        }
      }, bgInterval * 1000);
    }
  }

  /* =========================================================
   *  8. 自定义 html 窗口关闭 (原版 Layout.vue showWindowLB/RB)
   * ========================================================= */
  $$('.custom-html-window .close-but').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var win = closest(btn, '.custom-html-window');
      if (win) win.style.display = 'none';
    });
  });

  /* =========================================================
   *  9. 按钮组移动端 hover 效果 (原版 Buttons.vue touchstart/touchend)
   * ========================================================= */
  $$('.buttons .button').forEach(function (button) {
    button.addEventListener('touchstart', function () {
      button.classList.add('hover');
    }, { passive: true });
    button.addEventListener('touchend', function () {
      setTimeout(function () {
        button.classList.remove('hover');
      }, 150);
    }, { passive: true });
  });

  /* =========================================================
   *  10. navbar 链接区最大宽度自适应 (原版 Navbar.vue:56-69)
   *      .links 是绝对定位在右侧的, 菜单很长时会压住左侧站名;
   *      这里按 "navbar 宽度 - 左右内边距 - 站名宽度" 限制其最大宽度
   * ========================================================= */
  var navbarEl = $('.navbar');
  var linksEl = navbarEl ? $('.links', navbarEl) : null;
  var siteNameEl = navbarEl ? $('.site-name', navbarEl) : null;

  function updateLinksWrapWidth() {
    if (!navbarEl || !linksEl) return;
    // 移动端站名/菜单是另一套布局 (can-hide), 不限制
    if (isMobile()) {
      linksEl.style.maxWidth = '';
      return;
    }
    var cs = window.getComputedStyle ? window.getComputedStyle(navbarEl) : null;
    var pad = 0;
    if (cs) {
      pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    }
    var nameWidth = siteNameEl ? siteNameEl.offsetWidth : 0;
    var max = navbarEl.offsetWidth - pad - nameWidth;
    linksEl.style.maxWidth = max > 0 ? max + 'px' : '';
  }

  updateLinksWrapWidth();
  window.addEventListener('resize', updateLinksWrapWidth);
  window.addEventListener('load', updateLinksWrapWidth);

  /* =========================================================
   *  11. 窗口尺寸变化: 切到小屏时收起侧边栏
   * ========================================================= */
  var wasMobile = isMobile();
  window.addEventListener('resize', function () {
    var mobile = isMobile();
    if (mobile !== wasMobile) {
      wasMobile = mobile;
      if (mobile) setSidebar(false);
    }
  });

  /* 初始化完成: 解除移动端首屏防闪烁 (CSS .sidebar-ready) */
  if (container) container.classList.add('sidebar-ready');
})();
