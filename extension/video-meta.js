(function(scope) {
  'use strict';
  function videoURL(value) {
    try { const u = new URL(value); return u.origin === 'https://video.twimg.com' && !u.username && !u.password && /\.mp4$/i.test(u.pathname) ? u.href : ''; } catch { return ''; }
  }
  function posterURL(value) {
    try { const u = new URL(value); return u.origin === 'https://pbs.twimg.com' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
  }
  function variants(values) {
    const unique = new Map();
    for (const v of Array.isArray(values) ? values.slice(0, 20) : []) {
      const url = videoURL(v.url); if (!url) continue;
      const dimensions = new URL(url).pathname.match(/\/(\d+)x(\d+)\//);
      unique.set(url, {url, bitrate: Math.max(0, Number(v.bitrate) || 0), width: Number(dimensions?.[1]) || 0, height: Number(dimensions?.[2]) || 0});
    }
    return [...unique.values()].sort((a, b) => (a.bitrate || a.width * a.height || Infinity) - (b.bitrate || b.width * b.height || Infinity));
  }
  function extract(json) {
    const records = new Map(), stack = [{value: json, depth: 0}]; let steps = 0;
    while (stack.length && steps++ < 40000) {
      const {value, depth} = stack.pop(); if (!value || typeof value !== 'object' || depth > 35) continue;
      const legacy = value.legacy || value, id = String(legacy.id_str || value.rest_id || '');
      if (/^\d+$/.test(id) && (Array.isArray(legacy.extended_entities?.media) || Number.isSafeInteger(legacy.favorite_count) || Number.isSafeInteger(legacy.bookmark_count))) {
        const media = (legacy.extended_entities?.media || []).slice(0, 4).flatMap((m, index) => {
          if (!['video', 'animated_gif'].includes(m.type)) return [];
          const sources = variants(m.video_info?.variants), ratio = m.video_info?.aspect_ratio;
          return [{key: String(m.media_key || m.id_str || index), type: 'video', gif: m.type === 'animated_gif', poster: posterURL(m.media_url_https), variants: sources, width: Math.max(1, Number(m.original_info?.width || ratio?.[0] || 16)), height: Math.max(1, Number(m.original_info?.height || ratio?.[1] || 9)), order: index + 1}];
        });
        const counts = {};
        for (const [key, field] of [['like', 'favorite_count'], ['bookmark', 'bookmark_count']]) if (Number.isSafeInteger(legacy[field]) && legacy[field] >= 0) counts[key] = legacy[field];
        if (media.length || Object.keys(counts).length) records.set(id, {id, media, counts});
      }
      for (const child of Object.values(value)) if (child && typeof child === 'object') stack.push({value: child, depth: depth + 1});
    }
    return [...records.values()];
  }
  scope.XIFVideo = {videoURL, posterURL, variants, extract};
  if (typeof module !== 'undefined') module.exports = scope.XIFVideo;
})(globalThis);
