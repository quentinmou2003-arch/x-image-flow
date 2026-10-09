(function(scope) {
  'use strict';
  const operations = Object.freeze({
    FavoriteTweet: {kind: 'like', state: true, result: 'favorite_tweet'},
    UnfavoriteTweet: {kind: 'like', state: false, result: 'unfavorite_tweet'},
    CreateBookmark: {kind: 'bookmark', state: true, result: 'tweet_bookmark_put'},
    DeleteBookmark: {kind: 'bookmark', state: false, result: 'tweet_bookmark_delete'}
  });
  const booleanFields = value => Object.fromEntries(Object.entries(value || {}).slice(0, 200).filter(([key, val]) => /^[A-Za-z0-9_]{1,120}$/.test(key) && typeof val === 'boolean'));
  function operation(kind, state) { return Object.keys(operations).find(key => operations[key].kind === kind && operations[key].state === state); }
  function template(value) {
    if (!value || typeof value.path !== 'string') return null;
    const match = value.path.match(/^\/i\/api\/graphql\/([A-Za-z0-9_-]{8,128})\/(FavoriteTweet|UnfavoriteTweet|CreateBookmark|DeleteBookmark)$/);
    if (!match || (value.queryId != null && value.queryId !== match[1])) return null;
    const out = {path: value.path, operation: match[2], queryId: match[1]};
    for (const key of ['features', 'fieldToggles', 'extraVariables']) {
      const fields = booleanFields(value[key]); if (Object.keys(fields).length) out[key] = fields;
    }
    return out;
  }
  function capture(url, body, origin) {
    try {
      const u = new URL(url, origin); if (u.origin !== origin) return null;
      const data = typeof body === 'string' ? JSON.parse(body) : body;
      if (!data || !/^\d{1,30}$/.test(String(data.variables?.tweet_id || ''))) return null;
      const t = template({path: u.pathname, queryId: data.queryId, features: data.features, fieldToggles: data.fieldToggles, extraVariables: data.variables});
      return t ? {template: t, id: String(data.variables.tweet_id)} : null;
    } catch { return null; }
  }
  function body(t, id) {
    t = template(t); if (!t || !/^\d{1,30}$/.test(id)) throw Error('无效的 X 操作参数');
    const result = {variables: {...t.extraVariables, tweet_id: id}, queryId: t.queryId};
    for (const key of ['features', 'fieldToggles']) if (t[key]) result[key] = t[key];
    return result;
  }
  function confirmed(json, op) {
    return !!operations[op] && !json?.errors?.length && json?.data?.[operations[op].result] === 'Done';
  }
  function syncNativeState(group, kind, actual) {
    if (!actual) return false;
    const pending = group.apiState?.[kind];
    if (pending && pending.state !== actual.on) return false;
    if (pending) delete group.apiState[kind];
    const changed = group[kind] !== actual.on; group[kind] = actual.on; return changed;
  }
  scope.XIFSocial = {operations, operation, template, capture, body, confirmed, syncNativeState};
  if (typeof module !== 'undefined') module.exports = scope.XIFSocial;
})(globalThis);
