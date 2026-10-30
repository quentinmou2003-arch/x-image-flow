'use strict';
importScripts('shared.js', 'motion.js', 'offscreen-client.js', 'native-copy.js');
chrome.action.onClicked.addListener(async tab => {
  if (/^https:\/\/(x|twitter)\.com\//.test(tab.url || '')) {
    try { await chrome.tabs.sendMessage(tab.id, {type: 'toggle'}); } catch { await chrome.tabs.reload(tab.id); }
  } else await chrome.tabs.create({url: 'https://x.com/home'});
});
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.target !== 'worker') return;
  (async () => {
    if (!sender.tab || !/^https:\/\/(x|twitter)\.com\//.test(sender.url || '')) throw Error('不支持的页面');
    if (msg.action === 'helper-check') return XIFNativeCopy.check();
    if (msg.action === 'batch-commit') return XIFNativeCopy.commit(sender.tab.id, msg.jobId);
    if (msg.action === 'batch-abort') return XIFNativeCopy.abort(sender.tab.id, msg.jobId);
    if (msg.action === 'gif-prepare') return XIFNativeCopy.prepareGIF(sender.tab.id, XIFMotion.url(msg.url));
    if (msg.action === 'batch-prepare') {
      if (!Array.isArray(msg.urls) || msg.urls.length < 2 || msg.urls.length > 4) throw Error('整组图片数量无效');
      const urls = msg.urls.map(url => XIF.mediaURL(url));
      if (msg.mode !== undefined && !['horizontal', 'vertical', 'grid'].includes(msg.mode)) throw Error('拼接布局无效');
      return XIFNativeCopy.prepare(sender.tab.id, urls, msg.mode, msg.blend);
    }
    if (msg.action === 'tweet-action') {
      throw Error('请返回 X 正常点赞或收藏一次，插件会自动学习网页接口；不会新开标签页');
    }
    if (!['copy', 'download', 'preview', 'analyze', 'prefetch'].includes(msg.action)) throw Error('未知操作');
    const values = msg.urls || [msg.url];
    if (!Array.isArray(values) || values.length < 1 || values.length > 4) throw Error('图片数量无效');
    const urls = values.map(url => XIF.mediaURL(url));
    if (urls.length > 1 && ['copy', 'download', 'preview'].includes(msg.action) && !['horizontal', 'vertical', 'grid'].includes(msg.mode)) throw Error('拼接布局无效');
    const result = await XIFOffscreen.request({action: msg.action, urls, mode: msg.mode, blend: msg.blend, seams: msg.seams});
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
