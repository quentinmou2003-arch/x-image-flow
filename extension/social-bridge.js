/* The page owns its login. Credentials stay in this closure, never in messages or storage.
   Learn only the four native social mutations, then send explicitly requested writes to X. */
(() => {
  'use strict';
  const api = globalThis.XIFSocial; if (!api || window.__xifSocialBridge) return; window.__xifSocialBridge = true;
  const originalFetch = window.fetch, originalOpen = XMLHttpRequest.prototype.open,
    originalHeader = XMLHttpRequest.prototype.setRequestHeader, originalSend = XMLHttpRequest.prototype.send;
  const templates = new Map(), tracked = new WeakMap(), busy = new Set();
  let auth = {};
  const allowedHeaders = ['authorization', 'x-csrf-token', 'x-twitter-auth-type', 'x-twitter-active-user', 'x-twitter-client-language'];
  const emit = value => window.postMessage(value, location.origin);
  function relevant(url) {
    try { const u = new URL(url, location.href); return u.origin === location.origin && /^\/i\/api\/(graphql\/|2\/)/.test(u.pathname); } catch { return false; }
  }
  function remember(headers) {
    const filtered = {};
    for (const key of allowedHeaders) { const val = headers.get(key); if (val) filtered[key] = val; }
    if (filtered.authorization && filtered['x-csrf-token']) auth = filtered;
  }
  function learned(captured, json) {
    if (!captured || !api.confirmed(json, captured.template.operation)) return;
    templates.set(captured.template.operation, captured.template);
    emit({channel: 'xif-social-template', template: captured.template});
    const op = api.operations[captured.template.operation];
    emit({channel: 'xif-social-state', id: captured.id, kind: op.kind, state: op.state});
  }
  async function observeFetch(input, init, response) {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    if (!relevant(url)) return;
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value)); remember(headers);
    const method = String(init?.method || input?.method || 'GET').toUpperCase(); if (method !== 'POST') return;
    let body = init?.body;
    if (body == null && input instanceof Request) { try { body = await input.clone().text(); } catch { return; } }
    if (typeof body !== 'string' || body.length > 100000) return;
    const captured = api.capture(url, body, location.origin); if (!captured) return;
    const r = await response; if (!r.ok) return;
    try { learned(captured, await r.clone().json()); } catch { /* Keep the original X request unaffected. */ }
  }
  window.fetch = function(input, init) {
    // Clone a Request before fetch consumes its body.
    let observed = input; try { if (input instanceof Request) observed = input.clone(); } catch {}
    const result = Reflect.apply(originalFetch, this, [input, init]);
    observeFetch(observed, init, result).catch(() => {}); return result;
  };
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    tracked.set(this, {method: String(method).toUpperCase(), url, headers: new Headers()});
    return Reflect.apply(originalOpen, this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(key, value) {
    const info = tracked.get(this); if (info) info.headers.set(key, value);
    return Reflect.apply(originalHeader, this, [key, value]);
  };
  XMLHttpRequest.prototype.send = function(body) {
    const info = tracked.get(this);
    if (info && relevant(info.url)) {
      remember(info.headers);
      const captured = info.method === 'POST' && typeof body === 'string' && body.length <= 100000 ? api.capture(info.url, body, location.origin) : null;
      if (captured) this.addEventListener('load', () => {
        if (this.status < 200 || this.status >= 300) return;
        try { learned(captured, this.responseType === 'json' ? this.response : JSON.parse(this.responseText)); } catch {}
      }, {once: true});
    }
    return Reflect.apply(originalSend, this, [body]);
  };
  async function write(msg) {
    const op = api.operation(msg.kind, msg.desired), t = templates.get(op);
    if (!op || !/^\d{1,30}$/.test(msg.id)) return {ok: false, error: '无效的 X 操作参数'};
    if (!t) { const label = msg.kind === 'like' ? (msg.desired ? '点赞' : '取消点赞') : (msg.desired ? '添加书签' : '取消书签'); return {ok: false, unavailable: true, error: `请返回 X 正常${label}一次，插件会自动学习此接口`}; }
    if (!auth.authorization || !auth['x-csrf-token']) return {ok: false, unavailable: true, error: '请刷新 X 并确认已登录，等待主页载入后再试'};
    const key = msg.id + ':' + msg.kind; if (busy.has(key)) return {ok: false, error: '这条推文正在同步，请稍等'};
    busy.add(key);
    try {
      const headers = {...auth, 'content-type': 'application/json'};
      const csrf = document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith('ct0='))?.slice(4);
      if (csrf) headers['x-csrf-token'] = decodeURIComponent(csrf);
      const response = await Reflect.apply(originalFetch, window, [t.path, {method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify(api.body(t, msg.id)), signal: AbortSignal.timeout(12000)}]);
      if (!response.ok) {
        if ([400, 404].includes(response.status)) { templates.delete(op); emit({channel: 'xif-social-forget', operation: op}); }
        return {ok: false, error: response.status === 429 ? 'X 请求过于频繁，请稍后再试' : [401, 403].includes(response.status) ? 'X 拒绝了请求，请返回 X 检查登录状态并正常操作一次' : `X 接口请求失败 (${response.status})，请返回 X 操作`};
      }
      let json; try { json = await response.json(); } catch { return {ok: false, error: 'X 返回结果无法确认，请到原推文检查状态'}; }
      if (!api.confirmed(json, op)) return {ok: false, error: 'X 未确认操作成功，请到原推文检查状态'};
      const result = {ok: true, state: msg.desired};
      emit({channel: 'xif-social-state', id: msg.id, kind: msg.kind, state: msg.desired}); return result;
    } catch { return {ok: false, error: 'X 请求未能完成，请到原推文确认状态后再试'}; }
    finally { busy.delete(key); }
  }
  window.addEventListener('message', event => {
    const msg = event.data; if (event.source !== window || event.origin !== location.origin || !msg) return;
    if (msg.channel === 'xif-social-init') {
      for (const value of Array.isArray(msg.templates) ? msg.templates.slice(0, 4) : []) { const t = api.template(value); if (t && !templates.has(t.operation)) templates.set(t.operation, t); }
      for (const t of templates.values()) emit({channel: 'xif-social-template', template: t});
    }
    if (msg.channel === 'xif-social-write' && typeof msg.requestId === 'string' && msg.requestId.length < 100) {
      write(msg).then(result => emit({channel: 'xif-social-reply', requestId: msg.requestId, result}));
    }
  });
})();
