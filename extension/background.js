'use strict';
importScripts('shared.js');
let creating, remoteQueue = Promise.resolve();
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
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function remoteAction(msg) {
  const post = XIF.status(msg.href);
  if (!post || !['like', 'bookmark'].includes(msg.kind) || typeof msg.desired !== 'boolean') throw Error('推文操作无效');
  const tab = await chrome.tabs.create({url: post.href, active: false});
  try {
    let ready = false, lastError = '';
    for (let i = 0; i < 30; i++) {
      await wait(400);
      try { ready = (await chrome.tabs.sendMessage(tab.id, {type: 'native-ready', id: post.id, kind: msg.kind}))?.ready; } catch (e) { lastError = e.message; }
      if (ready) break;
    }
    if (!ready) throw Error(lastError ? '无法连接原推文，请刷新 X 或打开原推文重试' : 'X 未能载入操作按钮，请打开原推文重试');
    // Never retry a write: a lost response must not toggle the action twice.
    return await chrome.tabs.sendMessage(tab.id, {type: 'native-action', id: post.id, kind: msg.kind, desired: msg.desired});
  } finally { await chrome.tabs.remove(tab.id).catch(() => {}); }
}
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.target !== 'worker') return;
  (async () => {
    if (!sender.tab || !/^https:\/\/(x|twitter)\.com\//.test(sender.url || '')) throw Error('不支持的页面');
    if (msg.action === 'tweet-action') {
      const task = remoteQueue.then(() => remoteAction(msg), () => remoteAction(msg)); remoteQueue = task.catch(() => {}); return await task;
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
