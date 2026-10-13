/* Original files and metadata stay in this extension's local IndexedDB. */
(function(scope) {
  'use strict';
  const DB = 'xif-collector-lab-v1', MIME = new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif']);
  let opened, writes = Promise.resolve();
  const request = req => new Promise((resolve,reject) => { req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
  function database() {
    if (!opened) opened = new Promise((resolve,reject) => {
      const req = indexedDB.open(DB,1);
      req.onupgradeneeded=()=>{for(const name of ['entries','assets','aliases'])req.result.createObjectStore(name,{keyPath:name==='entries'?'id':name==='assets'?'hash':'url'});};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>{opened=null;reject(req.error);};
    });
    return opened;
  }
  const enqueue = work => { const task = writes.then(work,work); writes=task.catch(()=>{});return task; };
  async function read(store,key) { const db=await database();return request(db.transaction(store).objectStore(store).get(key)); }
  async function all(store) { const db=await database();return request(db.transaction(store).objectStore(store).getAll()); }
  async function write(stores,work) {
    const db=await database();return new Promise((resolve,reject)=>{
      const tx=db.transaction(stores,'readwrite');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('本地写入已取消'));
      try {work(tx);}catch(e){tx.abort();reject(e);}
    });
  }
  function tags(value) { return [...new Set((Array.isArray(value)?value:String(value||'').split(/[,，]/)).map(v=>String(v).trim().slice(0,24)).filter(Boolean))].slice(0,12); }
  function input(value) {
    const post=scope.XIF.status(value?.href);
    if(!post || post.id!==value.id || !/^\d{1,30}$/.test(value.id) || !Array.isArray(value.images) || value.images.length<1 || value.images.length>4)throw Error('收图来源或数量无效');
    const images=value.images.map(im=>({url:scope.XIF.mediaURL(im.url),alt:String(im.alt||'图片').slice(0,160)}));
    const sourceURL=new URL(value.href),href='https://x.com'+sourceURL.pathname.split('/status/')[0]+'/status/'+post.id;
    let authorURL='';try{const u=new URL(value.authorURL||value.href);const handle=u.pathname.split('/')[1];if(['https://x.com','https://twitter.com'].includes(u.origin)&&/^[A-Za-z0-9_]{1,15}$/.test(handle)&&handle!=='i')authorURL='https://x.com/'+handle;}catch{}
    return {id:post.id,href,author:String(value.author||'X 作者').slice(0,100),authorURL,images};
  }
  async function save(value) { return enqueue(async()=>{
    const source=input(value), old=await read('entries',source.id), photos=[...(old?.photos||[])], additions=[], aliases=[]; let bytes=0;
    for(const im of source.images) {
      if(photos.some(p=>p.url===im.url))continue;
      if(photos.length>=4)throw Error('同一推文最多保存四张图片');
      const alias=await read('aliases',im.url);let asset=alias&&await read('assets',alias.hash);
      if(!asset) {
        const response=await fetch(im.url,{credentials:'omit',signal:AbortSignal.timeout(25000)});
        if(!response.ok)throw Error('原图获取失败 ('+response.status+')');
        const blob=await response.blob();
        if(!MIME.has(blob.type)||!blob.size||blob.size>64*1024*1024)throw Error('原图格式不支持或文件过大');
        bytes+=blob.size;if(bytes>160*1024*1024)throw Error('本组原图总大小超过归档限制');
        const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');
        asset=await read('assets',hash)||additions.find(a=>a.hash===hash)||{hash,blob,mime:blob.type,bytes:blob.size};
        if(!additions.some(a=>a.hash===hash))additions.push(asset);
        aliases.push({url:im.url,hash});
      }
      photos.push({url:im.url,hash:asset.hash,alt:im.alt,copiedAt:0});
    }
    const entry={id:source.id,href:source.href,author:source.author,authorURL:source.authorURL,photos,tags:old?.tags||[],state:photos.length>(old?.photos.length||0)?'saved':old?.state||'saved',createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()};
    await write(['entries','assets','aliases'],tx=>{
      for(const a of additions)tx.objectStore('assets').put(a);
      for(const a of aliases)tx.objectStore('aliases').put(a);
      tx.objectStore('entries').put(entry);
    });
    return entry;
  }); }
  async function edit(id,patch) { return enqueue(async()=>{
    const entry=await read('entries',id);if(!entry)throw Error('这条收藏不存在');
    if(patch.tags!==undefined)entry.tags=tags(patch.tags);
    if(patch.state!==undefined) {
      if(!['saved','copied','sent'].includes(patch.state))throw Error('收图状态无效');
      entry.state=patch.state;if(patch.state==='saved')for(const p of entry.photos)p.copiedAt=0;
    }
    entry.updatedAt=Date.now();await write(['entries'],tx=>tx.objectStore('entries').put(entry));return entry;
  }); }
  async function progress(urls) { return enqueue(async()=>{
    const set=new Set(urls.map(url=>scope.XIF.mediaURL(url))), entries=await all('entries'), changed=[];
    for(const e of entries) {let dirty=false;for(const p of e.photos)if(set.has(p.url)){p.copiedAt=Date.now();dirty=true;}
      if(dirty){if(e.state!=='sent'&&e.photos.every(p=>p.copiedAt))e.state='copied';e.updatedAt=Date.now();changed.push(e);}}
    if(changed.length)await write(['entries'],tx=>changed.forEach(e=>tx.objectStore('entries').put(e)));
  }); }
  async function remove(id) { return enqueue(async()=>{
    const entries=await all('entries'), target=entries.find(e=>e.id===id);if(!target)return;
    const used=new Set(entries.filter(e=>e.id!==id).flatMap(e=>e.photos.map(p=>p.hash))), orphan=new Set(target.photos.map(p=>p.hash).filter(h=>!used.has(h)));
    const aliases=await all('aliases');
    await write(['entries','assets','aliases'],tx=>{
      tx.objectStore('entries').delete(id);
      for(const h of orphan)tx.objectStore('assets').delete(h);
      for(const a of aliases)if(orphan.has(a.hash))tx.objectStore('aliases').delete(a.url);
    });
  }); }
  async function summary() {
    const entries=await all('entries');
    return {entries:entries.map(e=>({id:e.id,photos:e.photos.map(p=>({url:p.url,copiedAt:p.copiedAt})),state:e.state})),urls:[...new Set(entries.flatMap(e=>e.photos.map(p=>p.url)))]};
  }
  scope.XIFLibrary={database,read,all,save,edit,progress,remove,summary,tags,input};
  if(typeof module!=='undefined')module.exports={tags,input};
})(globalThis);
