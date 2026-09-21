/* Translation-only registration. No image generation or content reconstruction. */
(function(scope) {
  'use strict';
  const axis = (im, horizontal) => horizontal ? [im.width, im.height] : [im.height, im.width];
  // shift is the position of B relative to A, never a sampling-coordinate shift.
  function score(a, b, horizontal, overlap, shift, dense = false) {
    const [aw, ah] = axis(a, horizontal), [bw, bh] = axis(b, horizontal);
    if (overlap < 0 || overlap >= Math.min(aw, bw)) return {error: Infinity, texture: 0};
    const lo = Math.max(0, shift), hi = Math.min(ah, bh + shift) - 2;
    if (hi - lo < Math.min(ah, bh) * .65) return {error: Infinity, texture: 0};
    const rows = Math.min(dense ? 112 : 56, hi - lo + 1), cols = overlap ? Math.min(dense ? 16 : 7, overlap) : 1;
    let error = 0, n = 0, sum = 0, sq = 0;
    function offset(im, p, q) {
      const x = horizontal ? p : q, y = horizontal ? q : p;
      const xx = x - (im.x0 || 0), yy = y - (im.y0 || 0);
      if (xx < 0 || yy < 0 || xx >= (im.dataWidth || im.width) || yy >= (im.dataHeight || im.height)) return -1;
      return (yy * (im.dataWidth || im.width) + xx) * 4;
    }
    for (let j = 0; j < rows; j++) {
      const y = Math.round(lo + j * (hi - lo) / Math.max(1, rows - 1));
      for (let i = 0; i < cols; i++) {
        const x = cols === 1 ? 0 : Math.round(i * (overlap - 1) / (cols - 1));
        const ap = overlap ? aw - overlap + x : aw - 1, bp = overlap ? x : 0;
        const ai = offset(a, ap, y), bi = offset(b, bp, y - shift), an = offset(a, ap, y + 1), bn = offset(b, bp, y - shift + 1);
        if (Math.min(ai, bi, an, bn) < 0 || a.data[ai + 3] < 240 || b.data[bi + 3] < 240) continue;
        for (let c = 0; c < 3; c++) {
          const av = a.data[ai + c], bv = b.data[bi + c];
          error += Math.abs(av - bv) + .5 * Math.abs((a.data[an + c] - av) - (b.data[bn + c] - bv));
          sum += av; sq += av * av; n++;
        }
      }
    }
    if (n < rows * cols) return {error: Infinity, texture: 0};
    return {error: error / (n * 1.5), texture: Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2))};
  }
  function search(a, b, horizontal, bounds, step, dense = false) {
    let best = {overlap: 0, shift: 0, error: Infinity, texture: 0};
    for (let overlap = bounds.o0; overlap <= bounds.o1; overlap += step) {
      // 1-pixel 'overlaps' cannot reliably be distinguished from adjacent cuts.
      if (overlap > 0 && overlap < 3) continue;
      for (let shift = bounds.s0; shift <= bounds.s1; shift += step) {
        const s = score(a, b, horizontal, overlap, shift, dense);
        const rank = s.error + overlap * .003 + Math.abs(shift) * .002;
        const old = best.error + best.overlap * .003 + Math.abs(best.shift) * .002;
        if (rank < old) best = {overlap, shift, ...s};
      }
    }
    return best;
  }
  function accept(best, baseline) {
    const changed = best.overlap >= 3 || Math.abs(best.shift) >= 2;
    return changed && best.texture >= 10 && best.error < 9 && best.error < baseline.error * .6 && baseline.error - best.error > 1.1;
  }
  function match(a, b, mode) {
    const horizontal = mode === 'horizontal';
    if (!horizontal && mode !== 'vertical') throw Error('对齐方向无效');
    const [aw, ah] = axis(a, horizontal), [bw, bh] = axis(b, horizontal);
    const maxO = Math.max(0, Math.min(180, Math.floor(Math.min(aw, bw) * .35))), maxS = Math.min(64, Math.floor(Math.min(ah, bh) * .12));
    const baseline = score(a, b, horizontal, 0, 0, true), step = 3;
    // Include shift=0 explicitly; do not depend on a grid happening to hit it.
    let best = search(a, b, horizontal, {o0: 0, o1: maxO, s0: -maxS, s1: maxS}, step);
    const zero = search(a, b, horizontal, {o0: 0, o1: maxO, s0: 0, s1: 0}, step);
    if (zero.error < best.error) best = zero;
    best = search(a, b, horizontal, {o0: Math.max(0, best.overlap - step), o1: Math.min(maxO, best.overlap + step), s0: Math.max(-maxS, best.shift - step), s1: Math.min(maxS, best.shift + step)}, 1, true);
    return {...best, baseline: baseline.error, accepted: accept(best, baseline)};
  }
  // Refine a coarse match against original-resolution edge strips.
  function refine(a, b, mode, initial, radius) {
    const horizontal = mode === 'horizontal', [aw] = axis(a, horizontal), [bw] = axis(b, horizontal);
    const baseline = score(a, b, horizontal, 0, 0, true), span = Math.max(2, Math.ceil(radius));
    const bounds = {o0: Math.max(0, initial.overlap - span), o1: Math.min(Math.min(aw, bw) - 1, initial.overlap + span), s0: initial.shift - span, s1: initial.shift + span};
    const step = Math.max(1, Math.ceil(span / 8));
    let best = search(a, b, horizontal, bounds, step, true);
    best = search(a, b, horizontal, {o0: Math.max(bounds.o0, best.overlap - step), o1: Math.min(bounds.o1, best.overlap + step), s0: best.shift - step, s1: best.shift + step}, 1, true);
    return {...best, baseline: baseline.error, accepted: accept(best, baseline)};
  }
  function layout(sizes, mode, seams) {
    if (mode !== 'horizontal' && mode !== 'vertical') return scope.XIF.geometry(sizes, mode);
    const cells = [{x: 0, y: 0, width: sizes[0].width, height: sizes[0].height}];
    for (let i = 1; i < sizes.length; i++) {
      const s = seams[i - 1] || {}, overlap = Math.round(s.overlap || 0), shift = Math.round(s.shift || 0), previous = cells[i - 1];
      const maximum = Math.min(...[sizes[i - 1], sizes[i]].map(im => mode === 'horizontal' ? im.width : im.height));
      if (overlap < 0 || overlap >= maximum || Math.abs(shift) > 32767) throw Error('接缝参数超出图片范围');
      cells.push({x: mode === 'horizontal' ? previous.x + previous.width - overlap : previous.x + shift, y: mode === 'vertical' ? previous.y + previous.height - overlap : previous.y + shift, width: sizes[i].width, height: sizes[i].height});
    }
    const minX = Math.min(...cells.map(c => c.x)), minY = Math.min(...cells.map(c => c.y));
    cells.forEach(c => { c.x -= minX; c.y -= minY; });
    const width = Math.max(...cells.map(c => c.x + c.width)), height = Math.max(...cells.map(c => c.y + c.height));
    if (width > 32767 || height > 32767 || width * height > 80000000) throw Error('拼接尺寸过大');
    return {width, height, cells, seams};
  }
  scope.XIFStitch = {score, match, refine, layout};
  if (typeof module !== 'undefined') module.exports = scope.XIFStitch;
})(globalThis);
