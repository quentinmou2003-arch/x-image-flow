(() => {
  'use strict';
  if (document.getElementById('x-image-flow')) return;
  const host = document.createElement('div'); host.id = 'x-image-flow';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none';
  document.documentElement.append(host);
  const root = host.attachShadow({mode: 'open'}), $ = s => root.querySelector(s);
  const icons = {
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4Z"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/>',
    stitch: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16m-3-7h6"/>'
  };
  const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
  root.innerHTML = `<style>.hidden{display:none!important}</style><link rel="stylesheet" href="${chrome.runtime.getURL('ui.css')}">
    <button class="launch primary">▦ 拾图 · 图片与视频</button>
    <section class="panel hidden" aria-label="拾图图片与视频浏览器">
      <header><div><div class="brand"><span class="brand-mark">▦</span>拾图</div><div class="sub">X IMAGE FLOW / 02.3.1</div></div>
        <div class="tools"><button class="selection" disabled>拼接选中图片</button><button class="speed" title="提前加载下一屏；悬停时预取原图" aria-pressed="true">ϟ 极速预取</button><select class="density" aria-label="图片密度"><option value="320">舒适</option><option value="230">紧凑</option><option value="440">大图</option></select><button class="helpbtn">发到 QQ</button><button class="close">返回 X ↗</button></div>
      </header><div class="feedbar hidden"><span class="feedlabel">主页来源</span><div class="feedgroup"><button data-feed="for-you">为你推荐</button><button data-feed="following">正在关注</button></div><span class="feedstatus">图库保持打开，已收集内容自动合并</span></div>
      <nav class="tabs" aria-label="内容筛选"><button class="tab active" data-filter="all">全部</button><button class="tab" data-filter="image">图片</button><button class="tab" data-filter="video">视频</button><button class="tab" data-filter="like">喜欢</button><button class="tab" data-filter="bookmark">书签</button><span class="tabnote">视频默认低清 · 喜欢 / 书签同步到 X</span></nav>
      <div class="help hidden">复制 PNG → 在电脑 QQ 的手机会话中 Ctrl+V 发送。需要保留文件：保存 PNG 后作为文件发送。<br>同一推文的图片叠成卡牌，左右切换；点击「拼接」合成整张图。左上角勾选支持跨推文拼接 2–4 张。</div>
      <main class="scroll"><div class="intro"><div><b>让美图，连成一片。</b><span class="count">0 组 · 0 张</span></div><span class="hint">轻量图片预览 · 视频点击播放 · 一键收藏</span></div><div class="grid"></div><div class="empty"><b>图片与视频，都在这里。</b><span>等待 X 推文载入，或点击下方继续加载。<br>敏感内容需返回 X 手动展开。</span></div><button class="more">继续加载内容 ↓</button><div class="foot">视频先加载封面，点击后低清播放 · 图片导出保留原尺寸</div></main>
    </section>
    <section class="viewer hidden" role="dialog" aria-modal="true" aria-label="图片预览"><div class="modalhead"><b class="viewtitle">图片预览</b><span class="viewcount muted"></span><button class="dismiss">关闭 ×</button></div><div class="viewstage"><button class="viewprev" aria-label="上一张">‹</button><img alt="图片放大预览"><button class="viewnext" aria-label="下一张">›</button></div><div class="thumbs"></div><div class="viewfoot"><button class="viewcopy primary">复制 PNG</button><button class="viewsave">保存 PNG</button><button class="viewstitch">拼接这组</button></div></section>
    <section class="stitcher hidden" role="dialog" aria-modal="true" aria-label="图片拼接"><div class="modalhead"><b>图片拼接</b><span class="muted">拼回完整画面</span><button class="dismiss">关闭 ×</button></div><div class="stitchbody"><aside class="stitchside"><h3>拼接方向</h3><div class="modegroup"><button data-mode="horizontal" class="active">横向</button><button data-mode="vertical">纵向</button><button data-mode="grid">四宫格</button></div><label class="blend"><input type="checkbox" checked> 自动匹配重叠与偏移</label><h3>图片顺序</h3><div class="order"></div><p class="detectnote">正在比较图片边缘…</p><button class="redetect">重新智能排序</button><h3>接缝微调 · 原图像素</h3><div class="seamcontrols"></div><p class="alignmentnote"></p><p class="limitnote">重叠可去掉重复部分；横拼偏移调整上下，竖拼偏移调整左右。正数向下／向右。原切片若缺失内容，拼接无法还原；不会用模糊掩盖断线。</p></aside><div class="stitchstage"><div class="canvaswrap"><img class="stitched hidden" alt="拼接预览"><span class="previewstatus">准备预览…</span></div><div class="stitchfoot"><small>PNG · 原尺寸 · 无额外有损压缩</small><button class="stitchcopy primary" disabled>复制拼接 PNG</button><button class="stitchsave" disabled>保存拼接 PNG</button></div></div></div></section>
    <section class="videoviewer hidden" role="dialog" aria-modal="true" aria-label="视频播放器"><div class="modalhead"><b class="videotitle">视频预览</b><select class="videoquality" aria-label="视频清晰度"></select><button class="dismiss">关闭 ×</button></div><div class="videostage"><video class="player" controls playsinline preload="none"></video><p class="videostatus" role="status">准备播放…</p></div><div class="viewfoot"><span class="muted">默认最低码率，清晰度可切换</span><a class="videoorigin" target="_blank" rel="noopener noreferrer">打开原推文 ↗</a></div></section>
    <div class="toast hidden" role="status" aria-live="polite"></div>`;
  const groups = new Map(), selected = new Map(), videoMetadata = new Map(), tweetCounts = new Map();
  let open = false, density = 320, fast = true, filter = 'all', columns = [], heights = [], route = location.href, feedSwitching = false;
  let scanTimer = 0, toastTimer, rebalanceTimer, lastGalleryScroll = 0, loading = false, noMore = false, revision = 0, nativeBusy = 0, viewGroup = null, stitchSession = null, focusBefore, videoSession = null;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const message = async data => { const r = await chrome.runtime.sendMessage({target: 'worker', ...data}); if (!r?.ok) throw Error(r?.error || '扩展未响应，请刷新页面'); return r; };
  function toast(text) { $('.toast').textContent = text; $('.toast').classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('.toast').classList.add('hidden'), 5500); }
  function button(label, className, title) { const b = document.createElement('button'); b.className = className; b.textContent = label; if (title) b.title = title; return b; }
  function postOf(article) { return XIF.status(article.querySelector('a[href*="/status/"] time')?.closest('a')?.href || article.querySelector('a[href*="/status/"]')?.href); }
  function authorURL(article, post, mainPost) {
    for (const link of article.querySelectorAll('a[href*="/status/"]')) {
      const url = new URL(link.href), match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)(?:\/|$)/);
      if (['https://x.com', 'https://twitter.com'].includes(url.origin) && match?.[2] === post.id) return `https://x.com/${match[1]}`;
    }
    if (post.id === mainPost.id) for (const link of article.querySelectorAll('[data-testid="User-Name"] a[href]')) {
      const url = new URL(link.href);
      if (['https://x.com', 'https://twitter.com'].includes(url.origin) && /^\/[A-Za-z0-9_]{1,15}\/?$/.test(url.pathname)) return `https://x.com${url.pathname}`;
    }
    return '';
  }
  function quotedAuthor(article, post) {
    const handle = [...article.querySelectorAll('a[href*="/status/"]')].map(a => new URL(a.href).pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)(?:\/|$)/)).find(match => match?.[2] === post.id)?.[1];
    if (!handle) return '引用 · 作者未识别';
    const name = [...article.querySelectorAll('[data-testid="User-Name"]')].find(el =>
      [...el.querySelectorAll('a[href]')].some(a => new URL(a.href).pathname.toLowerCase().replace(/\/$/, '') === `/${handle.toLowerCase()}`));
    const label = name?.textContent?.split('·')[0]?.trim().slice(0, 65);
    return `引用 · ${label ? (label.toLowerCase().includes(`@${handle.toLowerCase()}`) ? label : `${label} @${handle}`) : `@${handle}`}`;
  }
  function findArticle(id) { return [...document.querySelectorAll('article[data-testid="tweet"]')].find(a => postOf(a)?.id === id); }
  function nativeControl(article, kind) {
    if (!article) return null;
    const off = kind === 'like' ? 'like' : 'bookmark', on = kind === 'like' ? 'unlike' : 'removeBookmark';
    const el = article.querySelector(`[data-testid="${on}"], [data-testid="${off}"]`);
    return el ? {el, on: el.dataset.testid === on} : null;
  }
  async function nativeAction(id, kind, desired) {
    if (!/^\d+$/.test(id) || !['like', 'bookmark'].includes(kind) || typeof desired !== 'boolean') return {ok: false, error: '无效的推文操作'};
    const control = nativeControl(findArticle(id), kind);
    if (!control) return {ok: false, error: 'X 按钮尚未载入，请打开原推文重试'};
    if (control.on === desired) return {ok: true, state: desired};
    nativeBusy++;
    try {
      control.el.click();
      let stable = 0;
      for (let i = 0; i < 32; i++) {
        await wait(100); const actual = nativeControl(findArticle(id), kind);
        if (actual?.on === desired) { if (++stable >= 7) return {ok: true, state: desired}; } else stable = 0;
      }
      return {ok: false, error: '未能确认 X 状态，请打开原推文检查后重试'};
    } finally { nativeBusy--; }
  }
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return;
    if (msg.type === 'toggle') toggle();
    if (msg.type === 'native-ready') reply({ready: !!nativeControl(findArticle(msg.id), msg.kind)});
    if (msg.type === 'native-action') { nativeAction(msg.id, msg.kind, msg.desired).then(reply, e => reply({ok: false, error: e.message})); return true; }
  });
  const photosOf = g => g.images.filter(im => im.type !== 'video');
  function visible(g) { return filter === 'all' || (filter === 'video' ? g.images.some(im => im.type === 'video') : filter === 'image' ? photosOf(g).length > 0 : g[filter] === true); }
  function layout(force = false) {
    const width = $('.scroll').clientWidth || innerWidth, n = Math.max(1, Math.floor((width - 40) / (density + 20)));
    if (!force && n === columns.length) return;
    $('.grid').replaceChildren(); $('.grid').style.gridTemplateColumns = `repeat(${n},minmax(0,1fr))`; heights = Array(n).fill(0);
    columns = Array.from({length: n}, () => { const c = document.createElement('div'); c.className = 'column'; $('.grid').append(c); return c; });
    for (const g of groups.values()) if (visible(g)) place(g);
    updateCount(); if (open) requestAnimationFrame(() => { loadViewportCovers(); scheduleRebalance(500); });
  }
  function place(g) { const col = heights.indexOf(Math.min(...heights)); columns[col].append(g.card); const im = g.images[g.index]; heights[col] += density * (im.height / im.width || 1.3) + 135; }
  function loadViewportCovers() {
    if (!open) return; const viewport = $('.scroll').getBoundingClientRect();
    for (const g of groups.values()) {
      if (!visible(g) || !g.card?.isConnected) continue; const rect = g.card.getBoundingClientRect();
      if (rect.bottom >= viewport.top - 1200 && rect.top <= viewport.bottom + 1200) { g.near = true; loadCover(g, rect.bottom >= viewport.top && rect.top <= viewport.bottom); }
    }
  }
  function scheduleRebalance(delay = 420) {
    clearTimeout(rebalanceTimer); rebalanceTimer = setTimeout(() => {
      if (Date.now() - lastGalleryScroll < 280) return scheduleRebalance(320); rebalanceColumns();
    }, delay);
  }
  function rebalanceColumns() {
    if (!open || columns.length < 2 || $('.panel').inert) return;
    const list = [...groups.values()].filter(g => visible(g) && g.card?.isConnected); if (list.length < columns.length + 1) return;
    const oldHeights = columns.map(c => c.scrollHeight), oldSpread = Math.max(...oldHeights) - Math.min(...oldHeights);
    const measured = new Map(list.map(g => [g, Math.max(1, g.card.getBoundingClientRect().height) + 24]));
    const targetHeights = Array(columns.length).fill(0), target = list.map(g => { const col = targetHeights.indexOf(Math.min(...targetHeights)); targetHeights[col] += measured.get(g); return col; });
    const newSpread = Math.max(...targetHeights) - Math.min(...targetHeights);
    if (oldSpread < 140 || newSpread >= oldSpread - 60) return;
    const viewport = $('.scroll').getBoundingClientRect(), anchor = list.map(g => g.card).filter(card => card.getBoundingClientRect().bottom > viewport.top).sort((a, b) => Math.abs(a.getBoundingClientRect().top - viewport.top) - Math.abs(b.getBoundingClientRect().top - viewport.top))[0];
    const anchorTop = anchor?.getBoundingClientRect().top;
    list.forEach((g, i) => columns[target[i]].append(g.card)); heights = targetHeights.slice();
    if (anchor && Number.isFinite(anchorTop)) $('.scroll').scrollTop += anchor.getBoundingClientRect().top - anchorTop;
    requestAnimationFrame(loadViewportCovers);
  }
  function updateCount() {
    const list = [...groups.values()].filter(visible), photos = list.reduce((n, g) => n + photosOf(g).length, 0), videos = list.reduce((n, g) => n + g.images.length - photosOf(g).length, 0);
    $('.count').textContent = `${list.length} 组 · ${photos} 张${videos ? ` · ${videos} 个视频` : ''}`;
    $('.empty').classList.toggle('hidden', list.length > 0);
    $('.empty span').textContent = ['all', 'image', 'video'].includes(filter) ? '等待 X 载入推文，或点击下方继续加载。敏感内容需返回 X 手动展开。' : '当前已收集内容中暂无此项。这里筛选本次信息流，不会导入整个 X 收藏库。';
  }
  function toggle() {
    open = !open; $('.panel').classList.toggle('hidden', !open); $('.launch').classList.toggle('hidden', open);
    closeModal('.viewer'); closeModal('.stitcher'); closeModal('.videoviewer');
    if (open) { document.querySelectorAll('article video').forEach(v => v.pause()); updateFeedBar(); layout(); scan(); requestAnimationFrame(loadViewportCovers); setTimeout(maybeMore, 300); }
  }
  $('.launch').onclick = toggle; $('.close').onclick = toggle; $('.helpbtn').onclick = () => $('.help').classList.toggle('hidden');
  chrome.storage.local.get({density: 320, fast: true}).then(p => { density = [230, 320, 440].includes(p.density) ? p.density : 320; fast = p.fast !== false; $('.density').value = String(density); updateSpeed(); if (open) layout(); }).catch(() => {});
  $('.density').onchange = e => { density = Number(e.target.value); chrome.storage.local.set({density}); layout(true); };
  function updateSpeed() { $('.speed').textContent = fast ? 'ϟ 极速预取' : '按需加载'; $('.speed').setAttribute('aria-pressed', String(fast)); }
  $('.speed').onclick = () => { fast = !fast; updateSpeed(); chrome.storage.local.set({fast}); if (fast) maybeMore(); };
  function openHistory(kind) {
    if (kind === 'bookmark') { navigateHistory('/i/bookmarks'); return; }
    const profile = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
    const url = profile && new URL(profile.getAttribute('href'), location.origin);
    if (!url || url.origin !== location.origin || !/^\/[A-Za-z0-9_]{1,15}\/?$/.test(url.pathname)) {
      toast('暂未识别到当前账号，请等待 X 左侧个人资料入口加载后重试'); return;
    }
    navigateHistory(`${url.pathname.replace(/\/$/, '')}/likes`);
  }
  function navigateHistory(path) {
    if (location.pathname === path) { filter = 'all'; layout(true); updateHistoryTabs(); return; }
    try { sessionStorage.setItem('xif-history-open', JSON.stringify({path, time: Date.now()})); }
    catch { toast('无法保存图库状态，请允许此站点使用本地存储后重试'); return; }
    location.assign(`${location.origin}${path}`);
  }
  function updateHistoryTabs() {
    const history = location.pathname === '/i/bookmarks' ? 'bookmark' : /^\/[A-Za-z0-9_]{1,15}\/likes\/?$/.test(location.pathname) ? 'like' : null;
    root.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.filter === (filter === 'all' && history ? history : filter)));
    $('.intro b').textContent = history === 'bookmark' ? '历史书签' : history === 'like' ? '历史喜欢' : '让美图，连成一片。';
    $('.home-gallery').classList.toggle('hidden', /^\/(home)?\/?$/.test(location.pathname));
    $('.tab[data-filter="all"]').textContent = history ? '本页全部' : '全部';
  }
  const homeGallery = button('← 回首页收新图', 'home-gallery', '返回 X 主页并保持拾图模式');
  homeGallery.onclick = () => navigateHistory('/home');
  $('.intro').prepend(homeGallery);
  root.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    if (['like', 'bookmark'].includes(b.dataset.filter)) { openHistory(b.dataset.filter); return; }
    filter = b.dataset.filter; updateHistoryTabs(); layout(true); $('.scroll').scrollTop = 0;
  });
  $('.tab[data-filter="like"]').title = '打开我的 X 历史喜欢';
  $('.tab[data-filter="bookmark"]').title = '打开我的 X 历史书签';
  const feedNames = { 'for-you': ['为你推荐', 'foryou', 'おすすめ', 'parati', 'pourvous'], following: ['正在关注', '关注中', 'following', 'フォロー中', 'siguiendo', 'abonnements'] };
  function compactLabel(value) { return String(value || '').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ''); }
  function nativeFeedTab(kind) {
    const names = feedNames[kind];
    return [...document.querySelectorAll('[role="tab"]')].find(el => {
      const label = compactLabel(el.getAttribute('aria-label') || el.textContent);
      return names.some(name => label === compactLabel(name) || label.startsWith(compactLabel(name)));
    }) || null;
  }
  function feedSelected(el) { return el?.getAttribute('aria-selected') === 'true' || el?.closest('[aria-selected="true"]') != null; }
  function updateFeedBar(message = '') {
    const home = /^\/(home)?\/?$/.test(location.pathname); $('.feedbar').classList.toggle('hidden', !home); if (!home) return;
    let available = 0;
    for (const kind of ['for-you', 'following']) {
      const button = $(`[data-feed="${kind}"]`), tab = nativeFeedTab(kind); if (tab) available++;
      button.disabled = feedSwitching || !tab; button.classList.toggle('active', feedSelected(tab)); button.setAttribute('aria-pressed', String(feedSelected(tab)));
    }
    $('.feedstatus').textContent = message || (available < 2 ? '正在等待 X 主页标签载入…' : '图库保持打开，两个来源的内容自动合并');
  }
  async function switchFeed(kind) {
    if (feedSwitching) return; const tab = nativeFeedTab(kind);
    if (!tab) { updateFeedBar(); toast(location.pathname.startsWith('/home') ? 'X 主页标签尚未载入，请稍后再点' : '请先打开 X 主页'); return; }
    if (feedSelected(tab)) { updateFeedBar('当前已是这个来源 · 已收集内容仍保留'); return; }
    feedSwitching = true; noMore = false; updateFeedBar(`正在切换到${kind === 'for-you' ? '为你推荐' : '正在关注'}…`); tab.click();
    let selected = false;
    for (let i = 0; i < 40; i++) { await wait(100); selected = feedSelected(nativeFeedTab(kind)); if (selected) break; }
    feedSwitching = false; scan(); updateFeedBar(selected ? `已切换 · 正在收集${kind === 'for-you' ? '为你推荐' : '正在关注'}内容` : 'X 未确认切换，请稍后重试');
    if (selected) { toast(`已切换到${kind === 'for-you' ? '为你推荐' : '正在关注'} · 图库无需关闭`); setTimeout(maybeMore, 250); }
  }
  root.querySelectorAll('[data-feed]').forEach(button => button.onclick = () => switchFeed(button.dataset.feed));
  new ResizeObserver(() => { if (open) layout(); }).observe($('.scroll'));
  const near = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const g = groups.get(entry.target.dataset.key); if (!g) continue; g.near = entry.isIntersecting;
      if (entry.isIntersecting && open) {
        const visibleNow = !!entry.rootBounds && entry.boundingClientRect.bottom >= entry.rootBounds.top && entry.boundingClientRect.top <= entry.rootBounds.bottom;
        loadCover(g, visibleNow); if (photosOf(g).length > 1) scheduleAnalysis(g);
      }
    }
  }, {root: $('.scroll'), rootMargin: '1200px 0px'});
  function loadCover(g, priority = false) {
    const im = g.images[g.index]; if (g.photo.dataset.url === im.preview && g.photo.getAttribute('src')) return;
    g.photo.dataset.url = im.preview || ''; g.photo.classList.remove('error-image'); g.media.classList.add('loading'); g.media.classList.remove('load-error');
    if (im.preview) { g.photo.loading = 'eager'; g.photo.fetchPriority = priority ? 'high' : 'auto'; g.photo.src = im.preview; }
    else { g.photo.removeAttribute('src'); g.media.classList.remove('loading'); g.media.classList.add('load-error'); g.loader.textContent = im.type === 'video' ? '视频封面未载入' : '图片地址不可用'; }
  }
  function updateCard(g) {
    const im = g.images[g.index], isVideo = im.type === 'video'; g.card.classList.toggle('multi', g.images.length > 1); g.card.classList.toggle('video-card', isVideo);
    g.photo.alt = im.alt; g.photo.width = im.width; g.photo.height = im.height;
    g.badge.textContent = `${isVideo ? (im.gif ? 'GIF · ' : '视频 · ') : ''}${g.index + 1} / ${g.images.length}`; g.badge.classList.toggle('hidden', g.images.length < 2 && !isVideo);
    g.prev.classList.toggle('hidden', g.images.length < 2); g.next.classList.toggle('hidden', g.images.length < 2);
    g.dots.replaceChildren(); g.images.forEach((_, i) => { const d = document.createElement('span'); d.className = `dot${i === g.index ? ' active' : ''}`; g.dots.append(d); }); g.dots.classList.toggle('hidden', g.images.length < 2);
    g.pick.classList.toggle('selected', selected.has(im.url)); g.pick.textContent = selected.has(im.url) ? '✓' : '+'; g.pick.setAttribute('aria-pressed', String(selected.has(im.url))); g.pick.classList.toggle('hidden', isVideo);
    g.play.classList.toggle('hidden', !isVideo); g.save.classList.toggle('hidden', isVideo); if (!g.copy.disabled) g.copy.textContent = isVideo ? '▶ 播放视频' : '复制 PNG';
    g.stitch.classList.toggle('hidden', photosOf(g).length < 2); updateSocial(g);
    if (g.photo.dataset.url !== (im.preview || '')) { g.photo.removeAttribute('src'); g.photo.dataset.url = ''; g.media.classList.add('loading'); g.loader.textContent = '正在读取图片…'; }
    if (g.near) loadCover(g, true);
  }
  function updateSocial(g) {
    for (const kind of ['like', 'bookmark']) {
      const b = g[kind + 'Button']; b.classList.toggle('on', g[kind] === true); b.setAttribute('aria-pressed', String(g[kind] === true));
      b.title = `${g[kind] ? '取消' : '添加'} X ${kind === 'like' ? '喜欢' : '书签'}（整条推文）`;
      const count = tweetCounts.get(g.id)?.[kind], label = kind === 'like' ? '喜欢' : '书签';
      let badge = b.querySelector('.tweet-count'); if (!badge) { badge = document.createElement('span'); badge.className = 'tweet-count'; b.append(badge); }
      badge.textContent = Number.isSafeInteger(count) ? (count >= 10000 ? `${Number((count / 10000).toFixed(1))}万` : count.toLocaleString('zh-CN')) : '—';
      badge.title = Number.isSafeInteger(count) ? `${label} ${count.toLocaleString('zh-CN')}` : 'X 暂未返回此推文的数量';
    }
  }
  function turn(g, delta) { g.index = (g.index + delta + g.images.length) % g.images.length; updateCard(g); scheduleRebalance(); if (fast) prefetch(g); }
  function prefetch(g) {
    if (!fast || !open) return;
    const im = g.images[g.index]; if (im.type === 'video') return; if (Date.now() - (im.prefetched || 0) < 120000) return; im.prefetched = Date.now();
    message({action: 'prefetch', urls: [im.url]}).catch(() => { im.prefetched = 0; });
    if (g.images.length > 1) { const next = new Image(); next.src = g.images[(g.index + 1) % g.images.length].preview; }
  }
  function makeCard(g) {
    const card = document.createElement('article'); card.className = 'card'; card.dataset.key = g.id; g.card = card;
    const media = document.createElement('div'); media.className = 'media loading'; g.media = media; const photo = document.createElement('img'); photo.className = 'photo'; photo.decoding = 'async'; photo.loading = 'lazy'; g.photo = photo;
    g.loader = document.createElement('div'); g.loader.className = 'media-loader'; g.loader.textContent = '正在读取图片…';
    photo.onclick = () => g.images[g.index].type === 'video' ? openVideo(g) : openViewer(g); photo.onerror = () => { if (photo.dataset.url !== (g.images[g.index].preview || '')) return; photo.classList.add('error-image'); media.classList.remove('loading'); media.classList.add('load-error'); g.loader.textContent = g.images[g.index].type === 'video' ? '视频封面不可用 · 点击播放' : '图片读取失败 · 点击查看原图'; photo.alt = g.loader.textContent; };
    photo.onload = () => { const im = g.images.find(item => item.preview === photo.dataset.url); if (im) { im.width = photo.naturalWidth; im.height = photo.naturalHeight; } if (photo.dataset.url === (g.images[g.index].preview || '')) { photo.width = photo.naturalWidth; photo.height = photo.naturalHeight; media.classList.remove('loading', 'load-error'); scheduleRebalance(); } };
    g.badge = document.createElement('span'); g.badge.className = 'badge';
    g.prev = button('‹', 'arrow prev', '上一张'); g.next = button('›', 'arrow next', '下一张'); g.prev.onclick = () => turn(g, -1); g.next.onclick = () => turn(g, 1);
    g.dots = document.createElement('div'); g.dots.className = 'dots'; g.pick = button('+', 'pick', '选择当前图片，跨推文拼接');
    g.pick.onclick = () => { const im = g.images[g.index]; if (im.type === 'video') return; if (selected.has(im.url)) selected.delete(im.url); else if (selected.size < 4) selected.set(im.url, {...im}); else { toast('最多选择 4 张图片'); return; } updateSelection(); };
    g.play = button('▶', 'video-play', '播放低清视频'); g.play.onclick = () => openVideo(g);
    media.append(photo, g.loader, g.badge, g.prev, g.next, g.dots, g.pick, g.play);
    const meta = document.createElement('div'); meta.className = 'meta'; const author = document.createElement('a'); author.className = 'author'; author.textContent = g.author; author.target = '_blank'; author.rel = 'noopener noreferrer'; if (g.authorURL) { author.href = g.authorURL; author.title = `打开 ${g.author} 的主页`; }
    const source = document.createElement('a'); source.className = 'source'; source.href = g.href; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = '原推文 ↗'; meta.append(author, source);
    const social = document.createElement('div'); social.className = 'social';
    g.likeButton = button('', 'like'); g.likeButton.innerHTML = `${svg('heart')}<span>喜欢</span>`;
    g.bookmarkButton = button('', 'bookmark'); g.bookmarkButton.innerHTML = `${svg('bookmark')}<span>书签</span>`;
    g.likeButton.onclick = () => socialAction(g, 'like'); g.bookmarkButton.onclick = () => socialAction(g, 'bookmark');
    g.stitch = button('', 'stitch', '检测并拼接这组图片'); g.stitch.innerHTML = `${svg('stitch')}<span>拼接</span>`; g.stitch.onclick = () => openStitch(photosOf(g), g.suggestion);
    social.append(g.likeButton, g.bookmarkButton, g.stitch);
    const actions = document.createElement('div'); actions.className = 'actions'; const copy = button('复制 PNG', 'copy primary'); const save = button('', 'save', '保存当前图片 PNG'); save.innerHTML = svg('download'); save.setAttribute('aria-label', '保存 PNG');
    g.copy = copy; g.save = save;
    copy.onclick = () => g.images[g.index].type === 'video' ? openVideo(g) : act(copy, 'copy', [g.images[g.index].url]); save.onclick = () => { if (g.images[g.index].type !== 'video') act(save, 'download', [g.images[g.index].url]); }; actions.append(copy, save);
    card.append(media, meta, social, actions);
    let hover; card.onpointerenter = () => { hover = setTimeout(() => prefetch(g), 180); }; card.onpointerleave = () => clearTimeout(hover);
    // Native lazy loading and the near-viewport observer keep distant covers light.
    const im = g.images[0]; photo.width = im.width; photo.height = im.height; photo.alt = im.alt;
    updateCard(g); near.observe(card); return card;
  }
  function updateSelection() { for (const g of groups.values()) { const yes = selected.has(g.images[g.index].url); g.pick.classList.toggle('selected', yes); g.pick.textContent = yes ? '✓' : '+'; g.pick.setAttribute('aria-pressed', String(yes)); } $('.selection').disabled = selected.size < 1; $('.selection').textContent = `拼接已选 ${selected.size} 张`; }
  $('.selection').onclick = () => { if (selected.size < 2) toast('再选择一张图片即可拼接'); else openStitch([...selected.values()]); };
  async function socialAction(g, kind) {
    if (g.busy) return; g.busy = true; g.likeButton.disabled = g.bookmarkButton.disabled = true;
    try {
      const local = nativeControl(findArticle(g.id), kind); if (local) g[kind] = local.on;
      const desired = g[kind] !== true;
      const previousState = g[kind], previousCount = tweetCounts.get(g.id)?.[kind];
      const result = local ? await nativeAction(g.id, kind, desired) : await message({action: 'tweet-action', href: g.href, kind, desired});
      if (!result.ok) throw Error(result.error);
      const counts = tweetCounts.get(g.id); if (counts && Number.isSafeInteger(previousCount) && counts[kind] === previousCount && previousState !== result.state) counts[kind] = Math.max(0, previousCount + (result.state ? 1 : -1));
      g[kind] = result.state; updateSocial(g); if (filter !== 'all') layout(true);
      toast(`${kind === 'like' ? (desired ? '已喜欢' : '已取消喜欢') : (desired ? '已添加书签' : '已取消书签')} · X 推文状态已更新`);
    } catch (e) { toast(e.message); }
    finally { g.busy = false; g.likeButton.disabled = g.bookmarkButton.disabled = false; }
  }
  async function act(b, action, urls, mode, blend, seams) {
    if (b.disabled) return; const label = b.innerHTML; b.disabled = true; b.textContent = '处理中…';
    try {
      const r = action === 'copy'
        ? await XIFClipboard.copy(JSON.stringify({urls, mode, blend, seams}), () => message({action, urls, mode, blend, seams}))
        : await message({action, urls, mode, blend, seams});
      toast(action === 'copy' ? `已复制 PNG · ${r.width} × ${r.height}，可到 QQ 粘贴` : `保存 PNG · ${r.width} × ${r.height}`);
    }
    catch (e) { toast(`操作失败：${e.message}`); } finally { b.disabled = false; b.innerHTML = label; }
  }
  const analysisQueue = []; let analyzing = 0;
  function scheduleAnalysis(g) { const urls = photosOf(g).map(im => im.url); if (g.analysisKey === urls.join('|')) return; g.analysisKey = urls.join('|'); analysisQueue.push({g, key: g.analysisKey, urls}); pumpAnalysis(); }
  function pumpAnalysis() {
    while (open && analyzing < 2 && analysisQueue.length) {
      const {g, key, urls} = analysisQueue.shift(); analyzing++;
      message({action: 'analyze', urls}).then(r => { if (g.analysisKey !== key) return; g.suggestion = r.suggestion; g.stitch.classList.toggle('suggested', r.suggestion.suggested); g.stitch.querySelector('span').textContent = r.suggestion.suggested ? '疑似切片' : '拼接'; g.stitch.title = r.suggestion.suggested ? '边缘连续，点击预览拼接' : '手动拼接这组图片'; }).catch(() => { g.analysisKey = null; }).finally(() => { analyzing--; pumpAnalysis(); });
    }
  }
  function mediaKey(im) { return `${im.type === 'video' ? 'video' : 'image'}:${im.preview ? new URL(im.preview).pathname : im.key || im.order}`; }
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'xif-video-v1' || !Array.isArray(event.data.records)) return;
    for (const record of event.data.records.slice(0, 100)) {
      if (!record || !/^\d+$/.test(record.id) || !Array.isArray(record.media)) continue;
      const counts = {...tweetCounts.get(record.id)};
      for (const kind of ['like', 'bookmark']) if (Number.isSafeInteger(record.counts?.[kind]) && record.counts[kind] >= 0) counts[kind] = record.counts[kind];
      tweetCounts.delete(record.id); tweetCounts.set(record.id, counts);
      const existing = groups.get(record.id); if (existing) updateSocial(existing);
      const media = record.media.slice(0, 4).filter(m => m && m.type === 'video').map((m, i) => ({type: 'video', key: String(m.key || i).slice(0, 80), gif: m.gif === true, poster: XIFVideo.posterURL(m.poster), variants: XIFVideo.variants(m.variants), width: Math.min(32767, Math.max(1, Number(m.width) || 16)), height: Math.min(32767, Math.max(1, Number(m.height) || 9)), order: Math.min(4, Math.max(1, Number(m.order) || i + 1))}));
      if (media.length) { videoMetadata.delete(record.id); videoMetadata.set(record.id, media); }
    }
    while (videoMetadata.size > 600) videoMetadata.delete(videoMetadata.keys().next().value);
    while (tweetCounts.size > 600) tweetCounts.delete(tweetCounts.keys().next().value);
    scheduleScan();
  });
  window.postMessage({channel: 'xif-video-request'}, location.origin);
  // Pause the hidden X players; our modal is the only player the user sees.
  document.addEventListener('play', event => { if (open && event.target instanceof HTMLVideoElement && event.target.closest('article')) event.target.pause(); }, true);
  function collectVideos(article, mainPost, found) {
    let containers = [...article.querySelectorAll('[data-testid="videoPlayer"]')];
    if (!containers.length) containers = [...article.querySelectorAll('[data-testid="videoComponent"]')];
    if (!containers.length) containers = [...article.querySelectorAll('video')];
    containers.forEach((container, index) => {
      if (container.closest('article[data-testid="tweet"]') !== article) return;
      const native = container.tagName === 'VIDEO' ? container : container.querySelector('video');
      const poster = XIFVideo.posterURL(native?.poster || container.querySelector('img')?.src);
      let post = XIF.status(container.closest('a[href*="/status/"]')?.href) || mainPost;
      if (poster) {
        const posterPath = new URL(poster).pathname;
        for (const [id, entries] of videoMetadata) if (entries.some(m => m.poster && new URL(m.poster).pathname === posterPath)) { post = {id, href: `https://x.com/i/web/status/${id}`}; break; }
      }
      const entries = videoMetadata.get(post.id) || [];
      const meta = entries.find(m => poster && m.poster && new URL(m.poster).pathname === new URL(poster).pathname) || entries[index];
      const direct = [native?.currentSrc, native?.src, ...[...(native?.querySelectorAll('source') || [])].map(s => s.src)].map(url => ({url}));
      const variants = XIFVideo.variants([...(meta?.variants || []), ...direct]);
      const preview = meta?.poster || poster;
      if (!found.has(post.id)) found.set(post.id, {post, images: []});
      const item = {type: 'video', key: meta?.key || String(index), gif: meta?.gif || false, url: variants[0]?.url || '', variants, preview, alt: meta?.gif ? 'GIF 动图' : '推文视频', width: meta?.width || native?.videoWidth || 640, height: meta?.height || native?.videoHeight || 360, order: meta?.order || Number(container.closest('a')?.href?.match(/\/video\/(\d+)/)?.[1]) || index + 1};
      const list = found.get(post.id).images; if (!list.some(old => mediaKey(old) === mediaKey(item))) list.push(item);
    });
  }
  function scan() {
    if (!open) return;
    if (route !== location.href) { route = location.href; near.disconnect(); groups.clear(); selected.clear(); analysisQueue.length = 0; noMore = false; layout(true); updateSelection(); $('.scroll').scrollTop = 0; }
    updateFeedBar();
    let changed = false;
    for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
      const mainPost = postOf(article); if (!mainPost) continue;
      const found = new Map();
      for (const img of article.querySelectorAll('[data-testid="tweetPhoto"] img')) {
        if (img.closest('article[data-testid="tweet"]') !== article || img.closest('[data-testid="videoPlayer"], [data-testid="videoComponent"]')) continue;
        let url; try { url = XIF.mediaURL(img.currentSrc || img.src); } catch { continue; }
        const photoLink = img.closest('a[href*="/status/"]'), post = XIF.status(photoLink?.href) || mainPost;
        if (!found.has(post.id)) found.set(post.id, {post, images: []});
        const photos = found.get(post.id).images;
        if (!photos.some(im => new URL(im.url).pathname === new URL(url).pathname)) photos.push({url, preview: XIF.mediaURL(url, 'small'), alt: img.alt || '推文图片', width: img.naturalWidth || 600, height: img.naturalHeight || 800, order: Number(photoLink?.href.match(/\/photo\/(\d+)/)?.[1] || photos.length + 1)});
      }
      collectVideos(article, mainPost, found);
      for (const {post, images} of found.values()) {
        if (!images.length) continue; images.sort((a, b) => a.order - b.order);
        let g = groups.get(post.id);
        if (!g) {
          if (groups.size >= 600) continue;
          g = {id: post.id, href: post.href, images: images.slice(0, 4), index: 0, author: post.id === mainPost.id ? (article.querySelector('[data-testid="User-Name"]')?.textContent?.split('·')[0]?.slice(0, 65) || 'X 图片') : quotedAuthor(article, post)};
          g.authorURL = authorURL(article, post, mainPost);
          if (post.id === mainPost.id) for (const kind of ['like', 'bookmark']) g[kind] = nativeControl(article, kind)?.on;
          groups.set(g.id, g); makeCard(g); if (visible(g)) place(g); changed = true;
        } else {
          const profile = authorURL(article, post, mainPost); if (profile) { g.authorURL = profile; g.card.querySelector('.author').href = profile; }
          if (post.id !== mainPost.id) { g.author = quotedAuthor(article, post); const author = g.card.querySelector('.author'); author.textContent = g.author; author.title = g.author; }
          for (const im of images) {
            const old = g.images.find(old => mediaKey(old) === mediaKey(im)) || (im.type === 'video' ? g.images.find(old => old.type === 'video' && old.order === im.order && (!old.preview || !im.preview)) : null);
            if (!old && g.images.length < 4) { g.images.push(im); changed = true; }
            else if (old && im.type === 'video') { old.variants = im.variants.length ? im.variants : old.variants; old.url = old.variants[0]?.url || ''; old.preview = im.preview || old.preview; old.gif = im.gif; }
          }
          g.images.sort((a, b) => a.order - b.order);
          if (!g.busy && post.id === mainPost.id) for (const kind of ['like', 'bookmark']) { const actual = nativeControl(article, kind); if (actual) { if (g[kind] !== actual.on && filter !== 'all') changed = true; g[kind] = actual.on; } }
          updateCard(g);
        }
      }
    }
    if (changed) { revision++; updateCount(); if (filter !== 'all') layout(true); else scheduleRebalance(); }
  }
  function scheduleScan() { if (!open || scanTimer) return; scanTimer = setTimeout(() => { scanTimer = 0; scan(); }, 80); }
  new MutationObserver(scheduleScan).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'poster', 'data-testid', 'aria-selected']});
  async function more(manual = false) {
    if (loading || !open || feedSwitching || nativeBusy || videoSession || !['all', 'image', 'video'].includes(filter)) return;
    if (manual) noMore = false; if (noMore) return;
    loading = true; $('.more').disabled = true; $('.more').textContent = '正在预取下一屏…';
    const initial = revision, startRoute = location.href;
    for (let i = 0; i < 4 && open && location.href === startRoute && !nativeBusy && !videoSession; i++) {
      const previous = revision; window.scrollBy(0, Math.max(400, window.innerHeight * .8));
      for (let tick = 0; tick < 9; tick++) { await wait(100); if (!open || location.href !== startRoute) break; scan(); if (tick >= 1 && revision > previous) break; }
      if (revision > initial && $('.scroll').scrollHeight - $('.scroll').scrollTop - $('.scroll').clientHeight > $('.scroll').clientHeight * 2) break;
    }
    loading = false; $('.more').disabled = false; $('.more').textContent = '继续加载内容 ↓';
    if (revision === initial) { noMore = true; if (manual) toast(groups.size >= 600 ? '已收集 600 组，可刷新开始新一轮' : '暂未发现新图片，可稍后重试或返回 X 检查'); }
  }
  function maybeMore() { const el = $('.scroll'); if (fast && open && ['all', 'image', 'video'].includes(filter) && el.scrollHeight - el.scrollTop - el.clientHeight < el.clientHeight * 1.8) more(); }
  $('.more').onclick = () => more(true); $('.scroll').addEventListener('scroll', () => { lastGalleryScroll = Date.now(); loadViewportCovers(); maybeMore(); scheduleRebalance(650); }, {passive: true});
  function openModal(selector) { focusBefore = root.activeElement; $(selector).classList.remove('hidden'); $(selector + ' .dismiss').focus(); $('.panel').inert = true; }
  function closeModal(selector) { $(selector).classList.add('hidden'); if (selector === '.viewer') { viewGroup = null; $('.viewstage img').removeAttribute('src'); } else if (selector === '.videoviewer') stopVideo(); else stitchSession = null; $('.panel').inert = false; focusBefore?.focus(); }
  root.querySelectorAll('.dismiss').forEach(b => b.onclick = () => closeModal(b.closest('.viewer') ? '.viewer' : b.closest('.videoviewer') ? '.videoviewer' : '.stitcher'));
  function openViewer(g) { viewGroup = g; openModal('.viewer'); refreshViewer(); }
  function refreshViewer() {
    resetZoom();
    const g = viewGroup; if (!g) return; $('.viewtitle').textContent = g.author; $('.viewcount').textContent = `${g.index + 1} / ${g.images.length}`;
    if (g.images[g.index].type === 'video') { closeModal('.viewer'); openVideo(g); return; }
    $('.viewstage img').src = g.images[g.index].url; $('.viewstage img').alt = g.images[g.index].alt;
    $('.thumbs').replaceChildren(); g.images.forEach((im, i) => { const b = button('', i === g.index ? 'active' : '', `查看第 ${i + 1} 张`); const img = new Image(); img.src = im.preview; img.alt = `第 ${i + 1} 张`; b.append(img); b.onclick = () => { g.index = i; updateCard(g); refreshViewer(); }; $('.thumbs').append(b); });
    $('.viewprev').disabled = $('.viewnext').disabled = g.images.length < 2; $('.viewstitch').classList.toggle('hidden', photosOf(g).length < 2); prefetch(g);
  }
  $('.viewprev').onclick = () => { turn(viewGroup, -1); refreshViewer(); }; $('.viewnext').onclick = () => { turn(viewGroup, 1); refreshViewer(); };
  const zoomImage = $('.viewstage img'), zoomStage = $('.viewstage');
  let zoom = 1, panX = 0, panY = 0, drag = null;
  const zoomTools = document.createElement('div'); zoomTools.className = 'zoom-tools';
  const zoomOut = button('−', 'zoom-out', '缩小'), zoomIn = button('+', 'zoom-in', '放大'), zoomFit = button('适应', 'zoom-fit', '适应窗口'), zoomNative = button('原尺寸', 'zoom-native', '按原图像素显示');
  const zoomLabel = document.createElement('span'); zoomLabel.className = 'zoom-label'; zoomLabel.textContent = '1×';
  zoomTools.append(zoomOut, zoomLabel, zoomIn, zoomNative, zoomFit); $('.viewfoot').append(zoomTools);
  function paintZoom() {
    zoomImage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    zoomImage.style.cursor = zoom > 1 ? (drag ? 'grabbing' : 'grab') : 'zoom-in';
    zoomLabel.textContent = `${Number(zoom.toFixed(2))}×`; zoomOut.disabled = zoom <= 1; zoomIn.disabled = zoom >= 16;
  }
  function resetZoom() { zoom = 1; panX = panY = 0; drag = null; paintZoom(); }
  function setZoom(value) { zoom = Math.max(1, Math.min(16, value)); if (zoom === 1) panX = panY = 0; paintZoom(); }
  zoomIn.onclick = () => setZoom(zoom * 1.5); zoomOut.onclick = () => setZoom(zoom / 1.5); zoomFit.onclick = resetZoom;
  zoomNative.onclick = () => { if (zoomImage.naturalWidth && zoomImage.clientWidth) setZoom(zoomImage.naturalWidth / zoomImage.clientWidth); };
  zoomImage.draggable = false;
  zoomImage.ondblclick = () => zoom > 1 ? resetZoom() : setZoom(2);
  zoomStage.addEventListener('wheel', e => { if (!viewGroup) return; e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, {passive:false});
  zoomImage.onpointerdown = e => { if (zoom <= 1 || e.button !== 0) return; e.preventDefault(); drag = {x:e.clientX, y:e.clientY, px:panX, py:panY}; zoomImage.setPointerCapture(e.pointerId); paintZoom(); };
  zoomImage.onpointermove = e => { if (!drag) return; panX = drag.px + e.clientX - drag.x; panY = drag.py + e.clientY - drag.y; paintZoom(); };
  zoomImage.onpointerup = zoomImage.onpointercancel = zoomImage.onlostpointercapture = () => { drag = null; paintZoom(); };
  zoomImage.title = '滚轮缩放 · 双击放大/还原 · 放大后拖动查看';
  $('.viewcopy').onclick = () => act($('.viewcopy'), 'copy', [viewGroup.images[viewGroup.index].url]); $('.viewsave').onclick = () => act($('.viewsave'), 'download', [viewGroup.images[viewGroup.index].url]);
  $('.viewstitch').onclick = () => { const g = viewGroup; closeModal('.viewer'); openStitch(photosOf(g), g.suggestion); };
  const player = $('.player');
  function videoStatus(text) { $('.videostatus').textContent = text; $('.videostatus').classList.toggle('hidden', !text); }
  function stopVideo() { videoSession = null; player.onloadedmetadata = null; player.pause(); player.removeAttribute('src'); player.removeAttribute('poster'); player.load(); }
  function playSource(index, resumeTime = 0) {
    const session = videoSession; if (!session) return;
    const source = session.variants[index]; if (!source) return;
    session.source = source.url; player.pause(); player.src = source.url;
    player.onloadedmetadata = () => { if (videoSession === session && session.source === source.url && resumeTime > 0) player.currentTime = Math.min(resumeTime, Number.isFinite(player.duration) ? Math.max(0, player.duration - .1) : resumeTime); };
    videoStatus('正在加载视频…');
    player.play().catch(error => { if (videoSession !== session || session.source !== source.url || error.name === 'AbortError') return; videoStatus(error.name === 'NotAllowedError' ? '点击播放器中的播放按钮继续' : '暂时无法播放，可切换清晰度或打开原推文'); });
  }
  function openVideo(g) {
    stopVideo(); const im = g.images[g.index]; if (im.type !== 'video') return;
    const cached = (videoMetadata.get(g.id) || []).find(m => m.key === im.key || (m.poster && im.preview && new URL(m.poster).pathname === new URL(im.preview).pathname));
    const variants = XIFVideo.variants(cached?.variants?.length ? cached.variants : im.variants); videoSession = {variants, source: ''};
    $('.videotitle').textContent = im.gif ? 'GIF 动图' : '视频预览'; $('.videoorigin').href = g.href;
    if (im.preview) player.poster = im.preview; player.muted = true; player.loop = im.gif === true;
    $('.videoquality').replaceChildren(); variants.forEach((v, i) => { const option = document.createElement('option'); option.value = String(i); option.textContent = `${i === 0 ? '省流 · ' : ''}${v.height ? `${v.height}p` : v.bitrate ? `${Math.round(v.bitrate / 1000)} kbps` : '当前可用清晰度'}`; $('.videoquality').append(option); });
    $('.videoquality').disabled = variants.length < 2; openModal('.videoviewer');
    if (variants.length) playSource(0); else videoStatus('尚未取得可播放的 MP4 地址。请刷新 X 后重试，或打开原推文播放。');
  }
  $('.videoquality').onchange = e => playSource(Number(e.target.value), player.currentTime || 0);
  player.addEventListener('playing', () => videoStatus(''));
  player.addEventListener('waiting', () => { if (videoSession?.source) videoStatus('正在缓冲…'); });
  player.addEventListener('error', () => { if (videoSession?.source) videoStatus('视频加载失败，可切换清晰度或打开原推文'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && videoSession) player.pause(); });
  function setMode(s, mode) { s.mode = mode; s.seams = []; root.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode)); }
  async function openStitch(images, suggestion) {
    if (images.length < 2) return; const s = {images: images.map(im => ({...im})), mode: 'horizontal', blend: true, seams: [], version: 0, touched: false}; stitchSession = s;
    $('.blend input').checked = true; $('.seamcontrols').replaceChildren(); $('.alignmentnote').textContent = ''; openModal('.stitcher'); $('.stitched').classList.add('hidden'); $('.stitchcopy').disabled = $('.stitchsave').disabled = true;
    $('[data-mode="grid"]').disabled = images.length !== 4; setMode(s, 'horizontal'); renderOrder(s);
    $('.detectnote').textContent = '正在比较相邻边缘…'; $('.detectnote').classList.remove('good');
    if (suggestion) applySuggestion(s, suggestion); else {
      requestPreview(s);
      try { const r = await message({action: 'analyze', urls: s.images.map(im => im.url)}); if (stitchSession === s && !s.touched) applySuggestion(s, r.suggestion); }
      catch { if (stitchSession === s) $('.detectnote').textContent = '自动检测暂不可用，可手动调整方向和顺序。'; }
    }
  }
  function applySuggestion(s, suggestion) {
    if (stitchSession !== s) return;
    if (suggestion.suggested) { s.images = suggestion.order.map(i => s.images[i]); setMode(s, suggestion.mode); }
    $('.detectnote').textContent = suggestion.suggested ? '发现连续边缘，已按建议排列。请检查预览接缝。' : '未找到可靠的连续边缘，保持当前顺序，可手动拼接。'; $('.detectnote').classList.toggle('good', suggestion.suggested); renderOrder(s); requestPreview(s);
  }
  function renderOrder(s) {
    $('.order').replaceChildren(); s.images.forEach((im, i) => {
      const row = document.createElement('div'); row.className = 'orderrow'; const img = new Image(); img.src = im.preview; img.alt = `片段 ${i + 1}`; const label = document.createElement('span'); label.textContent = `片段 ${i + 1}`;
      const up = button('↑', 'up', '前移'), down = button('↓', 'down', '后移'); up.disabled = i === 0; down.disabled = i === s.images.length - 1;
      function move(delta) { s.touched = true; s.seams = []; [s.images[i], s.images[i + delta]] = [s.images[i + delta], s.images[i]]; renderOrder(s); requestPreview(s); }
      const remove = button('×', 'remove-piece', `删除片段 ${i + 1}`); remove.setAttribute('aria-label', `删除片段 ${i + 1}`);
      remove.onclick = () => {
        s.touched = true; s.seams = []; s.images.splice(i, 1);
        $('[data-mode="grid"]').disabled = s.images.length !== 4;
        if (s.mode === 'grid') setMode(s, 'horizontal');
        $('.detectnote').textContent = '已移除此片段，可继续调整顺序或重新智能排序。'; $('.detectnote').classList.remove('good');
        $('.seamcontrols').replaceChildren(); $('.alignmentnote').textContent = '';
        renderOrder(s); requestPreview(s);
      };
      up.onclick = () => move(-1); down.onclick = () => move(1); row.append(img, label, up, down, remove); $('.order').append(row);
    });
  }
  function renderSeams(s, seams) {
    $('.seamcontrols').replaceChildren();
    seams.forEach((seam, i) => {
      const row = document.createElement('div'); row.className = 'seamrow';
      const title = document.createElement('b'); title.textContent = '接缝 ' + (i + 1); row.append(title);
      for (const [key, name] of [['overlap', '重叠'], ['shift', s.mode === 'horizontal' ? '上下偏移' : '左右偏移']]) {
        const label = document.createElement('label'), input = document.createElement('input');
        label.textContent = name; input.type = 'number'; input.step = '1'; input.value = seam[key]; input.setAttribute('aria-label', '接缝 ' + (i + 1) + name);
        input.min = key === 'overlap' ? '0' : '-32767'; input.max = key === 'overlap' ? '32766' : '32767';
        input.onchange = () => { if (!input.checkValidity() || !Number.isSafeInteger(input.valueAsNumber)) return; s.touched = true; s.seams[i] = {...(s.seams[i] || {overlap: seam.overlap, shift: seam.shift}), [key]: input.valueAsNumber}; requestPreview(s); };
        label.append(input); row.append(label);
      }
      $('.seamcontrols').append(row);
    });
    $('.alignmentnote').textContent = s.mode === 'grid' ? '四宫格按原始尺寸排列。' : seams.some(x => x.manual) ? '已使用手动参数，预览与导出一致。' : seams.some(x => x.accepted) ? '已对齐可靠匹配的接缝；其余保留原位置。' : '未找到可靠重叠，已保留原位置。若线条断开，可能是切片缺失内容，请勿盲目增加重叠。';
  }
  let previewTimer;
  function requestPreview(s) {
    const version = ++s.version; clearTimeout(previewTimer); $('.previewstatus').textContent = '正在生成预览…'; $('.previewstatus').classList.remove('hidden'); $('.stitchcopy').disabled = $('.stitchsave').disabled = true;
    $('.redetect').disabled = s.images.length < 2;
    if (s.images.length < 2) { $('.stitched').classList.add('hidden'); $('.previewstatus').textContent = '至少需要两张图片才能拼接，请关闭后重新选择图片。'; return; }
    previewTimer = setTimeout(async () => {
      try { const r = await message({action: 'preview', urls: s.images.map(im => im.url), mode: s.mode, blend: s.blend, seams: s.seams}); if (stitchSession !== s || version !== s.version) return; renderSeams(s, r.seams || []); $('.stitched').src = r.data; $('.stitched').classList.remove('hidden'); $('.previewstatus').classList.add('hidden'); $('.stitchcopy').disabled = $('.stitchsave').disabled = false; }
      catch (e) { if (stitchSession === s && version === s.version) { $('.stitched').classList.add('hidden'); $('.previewstatus').textContent = `预览失败：${e.message}`; } }
    }, 120);
  }
  root.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { const s = stitchSession; if (!s) return; s.touched = true; setMode(s, b.dataset.mode); requestPreview(s); });
  $('.blend input').onchange = e => { const s = stitchSession; if (!s) return; s.blend = e.target.checked; s.seams = []; requestPreview(s); };
  $('.redetect').onclick = async () => {
    const s = stitchSession; if (!s || s.images.length < 2) return; const version = s.version; $('.redetect').disabled = true;
    try { const r = await message({action: 'analyze', urls: s.images.map(im => im.url)}); if (stitchSession === s && s.version === version) applySuggestion(s, r.suggestion); } catch (e) { toast(e.message); } finally { if (stitchSession === s) $('.redetect').disabled = s.images.length < 2; }
  };
  $('.stitchcopy').onclick = () => { const s = stitchSession; act($('.stitchcopy'), 'copy', s.images.map(im => im.url), s.mode, s.blend, s.seams); };
  $('.stitchsave').onclick = () => { const s = stitchSession; act($('.stitchsave'), 'download', s.images.map(im => im.url), s.mode, s.blend, s.seams); };
  document.addEventListener('keydown', e => {
    if (!open) return;
    const modal = !$('.videoviewer').classList.contains('hidden') ? '.videoviewer' : !$('.stitcher').classList.contains('hidden') ? '.stitcher' : !$('.viewer').classList.contains('hidden') ? '.viewer' : null;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (modal) closeModal(modal); else toggle(); }
    if (viewGroup && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); turn(viewGroup, e.key === 'ArrowLeft' ? -1 : 1); refreshViewer(); }
    if (modal && e.key === 'Tab') { const focusable = [...$(modal).querySelectorAll('button:not(:disabled),a[href],select,input')].filter(el => el.getClientRects().length); const first = focusable[0], last = focusable.at(-1); if (e.shiftKey && root.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && root.activeElement === last) { e.preventDefault(); first.focus(); } }
  }, true);
  // Only a navigation initiated by the gallery reopens it, in this tab and at the intended destination.
  try {
    const pending = JSON.parse(sessionStorage.getItem('xif-history-open') || 'null');
    sessionStorage.removeItem('xif-history-open');
    if (pending && pending.path === location.pathname && Date.now() - pending.time >= 0 && Date.now() - pending.time < 120000) toggle();
  } catch { /* A normal visit still starts with the launch button. */ }
  updateHistoryTabs();
})();
