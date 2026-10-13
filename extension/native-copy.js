// A single atomic file batch; Chrome owns the pipe and Windows helper exits at disconnect.
(() => {
  'use strict';
  let job = null;
  function connect() {
    const port = chrome.runtime.connectNative('com.ximageflow.clipboard'), pending = new Map();
    let disconnected = false;
    port.onMessage.addListener(result => { const callback = pending.get(result?.requestId); if (callback) { pending.delete(result.requestId); callback(result); } });
    port.onDisconnect.addListener(() => {
      disconnected = true;
      const error = chrome.runtime.lastError?.message || '助手已断开';
      for (const callback of pending.values()) callback({ok: false, error: '多图助手连接失败，请安装或检查连接：' + error});
      pending.clear();
    });
    return {
      close: () => { try { port.disconnect(); } catch {} },
      call(op, data = {}) {
        if (disconnected) return Promise.reject(Error('多图助手未连接，请安装或检查连接'));
        const requestId = crypto.randomUUID();
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => { pending.delete(requestId); reject(Error('多图助手响应超时')); }, 15000);
          pending.set(requestId, result => { clearTimeout(timer); result?.ok ? resolve(result) : reject(Error(result?.error || '多图助手未确认')); });
          try { port.postMessage({requestId, op, ...data}); } catch (e) { pending.delete(requestId); clearTimeout(timer); reject(e); }
        });
      }
    };
  }
  function discard(current) {
    clearTimeout(current.timer); current.connection.close();
    if (job === current) job = null;
  }
  globalThis.XIFNativeCopy = {
    async check() { const connection = connect(); try { return await connection.call('ping'); } finally { connection.close(); } },
    async prepare(tabId, urls, mode, blend) {
      if (job) throw Error('上一组还在复制，请稍后重试');
      const current = {id: crypto.randomUUID(), tabId, connection: connect(), ready: false};
      job = current; current.timer = setTimeout(() => discard(current), 125000);
      try {
        const count = mode ? 1 : urls.length;
        await current.connection.call('ping'); await current.connection.call('begin', {count});
        await ensureOffscreen();
        for (let i = 0; i < count; i++) {
          if (job !== current) throw Error('整组复制已取消');
          const png = await chrome.runtime.sendMessage({target: 'offscreen', action: 'copy', urls: mode ? urls : [urls[i]], mode, blend});
          if (!png?.ok) throw Error(png?.error || 'PNG 准备失败');
          if (job !== current) throw Error('整组复制已取消');
          await current.connection.call('image', {index: i, data: png.data});
        }
        current.ready = true;
        return {ok: true, jobId: current.id, count};
      } catch (e) { discard(current); throw e; }
    },
    async commit(tabId, id) {
      const current = job;
      if (!current || current.tabId !== tabId || current.id !== id || !current.ready) throw Error('整组复制任务已失效，请重试');
      try { return await current.connection.call('commit'); } finally { discard(current); }
    },
    abort(tabId, id) { if (job?.tabId === tabId && job.id === id) discard(job); return {ok: true}; }
  };
  chrome.tabs.onRemoved.addListener(tabId => { if (job?.tabId === tabId) discard(job); });
})();
