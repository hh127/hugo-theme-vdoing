/* =========================================================
   图片点击放大 (原 vuepress-plugin-zooming)
   - 选择器: site.Params.zooming.selector (默认 .theme-vdoing-content img:not(.no-zoom))
   - 背景色: site.Params.zooming.bgColor (默认 rgba(0,0,0,0.6))
   - 点击遮罩 / ESC 关闭; 不改动页面上原始 img
   - 配置从 head.html 注入的 window.__ZOOMING__ 读取, 未注入时用 hugo.toml 中的默认值兜底
   ========================================================= */
(function () {
  'use strict';

  var config = window.__ZOOMING__ || {};
  if (config.enable === false) return;

  var SELECTOR = config.selector || '.theme-vdoing-content img:not(.no-zoom)';
  var BG_COLOR = config.bgColor || 'rgba(0,0,0,0.6)';

  var overlay = null;

  function close() {
    if (!overlay) return;
    var el = overlay;
    overlay = null;
    el.classList.remove('zooming-overlay--active');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeyDown);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' || e.keyCode === 27) close();
  }

  function open(img) {
    close();

    var el = document.createElement('div');
    el.className = 'zooming-overlay';
    el.style.backgroundColor = BG_COLOR;

    var big = document.createElement('img');
    big.src = img.currentSrc || img.src;
    big.alt = img.getAttribute('alt') || '';
    el.appendChild(big);

    el.addEventListener('click', close);
    big.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    overlay = el;

    // 触发过渡
    window.requestAnimationFrame(function () {
      el.classList.add('zooming-overlay--active');
    });
  }

  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || !target.closest) return;

    var img = target.closest(SELECTOR);
    if (!img) return;

    // 图片外层是链接时, 只放大不跳转
    e.preventDefault();
    open(img);
  });
})();
