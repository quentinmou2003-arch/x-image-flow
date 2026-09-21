/* Clipboard writes must start in the focused page during the user's click.
   Promise-backed ClipboardItem retains that context while PNG is prepared. */
(() => {
  'use strict';
  let busy = false, retry = null;
  function decode(data) {
    const prefix = 'data:image/png;base64,';
    if (typeof data !== 'string' || !data.startsWith(prefix) || data.length > 57 * 1024 * 1024) throw Error('PNG 数据无效，请重试或保存 PNG');
    const binary = atob(data.slice(prefix.length)), bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) throw Error('返回的内容不是 PNG');
    return new Blob([bytes], {type: 'image/png'});
  }
  globalThis.XIFClipboard = {
    async copy(key, prepare) {
      if (busy) throw Error('上一张图片还在复制，请稍候');
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw Error('当前浏览器不支持图片复制，请使用保存 PNG');
      if (!document.hasFocus()) throw Error('请切回 X 页面，再点击复制 PNG');
      busy = true;
      let prepared;
      const task = retry?.key === key && Date.now() - retry.time < 120000
        ? Promise.resolve(retry.value)
        : Promise.resolve().then(prepare).then(result => ({blob: decode(result.data), width: result.width, height: result.height}));
      const png = task.then(value => { prepared = value; return value.blob; });
      // Handle an early permission rejection even if preparation later fails.
      png.catch(() => {});
      try {
        await navigator.clipboard.write([new ClipboardItem({'image/png': png})]);
        retry = null;
        return {width: prepared.width, height: prepared.height};
      } catch (error) {
        const value = await task.catch(() => null);
        if (value) retry = {key, value, time: Date.now()};
        if (/not focused|focus/i.test(error.message) || !document.hasFocus()) throw Error('图片已准备，请切回 X 再点一次复制；看到复制成功后再切换 QQ');
        if (error.name === 'NotAllowedError') throw Error('浏览器未允许写入剪贴板，请在 X 页面重试，或使用保存 PNG');
        throw error;
      } finally { busy = false; }
    }
  };
})();
