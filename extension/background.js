'use strict';
importScripts('shared.js');
let creating;
async function ensureOffscreen() {
  if ((await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']})).length) return;
  if (!creating) creating = chrome.offscreen.createDocument({url: 'offscreen.html', reasons: ['BLOBS'], justification: 'Prepare and stitch full-size PNG images for the focused page.'}).finally(() => { creating = null; });
  await creating;
}
chrome.action.onClicked.addListener(async tab => {
  if (/^https:\/\/(x|twitter)\.com\//.test(tab.url || '')) {
    try { await chrome.tabs.sendMessage(tab.id, {type: 'toggle'}); } catch { await chrome.tabs.reload(tab.id); }
  } else await chrome.tabs.create({url: 'https://x.com/home'});
});
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.target !== 'worker') return;
  (async () => {
    if (!sender.tab || !/^https:\/\/(x|twitter)\.com\//.test(sender.url || '')) throw Error('不支持的页面');
    if (msg.action === 'tweet-action') {
      throw Error('请返回 X 正常点赞或收藏一次，插件会自动学习网页接口；不会新开标签页');
    }
    if (!['copy', 'download', 'preview', 'analyze', 'prefetch'].includes(msg.action)) throw Error('未知操作');
    const values = msg.urls || [msg.url];
    if (!Array.isArray(values) || values.length < 1 || values.length > 4) throw Error('图片数量无效');
    const urls = values.map(url => XIF.mediaURL(url));
    if (urls.length > 1 && ['copy', 'download', 'preview'].includes(msg.action) && !['horizontal', 'vertical', 'grid'].includes(msg.mode)) throw Error('拼接布局无效');
    await ensureOffscreen();
    const result = await chrome.runtime.sendMessage({target: 'offscreen', action: msg.action, urls, mode: msg.mode, blend: msg.blend, seams: msg.seams});
    if (!result?.ok) throw Error(result?.error || '图片处理失败');
    if (msg.action === 'download') {
      const base = urls.length > 1 ? `stitch-${Date.now()}` : new URL(urls[0]).pathname.split('/').pop().replace(/[^a-zA-Z0-9_-]/g, '_');
      try { await chrome.downloads.download({url: result.url, filename: `X-Images/${base}.png`, saveAs: true}); }
      finally { setTimeout(() => chrome.runtime.sendMessage({target: 'offscreen', action: 'revoke', url: result.url}).catch(() => {}), 60000); }
      return {ok: true, width: result.width, height: result.height};
    }
    return result;
  })().then(reply, error => reply({ok: false, error: error.message})); return true;
});
