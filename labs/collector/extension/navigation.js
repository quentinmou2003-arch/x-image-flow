// Context for gallery exits, kept in this tab only; never infer an author from a card.
(() => {
  'use strict';
  const reserved = new Set(['home', 'explore', 'notifications', 'messages', 'search', 'i', 'settings', 'compose', 'login', 'logout', 'signup', 'intent', 'share', 'tos', 'privacy', 'about', 'jobs', 'communities', 'premium', 'bookmarks', 'account', 'download', 'help']);
  function restore(value, origin) {
    try {
      if (!value || typeof value.href !== 'string') return null;
      const url = new URL(value.href);
      if (!['https://x.com', 'https://twitter.com'].includes(origin) || url.origin !== origin || url.username || url.password) return null;
      const position = n => Number.isFinite(n) && n >= 0 && n <= 100000000 ? Math.floor(n) : 0;
      return {href: url.href, x: position(value.x), y: position(value.y)};
    } catch { return null; }
  }
  function describe(href, origin) {
    const target = restore({href}, origin);
    if (!target) return null;
    const url = new URL(target.href), path = url.pathname;
    const match = path.match(/^\/([A-Za-z0-9_]{1,15})(?:\/(media|with_replies|likes|highlights|articles|followers|following|verified_followers))?\/?$/);
    const handle = match && !reserved.has(match[1].toLowerCase()) ? match[1] : null;
    let label = '返回原页面', title = '关闭拾图，返回进入时的 X 页面';
    if (handle) {
      const section = {media: '媒体页', with_replies: '回复页', likes: '喜欢页', highlights: '亮点页', articles: '文章页', followers: '关注者页', following: '关注列表', verified_followers: '认证关注者页'}[match[2]];
      label = section ? '返回' + section : '返回 @' + handle;
      title = '关闭拾图，返回 @' + handle + ' 的' + (section || '主页');
    } else if (/^\/(home)?\/?$/.test(path)) label = '返回 X 首页';
    else if (/^\/i\/bookmarks\/?$/.test(path)) label = '返回书签页';
    else if (/^\/search\/?$/.test(path)) label = '返回搜索页';
    return {label, title, handle, profileURL: handle ? origin + '/' + handle : null};
  }
  const api = {restore, describe};
  globalThis.XIFNavigation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
