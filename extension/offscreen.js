'use strict';
const cache = new Map(), pending = new Map();
let cacheBytes = 0, active = 0, exportQueue = Promise.resolve();
const waiting = [], MAX_BYTES = 96 * 1024 * 1024;
function pump() { while (active < 4 && waiting.length) { active++; const job = waiting.shift(); job.run().then(job.resolve, job.reject).finally(() => { active--; pump(); }); } }
function limited(run, low = false) { return new Promise((resolve, reject) => { const job = {run, resolve, reject}; if (low) waiting.push(job); else waiting.unshift(job); pump(); }); }
async function fetchImage(value, size = 'orig', low = false) {
  const url = XIF.mediaURL(value, size), old = cache.get(url);
  if (old && Date.now() - old.time < 180000) { cache.delete(url); cache.set(url, old); return old.blob; }
  if (old) { cacheBytes -= old.blob.size; cache.delete(url); }
  if (pending.has(url)) return pending.get(url);
  const promise = limited(async () => {
    const response = await fetch(url, {credentials: 'omit', signal: AbortSignal.timeout(25000)});
    if (!response.ok) throw Error(`图片请求失败 (${response.status})`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw Error('返回内容不是图片');
    if (blob.size > MAX_BYTES) throw Error('图片文件过大');
    while (cacheBytes + blob.size > MAX_BYTES && cache.size) { const key = cache.keys().next().value; cacheBytes -= cache.get(key).blob.size; cache.delete(key); }
    cache.set(url, {blob, time: Date.now()}); cacheBytes += blob.size; return blob;
  }, low).finally(() => pending.delete(url));
  pending.set(url, promise); return promise;
}
async function withImages(urls, size, fn) {
  const settled = await Promise.allSettled(urls.map(async url => createImageBitmap(await fetchImage(url, size, size !== 'orig'))));
  const images = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
  try { const failed = settled.find(r => r.status === 'rejected'); if (failed) throw failed.reason; return await fn(images); }
  finally { images.forEach(im => im.close()); }
}
async function analyze(urls) {
  return withImages(urls, 'small', images => {
    const samples = images.map(im => {
      const scale = Math.min(1, 192 / Math.max(im.width, im.height));
      const canvas = new OffscreenCanvas(Math.max(2, Math.round(im.width * scale)), Math.max(2, Math.round(im.height * scale)));
      const ctx = canvas.getContext('2d', {willReadFrequently: true}); ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    });
    return {ok: true, suggestion: XIF.detect(samples)};
  });
}
const plans = new Map();
function pixels(im, scale = 1) {
  const c = new OffscreenCanvas(Math.max(2, Math.round(im.width * scale)), Math.max(2, Math.round(im.height * scale)));
  const ctx = c.getContext('2d', {willReadFrequently: true}); ctx.drawImage(im, 0, 0, c.width, c.height);
  return ctx.getImageData(0, 0, c.width, c.height);
}
function edgePixels(im, horizontal, end, depth) {
  const w = horizontal ? Math.min(im.width, depth) : im.width, h = horizontal ? im.height : Math.min(im.height, depth);
  const x0 = horizontal && end ? im.width - w : 0, y0 = !horizontal && end ? im.height - h : 0;
  const c = new OffscreenCanvas(w, h), ctx = c.getContext('2d', {willReadFrequently: true});
  ctx.drawImage(im, x0, y0, w, h, 0, 0, w, h);
  return {width: im.width, height: im.height, dataWidth: w, dataHeight: h, x0, y0, data: ctx.getImageData(0, 0, w, h).data};
}
function registration(images, mode, key) {
  if (plans.has(key)) return plans.get(key);
  const scale = Math.min(1, 640 / Math.max(...images.flatMap(im => [im.width, im.height])));
  const samples = images.map(im => pixels(im, scale)), horizontal = mode === 'horizontal';
  const seams = samples.slice(1).map((im, i) => {
    let s = XIFStitch.match(samples[i], im, mode);
    if (s.accepted && scale < 1) {
      const guess = {overlap: Math.round(s.overlap / scale), shift: Math.round(s.shift / scale)}, radius = Math.ceil(3 / scale);
      const depth = Math.max(4, guess.overlap + radius + 2);
      s = XIFStitch.refine(edgePixels(images[i], horizontal, true, depth), edgePixels(images[i + 1], horizontal, false, depth), mode, guess, radius);
    }
    return s.accepted ? s : {...s, overlap: 0, shift: 0};
  });
  if (plans.size >= 8) plans.delete(plans.keys().next().value);
  plans.set(key, seams); return seams;
}
async function render(urls, mode, preview, auto, overrides) {
  // Stitch previews and exports share original pixels, integer placement and registration.
  return withImages(urls, 'orig', async images => {
    if (images.reduce((n, im) => n + im.width * im.height, 0) > 100000000) throw Error('图片总尺寸过大');
    let layout = images.length === 1 ? {width: images[0].width, height: images[0].height, cells: [{x: 0, y: 0}], seams: []} : XIF.geometry(images, mode);
    if (images.length > 1 && ['horizontal', 'vertical'].includes(mode)) {
      const detected = auto ? registration(images, mode, JSON.stringify([urls, mode, images.map(im => [im.width, im.height])])) : images.slice(1).map(() => ({overlap: 0, shift: 0, accepted: false}));
      if (overrides !== undefined && (!Array.isArray(overrides) || overrides.length > images.length - 1)) throw Error('接缝参数无效');
      const seams = detected.map((s, i) => {
        const manual = overrides?.[i]; if (manual == null) return s;
        if (!Number.isSafeInteger(manual.overlap) || !Number.isSafeInteger(manual.shift)) throw Error('接缝参数必须为整数');
        return {...s, overlap: manual.overlap, shift: manual.shift, manual: true};
      });
      layout = XIFStitch.layout(images, mode, seams);
    }
    const canvas = new OffscreenCanvas(layout.width, layout.height), ctx = canvas.getContext('2d');
    // Exact pixel replacement: blending cannot repair missing content and can ghost line art.
    images.forEach((im, i) => { const c = layout.cells[i]; ctx.clearRect(c.x, c.y, im.width, im.height); ctx.drawImage(im, c.x, c.y); });
    let output = canvas;
    if (preview && Math.max(canvas.width, canvas.height) > 1600) {
      const scale = 1600 / Math.max(canvas.width, canvas.height);
      output = new OffscreenCanvas(Math.round(canvas.width * scale), Math.round(canvas.height * scale));
      output.getContext('2d').drawImage(canvas, 0, 0, output.width, output.height);
    }
    let png;
    if (images.length === 1 && !preview) { const original = await fetchImage(urls[0]); png = original.type === 'image/png' ? original : await output.convertToBlob({type: 'image/png'}); }
    else png = await output.convertToBlob({type: 'image/png'});
    return {png, width: layout.width, height: layout.height, seams: layout.seams || []};
  });
}
function dataURL(blob) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(Error('预览读取失败')); r.readAsDataURL(blob); }); }
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.target !== 'offscreen' || sender.id !== chrome.runtime.id) return;
  const work = async () => {
    if (msg.action === 'revoke') { URL.revokeObjectURL(msg.url); return {ok: true}; }
    const urls = msg.urls || [msg.url];
    if (!Array.isArray(urls) || urls.length < 1 || urls.length > 4) throw Error('图片数量无效');
    urls.forEach(url => XIF.mediaURL(url));
    if (msg.action === 'prefetch') { await Promise.all(urls.map(url => fetchImage(url, 'orig', true))); return {ok: true}; }
    if (msg.action === 'analyze') return analyze(urls);
    if (!['copy', 'download', 'preview'].includes(msg.action)) throw Error('未知操作');
    const result = await render(urls, msg.mode, msg.action === 'preview', msg.blend !== false, msg.seams);
    if (msg.action === 'preview') return {ok: true, data: await dataURL(result.png), width: result.width, height: result.height, seams: result.seams};
    if (msg.action === 'copy') {
      // Offscreen documents cannot receive focus. Only prepare PNG here;
      // the focused content script performs the clipboard write.
      if (result.png.size > 40 * 1024 * 1024) throw Error('PNG 超过复制大小限制，请保存 PNG 后通过 QQ 发送文件');
      return {ok: true, data: await dataURL(result.png), width: result.width, height: result.height};
    }
    const url = URL.createObjectURL(result.png); setTimeout(() => URL.revokeObjectURL(url), 300000);
    return {ok: true, url, width: result.width, height: result.height};
  };
  // Preserve click order and avoid simultaneous full-size export canvases.
  const task = ['copy', 'download'].includes(msg.action) ? (exportQueue = exportQueue.then(work, work)) : work();
  task.then(reply, error => reply({ok: false, error: error.message})); return true;
});
