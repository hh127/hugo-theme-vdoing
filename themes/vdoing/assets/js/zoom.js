/* =========================================================
   图片点击放大 (原 vuepress-plugin-zooming 的能力对齐版)
   - 选择器: site.Params.zooming.selector (默认 .theme-vdoing-content img:not(.no-zoom))
   - 背景色: site.Params.zooming.bgColor
             head.html 用 jsonify 注入, 键名可能被小写成 bgcolor, 两者都兼容
   - 交互:
       · 点击图片打开, 点击遮罩 / ESC 关闭 (关闭时重置缩放与平移)
       · 滚轮缩放 (0.5x ~ 4x), 以鼠标位置为锚点
       · 双击: 未缩放时放大到 2x, 已缩放时复位
       · 鼠标拖拽平移 (放大后), 触摸单指拖拽平移
       · 触摸双指捏合缩放
       · 只在遮罩打开时拦截滚轮 / 触摸默认行为, 不影响页面正常滚动
   - 不改动页面上原始 img
   ========================================================= */
(function () {
  'use strict';

  var raw = window.__ZOOMING__ || {};
  if (raw.enable === false) return;

  var SELECTOR = raw.selector || '.theme-vdoing-content img:not(.no-zoom)';
  // Stream A 把 head.html 的注入键名改成 camelCase 后仍可读; 旧构建里是 bgcolor
  var BG_COLOR = raw.bgColor || raw.bgcolor || 'rgba(0,0,0,0.6)';

  var MIN_SCALE = 0.5;
  var MAX_SCALE = 4;
  var DOUBLE_CLICK_SCALE = 2;
  var WHEEL_STEP = 0.15; // 每格滚轮缩放比例
  var DRAG_THRESHOLD = 4; // 判定"拖动过"的像素阈值, 拖动后不触发关闭

  var overlay = null;
  var big = null;
  var state = { scale: 1, x: 0, y: 0 };

  // 鼠标/触摸交互临时状态
  var drag = null; // { id, sx, sy, ox, oy, moved }
  var touchDrag = null; // { sx, sy, ox, oy, moved }
  var pinch = null; // { startDist, startScale }
  var lastTouchMoved = false;
  var lastDragMoved = false;
  var instantTimer = null;

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function distance(t1, t2) {
    var dx = t1.clientX - t2.clientX;
    var dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // 拖动/滚轮时关掉过渡, 保证跟手; 交互结束后恢复 (双击缩放走过渡)
  function instant() {
    if (!big) return;
    big.style.transition = 'none';
    if (instantTimer) window.clearTimeout(instantTimer);
    instantTimer = window.setTimeout(function () {
      instantTimer = null;
      if (big) big.style.transition = '';
    }, 220);
  }

  function applyTransform() {
    if (!big) return;
    big.style.transform =
      'translate(' + state.x + 'px, ' + state.y + 'px) scale(' + state.scale + ')';
  }

  function updateOverlayClass() {
    if (!overlay) return;
    overlay.classList.toggle('zooming-overlay--zoomed', state.scale > 1);
    overlay.classList.toggle('zooming-overlay--dragging', !!(drag && drag.moved));
  }

  // 以 (clientX, clientY) 为锚点缩放到 newScale
  function scaleAt(newScale, clientX, clientY) {
    newScale = clamp(newScale, MIN_SCALE, MAX_SCALE);
    if (newScale === state.scale || !overlay) return;
    var rect = overlay.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var offsetX = clientX - cx;
    var offsetY = clientY - cy;
    var ratio = newScale / state.scale;
    state.x = offsetX - (offsetX - state.x) * ratio;
    state.y = offsetY - (offsetY - state.y) * ratio;
    state.scale = newScale;
    applyTransform();
    updateOverlayClass();
  }

  // 图片中心缩放 (双指捏合 / 双击)
  function scaleCenter(newScale) {
    newScale = clamp(newScale, MIN_SCALE, MAX_SCALE);
    state.scale = newScale;
    if (newScale <= 1) {
      // 回到 1 倍时把平移也复位, 避免图片停在半空
      state.x = 0;
      state.y = 0;
    }
    applyTransform();
    updateOverlayClass();
  }

  function resetState() {
    state.scale = 1;
    state.x = 0;
    state.y = 0;
    drag = null;
    touchDrag = null;
    pinch = null;
    lastTouchMoved = false;
    lastDragMoved = false;
    if (instantTimer) {
      window.clearTimeout(instantTimer);
      instantTimer = null;
    }
    if (big) {
      big.style.transition = '';
      big.style.transform = '';
    }
    updateOverlayClass();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' || e.keyCode === 27) close();
  }

  function close() {
    if (!overlay) return;
    var el = overlay;
    resetState();
    overlay = null;
    big = null;
    el.classList.remove('zooming-overlay--active');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', onResize);
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('dblclick', onDblClick);
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', onTouchEnd);
    el.removeEventListener('touchcancel', onTouchEnd);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
  }

  function onOverlayClick(e) {
    // 只点遮罩本身时关闭; 拖动过 / 点击图片都不关闭
    if (e.target !== overlay) return;
    if (lastDragMoved) {
      lastDragMoved = false;
      return;
    }
    if (lastTouchMoved) {
      lastTouchMoved = false;
      return;
    }
    close();
  }

  /* ---------------- 滚轮缩放 ---------------- */
  function onWheel(e) {
    if (!overlay) return;
    // 遮罩打开时页面本身已经锁定滚动, 这里拦截默认行为用于缩放
    e.preventDefault();
    var delta = e.deltaY || e.deltaX || -e.wheelDelta || 0;
    if (!delta) return;
    var factor = delta < 0 ? 1 + WHEEL_STEP : 1 - WHEEL_STEP;
    instant();
    scaleAt(state.scale * factor, e.clientX, e.clientY);
  }

  /* ---------------- 双击缩放 / 复位 ---------------- */
  function onDblClick(e) {
    if (!overlay || !big) return;
    e.preventDefault();
    e.stopPropagation();
    if (state.scale !== 1) {
      scaleCenter(1);
    } else {
      scaleAt(DOUBLE_CLICK_SCALE, e.clientX, e.clientY);
    }
  }

  /* ---------------- 鼠标拖拽平移 (pointer events) ---------------- */
  function onPointerDown(e) {
    // 触摸交给 touch 事件处理, 避免两套手势互相打架
    if (!big || e.pointerType === 'touch') return;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target !== big) return;
    drag = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: state.x,
      oy: state.y,
      moved: false
    };
    lastDragMoved = false;
    if (big.setPointerCapture) {
      try { big.setPointerCapture(e.pointerId); } catch (err) {}
    }
  }

  function onPointerMove(e) {
    if (!drag || !big || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.sx;
    var dy = e.clientY - drag.sy;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
      drag.moved = true;
      overlay.classList.add('zooming-overlay--dragging');
    }
    if (!drag.moved) return;
    e.preventDefault();
    instant();
    state.x = drag.ox + dx;
    state.y = drag.oy + dy;
    applyTransform();
  }

  function onPointerUp(e) {
    if (!drag) return;
    if (e.pointerId !== undefined && e.pointerId !== drag.id) return;
    if (big && big.releasePointerCapture && e.pointerId !== undefined) {
      try { big.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    // click 事件在 pointerup 之后触发: 用 lastDragMoved 让拖动结束时不误关闭
    lastDragMoved = drag.moved;
    drag = null;
    if (overlay) overlay.classList.remove('zooming-overlay--dragging');
  }

  /* ---------------- 触摸: 单指拖拽 + 双指捏合 ---------------- */
  function onTouchStart(e) {
    if (!overlay) return;
    if (e.touches.length === 2) {
      pinch = { startDist: distance(e.touches[0], e.touches[1]) || 1, startScale: state.scale };
      touchDrag = null;
      lastTouchMoved = false;
      return;
    }
    if (e.touches.length === 1) {
      var t = e.touches[0];
      touchDrag = { sx: t.clientX, sy: t.clientY, ox: state.x, oy: state.y, moved: false };
      pinch = null;
      lastTouchMoved = false;
    }
  }

  function onTouchMove(e) {
    if (!overlay) return;
    if (e.touches.length === 2 && pinch) {
      // 双指捏合: 阻止页面缩放/滚动
      e.preventDefault();
      var dist = distance(e.touches[0], e.touches[1]) || 1;
      instant();
      var target = pinch.startScale * (dist / pinch.startDist);
      // 以两指中点为锚点
      var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      scaleAt(target, midX, midY);
      lastTouchMoved = true;
      return;
    }
    if (e.touches.length === 1 && touchDrag) {
      var t = e.touches[0];
      var dx = t.clientX - touchDrag.sx;
      var dy = t.clientY - touchDrag.sy;
      if (!touchDrag.moved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
        touchDrag.moved = true;
        lastTouchMoved = true;
        overlay.classList.add('zooming-overlay--dragging');
      }
      if (!touchDrag.moved || state.scale <= 1) return;
      e.preventDefault();
      instant();
      state.x = touchDrag.ox + dx;
      state.y = touchDrag.oy + dy;
      applyTransform();
    }
  }

  function onTouchEnd(e) {
    if (!overlay) return;
    if (pinch) {
      if (e.touches.length >= 2) return;
      pinch = null;
      // 捏合后若回到 1 倍以下, 平移一并复位
      if (state.scale <= 1) scaleCenter(1);
    }
    if (touchDrag) touchDrag = null;
    if (overlay) overlay.classList.remove('zooming-overlay--dragging');
  }

  /* ---------------- 窗口尺寸变化: 复位平移, 避免图片跑出视口 ---------------- */
  function onResize() {
    if (!overlay) return;
    state.x = 0;
    state.y = 0;
    applyTransform();
  }

  function open(img) {
    close();

    var el = document.createElement('div');
    el.className = 'zooming-overlay';
    el.style.backgroundColor = BG_COLOR;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '图片预览');

    var image = document.createElement('img');
    image.className = 'zooming-overlay__img';
    image.src = img.currentSrc || img.src;
    image.alt = img.getAttribute('alt') || '';
    image.draggable = false;
    el.appendChild(image);

    el.addEventListener('click', onOverlayClick);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dblclick', onDblClick);
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);

    overlay = el;
    big = image;
    resetState();

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
