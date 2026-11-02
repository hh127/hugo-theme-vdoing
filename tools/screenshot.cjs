// 用 CDP 精确设定视口宽度后截图。
// 之所以不用 chrome --screenshot --window-size: 窗口尺寸 != 视口宽度
// (实测 --window-size=1280 时 innerWidth=1254, 会让 1279/1280 断点的页面截出错误布局),
// 而 Emulation.setDeviceMetricsOverride 的宽度就是真实的 CSS 视口宽度。
//
// 由 tools/screenshot.ps1 调用:
//   node tools/screenshot.cjs <url> <out> <width> <height> <cdpPort> [settleMs]
const fs = require('fs');
const http = require('http');

const [url, out, wArg, hArg, pArg, sArg] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node screenshot.cjs <url> <out> <width> <height> <cdpPort> [settleMs]');
  process.exit(2);
}
const width = parseInt(wArg || '1440', 10);
const height = parseInt(hArg || '1000', 10);
const port = parseInt(pArg || '9333', 10);
const settle = parseInt(sArg || '900', 10);

function getJSON(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path, timeout: 1000 }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('cdp http timeout')));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForTarget(deadline) {
  while (Date.now() < deadline) {
    try {
      const list = await getJSON('/json/list');
      const t = list.find((x) => x.type === 'page');
      if (t && t.webSocketDebuggerUrl) return t;
    } catch (_) { /* browser not ready */ }
    await sleep(100);
  }
  throw new Error('CDP target not found');
}

(async () => {
  const target = await waitForTarget(Date.now() + 15000);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    const waiters = events.get(m.method);
    if (waiters && waiters.length) { waiters.shift()(m); }
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m)));
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const once = (method) => new Promise((res) => {
    if (!events.has(method)) events.set(method, []);
    events.get(method).push(res);
  });

  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false
  });

  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url });
  // 外部资源 (gitalk / 统计) 可能一直挂起, 不等 load 完成太久
  await Promise.race([loaded, sleep(8000)]);
  await sleep(settle);

  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true
  });
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  const geo = await send('Runtime.evaluate', {
    expression: 'JSON.stringify({ innerWidth: innerWidth, h: innerHeight })',
    returnByValue: true
  });
  console.log('OK ' + out + ' ' + (geo.result && geo.result.result && geo.result.result.value));
  ws.close();
  process.exit(0);
})().catch((e) => {
  console.error('screenshot failed: ' + (e && e.message ? e.message : e));
  process.exit(1);
});
