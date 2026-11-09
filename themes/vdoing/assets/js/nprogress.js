/* 顶部加载进度条 (原 @vuepress/plugin-nprogress 的 MPA 版)
   - 首屏: 0.08 起步渐进到 0.9, window.load 后到 1 并淡出
   - 站内链接点击: 重新开始, 由新页面接管 (无需 SPA 路由)
   - 不拦截事件、不改链接行为; bfcache 返回时直接完成 */
(function () {
  'use strict';
  if (window.__VDOING_NPROGRESS__) return;
  window.__VDOING_NPROGRESS__ = true;

  var bar = null;
  var timer = null;
  var doneTimer = null;
  var current = 0;

  function create() {
    if (bar || !document.body) return;
    bar = document.createElement('div');
    bar.id = 'nprogress';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<div class="bar"></div><div class="peg"></div>';
    document.body.appendChild(bar);
  }

  function paint(v) {
    current = v;
    if (!bar) return;
    var b = bar.querySelector('.bar');
    var p = bar.querySelector('.peg');
    if (b) b.style.transform = 'scaleX(' + v + ')';
    if (p) p.style.transform = 'translate3d(' + v * 100 + '%,0,0)';
  }

  function tick() {
    var remain = 0.9 - current;
    if (remain <= 0.005) return;
    paint(current + Math.max(remain * 0.08, 0.01));
  }

  function start() {
    create();
    clearTimeout(doneTimer);
    if (bar) bar.classList.remove('nprogress-done');
    paint(0.08);
    clearInterval(timer);
    timer = setInterval(tick, 200);
  }

  function done() {
    clearInterval(timer);
    timer = null;
    if (!bar) return;
    paint(1);
    bar.classList.add('nprogress-done');
    clearTimeout(doneTimer);
    doneTimer = setTimeout(function () {
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      bar = null;
      current = 0;
    }, 320);
  }

  function isInternal(href) {
    if (!href || href.charAt(0) === '#') return false;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
    if (href.indexOf('//') === 0) return false;
    var a = document.createElement('a');
    a.href = href;
    return a.host === window.location.host && a.protocol === window.location.protocol;
  }

  /* 站内链接点击: 立即给出进度反馈 (事件不拦截, 跳转交给浏览器) */
  document.addEventListener(
    'click',
    function (e) {
      var el = e.target;
      while (el && el !== document) {
        if (el.tagName === 'A') break;
        el = el.parentNode;
      }
      if (!el || el.tagName !== 'A') return;
      if (el.target === '_blank' || el.hasAttribute('download')) return;
      if (!isInternal(el.getAttribute('href'))) return;
      start();
    },
    true
  );

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) done();
  });

  if (document.readyState === 'complete') {
    done();
  } else {
    start();
    window.addEventListener('load', function () {
      setTimeout(done, 120);
    });
  }
})();
