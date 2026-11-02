/* gitalk 评论初始化 (原 vuepress-plugin-comment 的 gitalk 方案)
   容器: article 区域的 partials/comment.html (#vuepress-plugin-comment)
   配置: head.html 注入的 window.__GITALK__ (来自 hugo.toml [params.gitalk]) */
(function () {
  'use strict';

  var cfg = window.__GITALK__;
  var el = document.getElementById('vuepress-plugin-comment');
  var status = document.getElementById('comment-status');
  if (!el) return;

  // 加载/失败状态提示 (原插件自带 loading 态; 这里用 #comment-status 占位)
  function fail(msg) {
    if (status) {
      status.textContent = msg;
      status.style.display = '';
    }
  }

  if (!cfg || !cfg.enable) {
    fail('评论未启用。');
    return;
  }
  if (typeof window.Gitalk === 'undefined') {
    fail('评论组件加载失败，请检查网络后刷新重试。');
    return;
  }

  // 页面唯一标识: 与原版保持一致, 取路径后 16 位
  var path = window.location.pathname;
  var id = path.length > 16 ? path.slice(-16) : path;
  id = id.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-') || 'gitalk';

  // A1: 同时兼容 camelCase (head.html 显式 dict 输出) 与小写键
  // (旧版 head.html 用 jsonify 直出 params, Hugo 会把键名小写成 clientid/clientsecret/pagerdirection)
  function pick(camel, lower, dflt) {
    if (cfg[camel] !== undefined && cfg[camel] !== null) return cfg[camel];
    if (lower && cfg[lower] !== undefined && cfg[lower] !== null) return cfg[lower];
    return dflt;
  }

  var admin = pick('admin', 'admin', []);
  if (typeof admin === 'string') admin = [admin];

  var title = document.title.replace(/\s*\|.*$/, '');

  try {
    var gitalk = new window.Gitalk({
      clientID: pick('clientID', 'clientid', ''),
      clientSecret: pick('clientSecret', 'clientsecret', ''),
      repo: pick('repo', 'repo', ''),
      owner: pick('owner', 'owner', ''),
      admin: admin,
      id: id,
      title: '「评论」' + title,
      labels: pick('labels', 'labels', ['Gitalk', 'Comment']),
      body: '页面：' + window.location.origin + path,
      pagerDirection: pick('pagerDirection', 'pagerdirection', 'last'),
      distractionFreeMode: !!pick('distractionFreeMode', 'distractionfreemode', false)
    });
    gitalk.render(el);
    if (status) status.style.display = 'none';
  } catch (e) {
    /* 评论加载失败不影响页面, 但给出可见提示 */
    fail('评论加载失败，请稍后刷新重试。');
  }
})();
