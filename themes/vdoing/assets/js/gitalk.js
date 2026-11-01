/* gitalk 评论初始化 (原 vuepress-plugin-comment 的 gitalk 方案)
   容器: article 区域的 partials/comment.html (#vuepress-plugin-comment)
   配置: head.html 注入的 window.__GITALK__ (来自 hugo.toml [params.gitalk]) */
(function () {
  'use strict';

  var cfg = window.__GITALK__;
  var el = document.getElementById('vuepress-plugin-comment');
  if (!cfg || !cfg.enable || !el || typeof window.Gitalk === 'undefined') return;

  // 页面唯一标识: 与原版保持一致, 取路径后 16 位
  var path = window.location.pathname;
  var id = path.length > 16 ? path.slice(-16) : path;
  id = id.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-') || 'gitalk';

  var title = document.title.replace(/\s*\|.*$/, '');
  var admin = cfg.admin || [];
  if (typeof admin === 'string') admin = [admin];

  try {
    var gitalk = new window.Gitalk({
      clientID: cfg.clientID,
      clientSecret: cfg.clientSecret,
      repo: cfg.repo,
      owner: cfg.owner,
      admin: admin,
      id: id,
      title: '「评论」' + title,
      labels: cfg.labels || ['Gitalk', 'Comment'],
      body: '页面：' + window.location.origin + path,
      pagerDirection: cfg.pagerDirection || 'last',
      distractionFreeMode: !!cfg.distractionFreeMode
    });
    gitalk.render(el);
  } catch (e) {
    /* 评论加载失败不影响页面 */
  }
})();
