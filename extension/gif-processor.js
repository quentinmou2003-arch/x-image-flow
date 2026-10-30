(() => {
  'use strict';
  const LIMIT = 40 * 1024 * 1024;
  async function fetchBlob(value) {
    const response = await fetch(XIFMotion.url(value), {credentials: 'omit', signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw Error('动图读取失败 (' + response.status + ')');
    if (Number(response.headers.get('content-length')) > LIMIT) throw Error('动图超过 40 MB 复制限制');
    const reader = response.body.getReader(), parts = []; let size = 0;
    try { while (true) { const item = await reader.read(); if (item.done) break; size += item.value.length; if (size > LIMIT) throw Error('动图超过 40 MB 复制限制'); parts.push(item.value); } }
    catch (error) { await reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
    return new Blob(parts, {type: response.headers.get('content-type') || ''});
  }
  function event(video, name, trigger) {
    return new Promise((resolve, reject) => {
      const done = error => { clearTimeout(timer); video.removeEventListener(name, success); video.removeEventListener('error', failure); error ? reject(error) : resolve(); };
      const success = () => done(), failure = () => done(Error('浏览器无法解码此动图'));
      const timer = setTimeout(() => done(Error('动图解码超时，请重试')), 15000);
      video.addEventListener(name, success, {once: true}); video.addEventListener('error', failure, {once: true});
      try { trigger(); } catch (error) { done(error); }
    });
  }
  async function convert(value) {
    const blob = await fetchBlob(value), header = new Uint8Array(await blob.slice(0, 6).arrayBuffer());
    if (String.fromCharCode(...header) === 'GIF87a' || String.fromCharCode(...header) === 'GIF89a') {
      const image = await createImageBitmap(blob);
      try { if (image.width * image.height > 100000000) throw Error('GIF 尺寸过大'); return {blob: new Blob([blob], {type: 'image/gif'}), width: image.width, height: image.height, original: true}; }
      finally { image.close(); }
    }
    if (new URL(value).origin !== 'https://video.twimg.com') throw Error('来源没有返回 GIF 文件');
    const video = document.createElement('video'), source = URL.createObjectURL(blob), encoder = XIFGIFEncoder.GIFEncoder();
    video.muted = true; video.playsInline = true; video.preload = 'auto';
    const deadline = Date.now() + 150000;
    try {
      await event(video, 'loadedmetadata', () => { video.src = source; video.load(); });
      const p = XIFMotion.plan(video.videoWidth, video.videoHeight, video.duration);
      const canvas = new OffscreenCanvas(p.width, p.height), context = canvas.getContext('2d', {willReadFrequently: true});
      for (let i = 0; i < p.frames; i++) {
        if (Date.now() > deadline) throw Error('动图转换超时，请稍后重试');
        const time = Math.min(video.duration - .001, i * video.duration / p.frames);
        if (video.readyState < 2 || Math.abs(video.currentTime - time) > .0001) await event(video, 'seeked', () => { video.currentTime = Math.max(.000001, time); });
        context.drawImage(video, 0, 0, p.width, p.height);
        const rgba = context.getImageData(0, 0, p.width, p.height).data;
        const palette = XIFGIFEncoder.quantize(rgba, 256), indexed = XIFGIFEncoder.applyPalette(rgba, palette);
        const delay = (Math.round((i + 1) * p.ticks / p.frames) - Math.round(i * p.ticks / p.frames)) * 10;
        encoder.writeFrame(indexed, p.width, p.height, {palette, delay, repeat: 0});
        if (encoder.bytesView().length > LIMIT) throw Error('GIF 超过 40 MB 复制限制');
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      encoder.finish(); return {blob: new Blob([encoder.bytes()], {type: 'image/gif'}), width: p.width, height: p.height, original: false};
    } finally { video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(source); }
  }
  globalThis.XIFGIF = {convert};
})();
