/* =========================================================
   404 页随机文案 (原 404.vue:12-25 `msgs[Math.floor(Math.random() * msgs.length)]`)
   - 文案由 layouts/404.html 全量输出到 #not-found-msg 的 data-msgs (JSON 数组)
   - 每次加载随机选一条; 没有元素/没有数据时保持服务端渲染的第一条
   - 本文件位于 assets/js/, 会被 scripts.html 的 resources.Match "js/*.js" 自动打包
   ========================================================= */
(function () {
  'use strict';

  var el = document.getElementById('not-found-msg');
  if (!el) return;

  var raw = el.getAttribute('data-msgs');
  if (!raw) return;

  var msgs;
  try {
    msgs = JSON.parse(raw);
  } catch (e) {
    return;
  }
  if (!msgs || !msgs.length) return;

  var msg = msgs[Math.floor(Math.random() * msgs.length)];
  if (typeof msg === 'string' && msg) el.textContent = msg;
})();
