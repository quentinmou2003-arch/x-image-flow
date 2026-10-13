/* Pure helpers shared by the gallery, image processor and tests. */
(function (scope) {
  'use strict';
  function mediaURL(value, size = 'orig') {
    const u = new URL(value);
    if (u.origin !== 'https://pbs.twimg.com' || !/^\/media\/[\w.-]+$/.test(u.pathname) || u.username || u.password) throw Error('仅支持 X 推文图片');
    u.searchParams.set('name', size); return u.href;
  }
  function status(value) {
    try {
      const u = new URL(value, 'https://x.com');
      if (!['https://x.com', 'https://twitter.com'].includes(u.origin)) return null;
      const match = u.pathname.match(/^\/(?:[\w]+|i\/web)\/status\/(\d+)(?:\/|$)/);
      return match ? {id: match[1], href: `https://x.com/i/web/status/${match[1]}`} : null;
    } catch { return null; }
  }
  function geometry(sizes, mode) {
    if (sizes.length < 2 || sizes.length > 4) throw Error('拼接支持 2–4 张图片');
    if (sizes.some(s => !Number.isInteger(s.width) || !Number.isInteger(s.height) || s.width < 1 || s.height < 1)) throw Error('图片尺寸无效');
    let width, height, cells;
    if (mode === 'horizontal') {
      width = sizes.reduce((v, s) => v + s.width, 0); height = Math.max(...sizes.map(s => s.height));
      let x = 0; cells = sizes.map(s => { const c = {x, y: 0, width: s.width, height: s.height}; x += s.width; return c; });
    } else if (mode === 'vertical') {
      width = Math.max(...sizes.map(s => s.width)); height = sizes.reduce((v, s) => v + s.height, 0);
      let y = 0; cells = sizes.map(s => { const c = {x: 0, y, width: s.width, height: s.height}; y += s.height; return c; });
    } else if (mode === 'grid' && sizes.length === 4) {
      const left = Math.max(sizes[0].width, sizes[2].width), right = Math.max(sizes[1].width, sizes[3].width);
      const top = Math.max(sizes[0].height, sizes[1].height), bottom = Math.max(sizes[2].height, sizes[3].height);
      width = left + right; height = top + bottom;
      cells = sizes.map((s, i) => ({x: i % 2 ? left : 0, y: i > 1 ? top : 0, width: s.width, height: s.height}));
    } else throw Error('不支持的拼接布局');
    if (width > 32767 || height > 32767 || width * height > 80000000) throw Error('拼接尺寸过大，请减少图片数量');
    return {width, height, cells};
  }
  function permutations(a) { return a.length ? a.flatMap((x, i) => permutations(a.filter((_, j) => j !== i)).map(rest => [x, ...rest])) : [[]]; }
  // Edge continuity is a suggestion, never an automatic edit.
  function seam(a, b, horizontal) {
    const n = 64; let error = 0, energy = 0;
    const lengthA = horizontal ? a.height : a.width, lengthB = horizontal ? b.height : b.width;
    const pixel = (im, end, t, depth) => {
      const x = horizontal ? (end ? im.width - 1 - depth : depth) : Math.round(t * (im.width - 1));
      const y = horizontal ? Math.round(t * (im.height - 1)) : (end ? im.height - 1 - depth : depth);
      return (y * im.width + x) * 4;
    };
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), ae = pixel(a, true, t, 0), be = pixel(b, false, t, 0);
      const ai = pixel(a, true, t, 1), bi = pixel(b, false, t, 1);
      for (let c = 0; c < 3; c++) {
        const va = a.data[ae + c], vb = b.data[be + c];
        error += Math.abs(va - vb) + .25 * Math.abs((va - a.data[ai + c]) - (b.data[bi + c] - vb));
        if (i) energy += Math.abs(va - a.data[pixel(a, true, (i - 1) / (n - 1), 0) + c]);
      }
    }
    return {cost: error / (n * 3 * 255) + Math.abs(lengthA - lengthB) / Math.max(lengthA, lengthB) * .2, energy: energy / (n * 3 * 255)};
  }
  function detect(images) {
    if (images.length < 2 || images.length > 4) throw Error('检测支持 2–4 张图片');
    const candidates = [], memo = new Map();
    function edge(a, b, horizontal) {
      const key = `${a}:${b}:${horizontal}`;
      if (!memo.has(key)) memo.set(key, seam(images[a], images[b], horizontal)); return memo.get(key);
    }
    for (const order of permutations(images.map((_, i) => i))) {
      for (const mode of ['horizontal', 'vertical', ...(images.length === 4 ? ['grid'] : [])]) {
        const edges = mode === 'grid'
          ? [edge(order[0], order[1], true), edge(order[2], order[3], true), edge(order[0], order[2], false), edge(order[1], order[3], false)]
          : order.slice(1).map((id, i) => edge(order[i], id, mode === 'horizontal'));
        candidates.push({mode, order, cost: edges.reduce((v, e) => v + e.cost, 0) / edges.length, energy: edges.reduce((v, e) => v + e.energy, 0) / edges.length});
      }
    }
    candidates.sort((a, b) => a.cost - b.cost);
    const best = candidates[0], gap = candidates[1].cost - best.cost;
    return {...best, suggested: best.cost < .085 && gap > .012 && best.energy > .005, gap};
  }
  const api = {mediaURL, status, geometry, detect}; scope.XIF = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
