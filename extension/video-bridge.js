/* Observe video variants already returned to X. No extra API requests,
   credentials, authorization headers or tweet text are sent to the extension. */
(() => {
  'use strict';
  const api = globalThis.XIFVideo, cache = new Map();
  if (!api || window.__xifVideoBridge) return; window.__xifVideoBridge = true;
  const emit = records => window.postMessage({channel: 'xif-video-v1', records}, location.origin);
  function relevant(value) {
    try { const u = new URL(value, location.href); return u.origin === location.origin && /^\/i\/api\/(graphql\/|2\/timeline\/)/.test(u.pathname); } catch { return false; }
  }
  function consume(json) {
    try {
      const records = api.extract(json);
      for (const r of records) { cache.delete(r.id); cache.set(r.id, r); }
      while (cache.size > 600) cache.delete(cache.keys().next().value);
      if (records.length) emit(records.slice(0, 100));
    } catch { /* Do not interrupt X if its response shape changes. */ }
  }
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const request = Reflect.apply(originalFetch, this, args);
    if (relevant(typeof args[0] === 'string' || args[0] instanceof URL ? String(args[0]) : args[0]?.url)) {
      request.then(response => {
        if (!response.ok || Number(response.headers.get('content-length')) > 12000000) return;
        response.clone().text().then(text => { if (text.length <= 12000000) consume(JSON.parse(text)); }).catch(() => {});
      }).catch(() => {});
    }
    return request;
  };
  const originalOpen = XMLHttpRequest.prototype.open, originalSend = XMLHttpRequest.prototype.send;
  const tracked = new WeakMap();
  XMLHttpRequest.prototype.open = function(method, url, ...rest) { tracked.set(this, relevant(url)); return Reflect.apply(originalOpen, this, [method, url, ...rest]); };
  XMLHttpRequest.prototype.send = function(...args) {
    if (tracked.get(this)) this.addEventListener('load', () => {
      try { if (this.status < 200 || this.status >= 300) return; if (this.responseType === 'json') consume(this.response); else if ((!this.responseType || this.responseType === 'text') && this.responseText.length <= 12000000) consume(JSON.parse(this.responseText)); } catch { /* Not a JSON response. */ }
    }, {once: true});
    return Reflect.apply(originalSend, this, args);
  };
  window.addEventListener('message', event => {
    if (event.source === window && event.origin === location.origin && event.data?.channel === 'xif-video-request') {
      const all = [...cache.values()]; for (let i = 0; i < all.length; i += 100) emit(all.slice(i, i + 100));
    }
  });
})();
