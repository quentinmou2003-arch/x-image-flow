// Image preparation only: never replay account writes or native clipboard commits.
(() => {
  'use strict';
  let starting;
  const connectionError = () => Error('图片处理连接未就绪，请稍后重试；若持续出现，请重新加载拾图并刷新 X');
  const missingReceiver = error => /Receiving end does not exist|Could not establish connection|message (?:port|channel) closed|message channel.*closed/i.test(error?.message || '');
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function ping() {
    let timer;
    try {
      const result = await Promise.race([
        chrome.runtime.sendMessage({target: 'offscreen', action: 'ready'}),
        new Promise(resolve => { timer = setTimeout(() => resolve(null), 500); })
      ]);
      return result?.ok === true && result.ready === true;
    } catch (error) {
      if (!missingReceiver(error)) throw error;
      return false;
    } finally { clearTimeout(timer); }
  }
  async function start() {
    const deadline = Date.now() + 6000;
    do {
      const contexts = await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [chrome.runtime.getURL('offscreen.html')]});
      if (!contexts.length) await chrome.offscreen.createDocument({url: 'offscreen.html', reasons: ['BLOBS'], justification: 'Prepare and stitch full-size PNG images for the focused page.'});
      if (await ping()) return;
      await pause(100);
    } while (Date.now() < deadline);
    // Do not close a live document: that would invalidate pending exports and blob URLs.
    throw connectionError();
  }
  async function ensure() {
    if (!starting) starting = start().finally(() => { starting = null; });
    await starting;
  }
  async function request(data) {
    if (!['copy', 'download', 'preview', 'analyze', 'prefetch', 'local-copy', 'gif'].includes(data.action)) throw Error('不支持恢复此操作');
    for (let attempt = 0; attempt < 2; attempt++) {
      await ensure();
      try {
        const result = await chrome.runtime.sendMessage({...data, target: 'offscreen'});
        if (result == null) throw Error('Receiving end does not exist');
        return result;
      } catch (error) {
        if (!missingReceiver(error)) throw error;
        if (attempt === 1) throw connectionError();
      }
    }
  }
  globalThis.XIFOffscreen = {request};
})();
