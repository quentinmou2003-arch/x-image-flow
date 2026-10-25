'use strict';
importScripts('shared.js', 'offscreen-client.js', 'native-copy.js', 'library-store.js');
chrome.action.onClicked.addListener(async tab => {
  if (/^https:\/\/(x|twitter)\.com\//.test(tab.url || '')) {
    try { await chrome.tabs.sendMessage(tab.id, {type: 'toggle'}); } catch { await chrome.tabs.reload(tab.id); }
  } else await chrome.tabs.create({url: 'https://x.com/home'});
});
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.target !== 'worker') return;
  (async () => {
    const ownLibrary = sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL('library.html'));
    const xPage = sender.id === chrome.runtime.id && sender.tab && /^https:\/\/(x|twitter)\.com\//.test(sender.url || '');
    if (msg.action?.startsWith('library-')) {
      if (!ownLibrary && !xPage) throw Error('收藏库不支持此页面');
      if (msg.action === 'library-open') { await chrome.tabs.create({url: chrome.runtime.getURL('library.html') + (msg.id ? '#' + encodeURIComponent(msg.id) : '')}); return {ok:true}; }
      if (msg.action === 'library-status') return {ok:true,...await XIFLibrary.summary()};
      if (msg.action === 'library-save') { const entry=await XIFLibrary.save(msg.entry); await libraryChanged(); return {ok:true,id:entry.id}; }
      if (msg.action === 'library-progress') { if(!Array.isArray(msg.urls)||msg.urls.length>4)throw Error('复制记录无效');await XIFLibrary.progress(msg.urls);await libraryChanged();return {ok:true}; }
      if (msg.action === 'library-edit' && ownLibrary) { await XIFLibrary.edit(msg.id,msg.patch||{}); await libraryChanged();return {ok:true}; }
      if (msg.action === 'library-delete' && ownLibrary) { await XIFLibrary.remove(msg.id); await libraryChanged();return {ok:true}; }
      if (msg.action === 'library-local-prepare' && ownLibrary) {
        const entry=await XIFLibrary.read('entries',msg.id);if(!entry)throw Error('收藏不存在');
        return XIFNativeCopy.prepare(sender.tab.id,entry.photos.map(p=>p.hash),undefined,false,async i=>{
          const asset=await XIFLibrary.read('assets',entry.photos[i].hash);if(!asset)throw Error('原图文件缺失');
          const bytes=new Uint8Array(await asset.blob.arrayBuffer()),parts=[];
          for(let offset=0;offset<bytes.length;offset+=32768)parts.push(String.fromCharCode(...bytes.subarray(offset,offset+32768)));
          return XIFOffscreen.request({action:'local-copy',data:'data:'+asset.mime+';base64,'+btoa(parts.join(''))});
        });
      }
      throw Error('收藏库操作无效');
    }
    if (ownLibrary && ['helper-check','batch-commit','batch-abort'].includes(msg.action)) {
      if(msg.action==='helper-check')return XIFNativeCopy.check();
      if(msg.action==='batch-commit')return XIFNativeCopy.commit(sender.tab.id,msg.jobId);
      return XIFNativeCopy.abort(sender.tab.id,msg.jobId);
    }
    if (!sender.tab || !/^https:\/\/(x|twitter)\.com\//.test(sender.url || '')) throw Error('不支持的页面');
    if (msg.action === 'helper-check') return XIFNativeCopy.check();
    if (msg.action === 'batch-commit') return XIFNativeCopy.commit(sender.tab.id, msg.jobId);
    if (msg.action === 'batch-abort') return XIFNativeCopy.abort(sender.tab.id, msg.jobId);
    if (msg.action === 'batch-prepare') {
      if (!Array.isArray(msg.urls) || msg.urls.length < 2 || msg.urls.length > 4) throw Error('整组图片数量无效');
      const urls = msg.urls.map(url => XIF.mediaURL(url));
      if (msg.mode !== undefined && !['horizontal', 'vertical', 'grid'].includes(msg.mode)) throw Error('拼接布局无效');
      return XIFNativeCopy.prepare(sender.tab.id, urls, msg.mode, msg.blend);
    }
    if (msg.action === 'tweet-action') {
      throw Error('请返回 X 正常点赞或收藏一次，插件会自动学习网页接口；不会新开标签页');
    }
    if (!['copy', 'download', 'preview', 'analyze', 'prefetch'].includes(msg.action)) throw Error('未知操作');
    const values = msg.urls || [msg.url];
    if (!Array.isArray(values) || values.length < 1 || values.length > 4) throw Error('图片数量无效');
    const urls = values.map(url => XIF.mediaURL(url));
    if (urls.length > 1 && ['copy', 'download', 'preview'].includes(msg.action) && !['horizontal', 'vertical', 'grid'].includes(msg.mode)) throw Error('拼接布局无效');
    const result = await XIFOffscreen.request({action: msg.action, urls, mode: msg.mode, blend: msg.blend, seams: msg.seams});
    if (!result?.ok) throw Error(result?.error || '图片处理失败');
    if (msg.action === 'download') {
      const base = urls.length > 1 ? `stitch-${Date.now()}` : new URL(urls[0]).pathname.split('/').pop().replace(/[^a-zA-Z0-9_-]/g, '_');
      try { await chrome.downloads.download({url: result.url, filename: `X-Images/${base}.png`, saveAs: true}); }
      finally { setTimeout(() => chrome.runtime.sendMessage({target: 'offscreen', action: 'revoke', url: result.url}).catch(() => {}), 60000); }
      return {ok: true, width: result.width, height: result.height};
    }
    return result;
  })().then(reply, error => reply({ok: false, error: error.message})); return true;
});

async function libraryChanged(){ const tabs=await chrome.tabs.query({url:['https://x.com/*','https://twitter.com/*']});await Promise.allSettled(tabs.map(tab=>chrome.tabs.sendMessage(tab.id,{type:'library-change'})));chrome.runtime.sendMessage({type:'library-change'}).catch(()=>{}); }
