/* 首页交互: 移动端 features 轮播 (原 Home.vue 里 better-scroll 的替代实现) */
(function () {
  'use strict';

  var MOBILE_WIDTH = 720; // 对应 $MQMobile

  var slideBanner = document.querySelector('.home-wrapper .slide-banner');
  if (!slideBanner) return;

  var wrapper = slideBanner.querySelector('.slide-banner-wrapper');
  var items = slideBanner.querySelectorAll('.slide-item');
  var dots = slideBanner.querySelectorAll('.docs-wrapper .doc');
  if (!wrapper || items.length < 2) return;

  var index = 0;
  var timer = null;
  var startX = 0;
  var startY = 0;
  var deltaX = 0;
  var dragging = false;

  function isMobile() {
    return window.innerWidth < MOBILE_WIDTH;
  }

  function render() {
    if (!isMobile()) {
      wrapper.style.transform = '';
      return;
    }
    wrapper.style.transform = 'translateX(' + (-index * 100) + '%)';
    for (var i = 0; i < dots.length; i++) {
      if (i === index) {
        dots[i].classList.add('active');
      } else {
        dots[i].classList.remove('active');
      }
    }
  }

  function go(i) {
    index = (i + items.length) % items.length;
    render();
  }

  function next() {
    go(index + 1);
  }

  function play() {
    stop();
    timer = window.setInterval(next, 4000);
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  /* 触摸滑动 */
  wrapper.addEventListener(
    'touchstart',
    function (e) {
      if (!isMobile()) return;
      stop();
      dragging = true;
      deltaX = 0;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    },
    { passive: true }
  );

  wrapper.addEventListener(
    'touchmove',
    function (e) {
      if (!dragging) return;
      var dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy)) {
        deltaX = dx;
        if (e.cancelable) e.preventDefault();
      }
    },
    { passive: false }
  );

  wrapper.addEventListener(
    'touchend',
    function () {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(deltaX) > 50) {
        go(index + (deltaX < 0 ? 1 : -1));
      }
      deltaX = 0;
      play();
    },
    { passive: true }
  );

  /* 圆点点击切换 */
  for (var i = 0; i < dots.length; i++) {
    (function (i) {
      dots[i].addEventListener('click', function () {
        go(i);
        play();
      });
    })(i);
  }

  /* 鼠标悬停暂停 */
  slideBanner.addEventListener('mouseenter', stop);
  slideBanner.addEventListener('mouseleave', play);

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(render, 120);
  });

  render();
  play();
})();
