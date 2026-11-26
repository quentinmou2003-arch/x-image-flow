/* Pure helpers shared by the gallery, image processor and tests. */
(function (scope) {
  'use strict';
  function mediaURL(value, size = 'orig') {
    const u = new URL(value);
    if (u.origin !== 'https://pbs.twimg.com' || !/^\/media\/[\w.-]+$/.test(u.pathname) || u.username || u.password) throw Error('仅支持 X 推文图片');
    // X exposes the same photo as /id.jpg and /id?format=jpg.
    const ext=u.pathname.match(/\.(jpe?g|png|webp|gif|avif)$/i),format=(u.searchParams.get('format')||ext?.[1]||'').toLowerCase().replace(/^jpeg$/,'jpg');
    if(ext)u.pathname=u.pathname.slice(0,-ext[0].length);
    u.search='';if(format)u.searchParams.set('format',format);u.searchParams.set('name',size);return u.href;
  }
  function photoKey(value){return new URL(mediaURL(value)).pathname;}
  function uniquePhotos(photos){
    const rows=new Map();for(const photo of photos){const url=mediaURL(photo.url),key=photoKey(url),old=rows.get(key);if(old){if(photo.copiedAt)old.copiedAt=Math.max(old.copiedAt||0,photo.copiedAt);}else rows.set(key,{...photo,url});}return [...rows.values()];
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
    if (sizes.length < 2 || sizes.length > 8) throw Error('拼接支持 2–8 张图片');
    if (sizes.some(s => !Number.isInteger(s.width) || !Number.isInteger(s.height) || s.width < 1 || s.height < 1)) throw Error('图片尺寸无效');
    let width, height, cells;
    if (mode === 'horizontal') {
      width = sizes.reduce((v, s) => v + s.width, 0); height = Math.max(...sizes.map(s => s.height));
      let x = 0; cells = sizes.map(s => { const c = {x, y: 0, width: s.width, height: s.height}; x += s.width; return c; });
    } else if (mode === 'vertical') {
      width = Math.max(...sizes.map(s => s.width)); height = sizes.reduce((v, s) => v + s.height, 0);
      let y = 0; cells = sizes.map(s => { const c = {x: 0, y, width: s.width, height: s.height}; y += s.height; return c; });
    } else if ((mode === 'grid' && sizes.length === 4) || (['grid3x2','grid2x3'].includes(mode) && sizes.length === 6)) {
      const cols=mode==='grid3x2'?3:2, rows=sizes.length/cols;
      const widths=Array.from({length:cols},(_,c)=>Math.max(...sizes.filter((_,i)=>i%cols===c).map(s=>s.width)));
      const heights=Array.from({length:rows},(_,row)=>Math.max(...sizes.slice(row*cols,(row+1)*cols).map(s=>s.height)));
      width=widths.reduce((a,b)=>a+b,0);height=heights.reduce((a,b)=>a+b,0);
      cells=sizes.map((s,i)=>({x:widths.slice(0,i%cols).reduce((a,b)=>a+b,0),y:heights.slice(0,Math.floor(i/cols)).reduce((a,b)=>a+b,0),width:s.width,height:s.height}));
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
    if (images.length < 2 || images.length > 8) throw Error('检测支持 2–8 张图片');
    const candidates = [], memo = new Map();
    function edge(a, b, horizontal) {
      const key = `${a}:${b}:${horizontal}`;
      if (!memo.has(key)) memo.set(key, seam(images[a], images[b], horizontal)); return memo.get(key);
    }
    // Keep two best paths per subset/end: 8 photos need no factorial search for strips.
    const n=images.length, full=(1<<n)-1;
    for(const mode of ['horizontal','vertical']) {
      const dp=new Map();
      const keep=(key,value)=>{const rows=dp.get(key)||[];rows.push(value);rows.sort((a,b)=>a.cost-b.cost);dp.set(key,rows.slice(0,2));};
      for(let i=0;i<n;i++)keep(((1<<i)*n)+i,{order:[i],cost:0,energy:0});
      for(let mask=1;mask<=full;mask++)for(let last=0;last<n;last++)for(const path of dp.get(mask*n+last)||[])for(let next=0;next<n;next++)if(!(mask&(1<<next))){const e=edge(last,next,mode==='horizontal');keep((mask|(1<<next))*n+next,{order:[...path.order,next],cost:path.cost+e.cost,energy:path.energy+e.energy});}
      for(let last=0;last<n;last++)for(const p of dp.get(full*n+last)||[])candidates.push({...p,mode,cost:p.cost/(n-1),energy:p.energy/(n-1)});
    }
    const grids=n===4?['grid']:n===6?['grid3x2','grid2x3']:[];
    if(grids.length)for(const order of permutations(images.map((_,i)=>i)))for(const mode of grids){
      const cols=mode==='grid3x2'?3:2,edges=[];
      for(let i=0;i<n;i++){if(i%cols<cols-1)edges.push(edge(order[i],order[i+1],true));if(i+cols<n)edges.push(edge(order[i],order[i+cols],false));}
      candidates.push({mode,order,cost:edges.reduce((v,e)=>v+e.cost,0)/edges.length,energy:edges.reduce((v,e)=>v+e.energy,0)/edges.length});
    }
    candidates.sort((a, b) => a.cost - b.cost);
    const best = candidates[0], gap = candidates[1].cost - best.cost;
    return {...best, suggested: best.cost < .085 && gap > .012 && best.energy > .005, gap};
  }
  function filenamePart(value, limit = 100) {
    let text=String(value||'').normalize('NFC').replace(/\s+/g,' ').replace(/https?:\/\/\S+/gi,'').replace(/[<>:"/\\|?*\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,'_').replace(/\s+/g,' ').replace(/^[ ._]+|[ ._]+$/g,'');
    text=text.slice(0,limit).replace(/[\ud800-\udbff]$/,'').replace(/[ ._]+$/,'');
    if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(text))text='_'+text;
    return text;
  }
  function postTime(id, value) {
    const valid=ms=>Number.isFinite(ms)&&ms>=Date.UTC(2006,0,1)&&ms<=Date.now()+86400000;
    if(typeof value==='string'&&value.length<=80){const ms=Date.parse(value);if(valid(ms))return new Date(ms).toISOString();}
    try{if(!/^\d{1,20}$/.test(id))return '';const n=BigInt(id);if(n<1000000000000n||n>9223372036854775807n)return '';const ms=Number((n>>22n)+1288834974657n);return valid(ms)?new Date(ms).toISOString():'';}catch{return '';}
  }
  function imageName(group, index = 1, stitched = false) {
    const author=filenamePart(String(group.author||'').replace(/^引用\s*[·:]\s*/,''),20)||'作者未识别',description=filenamePart(group.description,22),id=/^\d{1,30}$/.test(group.id)?group.id:'来源未识别';
    const iso=postTime(group.id,group.postedAt),time=iso?new Date(Date.parse(iso)+8*3600000).toISOString().slice(0,19).replace('T','_').replace(/:/g,'-'):'时间未知';
    return filenamePart([author,time,description||'推文',id,stitched?'拼接':'图'+String(index).padStart(2,'0')].join('_'),100);
  }
  const api = {mediaURL, photoKey, uniquePhotos, status, geometry, detect, filenamePart, imageName, postTime}; scope.XIF = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
