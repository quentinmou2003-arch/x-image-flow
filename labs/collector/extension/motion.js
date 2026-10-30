(() => {
  'use strict';
  function url(value) {
    const u = new URL(value);
    const video = u.origin === 'https://video.twimg.com' && /\.mp4$/i.test(u.pathname);
    const gif = u.origin === 'https://pbs.twimg.com' && /^\/media\/[\w.-]+$/.test(u.pathname) && (/\.gif$/i.test(u.pathname) || u.searchParams.get('format') === 'gif');
    if (u.username || u.password || (!video && !gif)) throw Error('未取得可复制的 X 动图地址，请先播放一次再试');
    if (gif) u.searchParams.set('name', 'orig');
    return u.href;
  }
  function isGIF(im) { return !!im && (im.gif === true || (im.type !== 'video' && /(?:\.gif(?:\?|$)|[?&]format=gif(?:&|$))/i.test(im.url || ''))); }
  function plan(width, height, duration) {
    if (![width, height, duration].every(Number.isFinite) || width < 1 || height < 1 || duration < .02 || duration > 120) throw Error('动图时长或尺寸超出范围，支持完整复制 2 分钟以内动图');
    const ticks = Math.max(4, Math.round(duration * 100));
    const frames = Math.max(2, Math.min(Math.ceil(duration * 12), Math.floor(ticks / 2)));
    const scale = Math.min(1, 640 / Math.max(width, height), Math.sqrt(80000000 / (width * height * frames)));
    return {width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), frames, ticks};
  }
  globalThis.XIFMotion = {url, isGIF, plan};
  if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.XIFMotion;
})();
