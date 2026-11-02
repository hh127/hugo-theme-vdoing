/* 首页交互: 老分页链接兼容 + 移动端 features 轮播
   轮播对齐原 Home.vue 的 better-scroll 配置 (loop:true, threshold:100, slide 模式):
   - 首尾各克隆一张实现无缝循环, 过渡结束后无动画回跳
   - 拖动阈值 100px, 支持触摸与鼠标拖拽, 松手时按速度做惯性翻页
   - 4s 自动播放, 悬停/拖动暂停 */
(function () {
  'use strict';

  /* ---------- B9: 老外链 /?p=N 重定向到 /page/N/ ---------- */
  var redirected = (function redirectLegacyPageParam() {
    var m = /[?&]p=(\d+)/.exec(window.location.search || '');
    if (!m) return false;
    var page = parseInt(m[1], 10);
    if (!page || page <= 1) return false;
    var base = window.__BASE__ || '/';
    if (base.charAt(base.length - 1) !== '/') base += '/';
    window.location.replace(base + 'page/' + page + '/');
    return true;
  })();
  if (redirected) return;

  var MOBILE_WIDTH = 720; // 对应 $MQMobile
  var DRAG_THRESHOLD = 100; // 原 better-scroll slide.threshold
  var VELOCITY_THRESHOLD = 0.5; // px/ms, 惯性翻页
  var AUTOPLAY_INTERVAL = 4000;

  var slideBanner = document.querySelector('.home-wrapper .slide-banner');
  if (!slideBanner) return;

  var wrapper = slideBanner.querySelector('.slide-banner-wrapper');
  var items = slideBanner.querySelectorAll('.slide-item');
  var dots = slideBanner.querySelectorAll('.docs-wrapper .doc');
  if (!wrapper || items.length < 2) return;

  var count = items.length;
  var pos = 1; // DOM 位置: 0 = 末尾克隆, 1..count = 真实项, count+1 = 首项克隆
  var timer = null;
  var suppressClick = false;

  var drag = {
    active: false,
    axis: null,
    startX: 0,
    startY: 0,
    dx: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0
  };

  /* ---------- 克隆首尾 ---------- */
  var cloneFirst = items[0].cloneNode(true);
  var cloneLast = items[count - 1].cloneNode(true);
  cloneFirst.className += ' slide-clone';
  cloneLast.className += ' slide-clone';
  cloneFirst.setAttribute('aria-hidden', 'true');
  cloneLast.setAttribute('aria-hidden', 'true');
  wrapper.appendChild(cloneFirst);
  wrapper.insertBefore(cloneLast, wrapper.firstChild);

  function isMobile() {
    return window.innerWidth < MOBILE_WIDTH;
  }

  function width() {
    return wrapper.clientWidth || slideBanner.clientWidth || 1;
  }

  function applyTransform(dxPx) {
    var pct = -pos * 100 + (dxPx / width()) * 100;
    wrapper.style.transform = 'translateX(' + pct + '%)';
  }

  function setPos(p, animate) {
    pos = p;
    wrapper.style.transition = animate ? 'transform 0.4s ease' : 'none';
    applyTransform(0);
  }

  function normalize() {
    if (pos <= 0) {
      setPos(count, false);
    } else if (pos >= count + 1) {
      setPos(1, false);
    }
  }

  function activeIndex() {
    return ((pos - 1) % count + count) % count;
  }

  function renderDots() {
    var active = activeIndex();
    for (var i = 0; i < dots.length; i++) {
      if (i === active) {
        dots[i].classList.add('active');
      } else {
        dots[i].classList.remove('active');
      }
    }
  }

  function render() {
    if (!isMobile()) {
      wrapper.style.transition = 'none';
      wrapper.style.transform = '';
      return;
    }
    normalize();
    renderDots();
  }

  function goTo(p) {
    if (!isMobile()) return;
    normalize();
    if (p > count + 1) p = count + 1;
    if (p < 0) p = 0;
    setPos(p, true);
    renderDots();
  }

  function next() {
    goTo(pos + 1);
  }

  function play() {
    stop();
    timer = window.setInterval(function () {
      if (!drag.active) next();
    }, AUTOPLAY_INTERVAL);
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  wrapper.addEventListener('transitionend', function (e) {
    if (e.target !== wrapper) return;
    normalize();
    renderDots();
  });

  /* ---------- 拖动 (触摸 + 鼠标) ---------- */
  function dragStart(x, y) {
    if (!isMobile()) return;
    stop();
    drag.active = true;
    drag.axis = null;
    drag.startX = x;
    drag.startY = y;
    drag.dx = 0;
    drag.lastX = x;
    drag.lastTime = Date.now();
    drag.velocity = 0;
    wrapper.style.transition = 'none';
  }

  function dragMove(x, y, e) {
    if (!drag.active) return;
    var dx = x - drag.startX;
    var dy = y - drag.startY;
    if (drag.axis === null) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.axis === 'y') {
        drag.active = false;
        setPos(pos, true);
        return;
      }
    }
    if (drag.axis !== 'x') return;
    var now = Date.now();
    var dt = now - drag.lastTime;
    if (dt > 0) {
      drag.velocity = (x - drag.lastX) / dt;
      drag.lastX = x;
      drag.lastTime = now;
    }
    drag.dx = dx;
    applyTransform(dx);
    if (e && e.cancelable) e.preventDefault();
  }

  function dragEnd() {
    if (!drag.active) return;
    drag.active = false;
    var dx = drag.dx;
    var velocity = drag.velocity;
    var target = pos;
    if (dx <= -DRAG_THRESHOLD || (dx < -30 && velocity < -VELOCITY_THRESHOLD)) {
      target = pos + 1;
    } else if (dx >= DRAG_THRESHOLD || (dx > 30 && velocity > VELOCITY_THRESHOLD)) {
      target = pos - 1;
    }
    if (Math.abs(dx) > 5) {
      suppressClick = true;
      window.setTimeout(function () {
        suppressClick = false;
      }, 350);
    }
    setPos(target, true);
    renderDots();
    drag.dx = 0;
    drag.velocity = 0;
    play();
  }

  /* 触摸 */
  wrapper.addEventListener(
    'touchstart',
    function (e) {
      if (e.touches.length !== 1) return;
      dragStart(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: true }
  );

  wrapper.addEventListener(
    'touchmove',
    function (e) {
      if (!drag.active || e.touches.length !== 1) return;
      dragMove(e.touches[0].clientX, e.touches[0].clientY, e);
    },
    { passive: false }
  );

  wrapper.addEventListener(
    'touchend',
    function () {
      dragEnd();
    },
    { passive: true }
  );

  wrapper.addEventListener('touchcancel', dragEnd, { passive: true });

  /* 鼠标拖拽 */
  wrapper.addEventListener('mousedown', function (e) {
    if (!isMobile() || e.button !== 0) return;
    dragStart(e.clientX, e.clientY);
  });

  document.addEventListener('mousemove', function (e) {
    if (!drag.active) return;
    dragMove(e.clientX, e.clientY, e);
  });

  document.addEventListener('mouseup', function () {
    if (!drag.active) return;
    dragEnd();
  });

  /* 拖动后抑制误触链接 */
  slideBanner.addEventListener(
    'click',
    function (e) {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  /* 圆点点击切换 */
  for (var i = 0; i < dots.length; i++) {
    (function (index) {
      dots[index].addEventListener('click', function () {
        goTo(index + 1);
        play();
      });
    })(i);
  }

  /* 悬停暂停 */
  slideBanner.addEventListener('mouseenter', stop);
  slideBanner.addEventListener('mouseleave', play);

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(render, 120);
  });

  setPos(1, false);
  render();
  play();
})();
