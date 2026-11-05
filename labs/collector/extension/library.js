(() => {
  'use strict';
  const $=s=>document.querySelector(s), objectURLs=new Set();
  let entries=[],pageSize=50,busy=false,selected=null,timer,refreshTimer,queueSize=20,queueTimer,driveTimer,driveSize=10,driveState=null;
  async function message(data){try{const result=await chrome.runtime.sendMessage({target:'worker',...data});if(!result?.ok)throw Error(result?.error||'扩展未响应');return result;}catch(e){if(/Receiving end does not exist|Could not establish connection|Extension context invalidated/i.test(e.message))throw Error('插件后台未连接，请重新加载拾图，再重新打开本地库');throw e;}}
  function notice(text){clearTimeout(timer);$('#notice').textContent=text;$('#notice').hidden=false;timer=setTimeout(()=>$('#notice').hidden=true,5000);}
  function button(text,cls,action){const b=document.createElement('button');b.textContent=text;b.className=cls||'';b.onclick=async()=>{b.disabled=true;try{await action();}catch(e){notice(e.message);}finally{b.disabled=false;}};return b;}
  const extension=mime=>({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'}[mime]||'bin');
  const imageObserver=new IntersectionObserver(rows=>{for(const row of rows)if(row.isIntersecting){const img=row.target;imageObserver.unobserve(img);XIFLibrary.read('assets',img.dataset.hash).then(asset=>{if(asset&&img.isConnected){const url=URL.createObjectURL(asset.blob);objectURLs.add(url);img.src=url;}}).catch(e=>notice(e.message));}},{rootMargin:'400px'});
  async function png(asset){
    const image=await createImageBitmap(asset.blob);
    try{if(image.width>32767||image.height>32767||image.width*image.height>100000000)throw Error('图片过大，请导出原文件');
      let blob=asset.blob;if(asset.mime!=='image/png'){const canvas=new OffscreenCanvas(image.width,image.height);canvas.getContext('2d').drawImage(image,0,0);blob=await canvas.convertToBlob({type:'image/png'});}
      if(blob.size>40*1024*1024)throw Error('PNG 超过复制限制，请导出原图');
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('PNG 读取失败'));reader.readAsDataURL(blob);});
      return {data,width:image.width,height:image.height};
    }finally{image.close();}
  }
  async function copy(entry,photos=entry.photos){
    if(busy)throw Error('上一组还在复制');busy=true;let job;
    try{
      if(photos.length===1)await XIFClipboard.copy('local:'+photos[0].hash,async()=>png(await XIFLibrary.read('assets',photos[0].hash)));
      else{job=await message({action:'library-local-prepare',id:entry.id});if(!document.hasFocus())throw Error('图片已准备，请切回收藏库重试');const result=await message({action:'batch-commit',jobId:job.jobId});job=null;if(result.count!==photos.length)throw Error('复制数量未确认');}
      await message({action:'library-progress',urls:photos.map(p=>p.url)});notice('已复制 '+photos.length+' 张，可到 QQ 粘贴');await refresh();
    }finally{if(job)await message({action:'batch-abort',jobId:job.jobId}).catch(()=>{});busy=false;}
  }
  async function download(blob,filename){const url=URL.createObjectURL(blob);try{await chrome.downloads.download({url,filename,saveAs:false});}finally{setTimeout(()=>URL.revokeObjectURL(url),60000);}}
  async function exportPhotos(entry,photos=entry.photos){for(const photo of photos){const asset=await XIFLibrary.read('assets',photo.hash);if(!asset)throw Error('原图缺失');await download(asset.blob,'XIF-Library/'+entry.id+'-'+(entry.photos.indexOf(photo)+1)+'.'+extension(asset.mime));}notice('原图导出已开始');}
  async function refresh(){entries=(await XIFLibrary.all('entries')).sort((a,b)=>b.createdAt-a.createdAt);const stats=await XIFLibrary.assetStats();$('#post-count').textContent=entries.length;$('#image-count').textContent=stats.count;$('#bytes').textContent=(stats.bytes/1024/1024).toFixed(1)+' MB';await render();await renderQueue();await renderDrive();}
  const cloudLabel=job=>job?.state==='synced'?'已入云':job?.state==='uploading'?'上传中 '+job.done+'/'+job.total:job?.state==='failed'?'云端同步失败':'待上传';
  function cloudPills(state){if(!state)return;const latest=new Map();for(const job of [...state.jobs].sort((a,b)=>b.createdAt-a.createdAt))if(!latest.has(job.entryId))latest.set(job.entryId,job);for(const card of document.querySelectorAll('.card[data-id]')){let pill=card.querySelector('.cloud-pill');if(!pill){pill=document.createElement('span');pill.className='cloud-pill';card.querySelector('.state-line').after(pill);}const job=latest.get(card.dataset.id);pill.textContent=job?cloudLabel(job):state.enabled?'待同步':'云盘未连接';pill.classList.toggle('synced',job?.state==='synced');}}
  async function renderDrive(){
    const state=await message({action:'drive-status'});driveState=state;
    $('#drive-status').textContent=state.enabled?(state.paused?'同步暂停 · ':'已连接 · ')+(state.account?.email||state.account?.name||'Google Drive'):'未连接';
    $('#drive-connect').textContent=state.enabled?'重新授权并同步':'连接并同步收藏';$('#drive-disconnect').hidden=!state.enabled;
    $('#drive-error').textContent=state.error;$('#drive-folder').hidden=!state.folder;if(state.folder)$('#drive-folder').href=state.folder;
    if(!state.configured){$('#drive-setup').open=true;$('#drive-error').textContent='首次需配置 Google 应用客户端 ID，当前原图仍在本机。';}
    $('.cloud-status').textContent=state.enabled?'本机保存与云端同步分开显示':'云盘未连接 · 本机保存继续工作';
    const jobs=state.jobs.sort((a,b)=>b.createdAt-a.createdAt);cloudPills(state);
    const list=$('#drive-jobs');list.replaceChildren();const visible=jobs.filter(j=>j.state!=='synced');$('#drive-more').hidden=visible.length<=driveSize;
    for(const job of visible.slice(0,driveSize)){const row=document.createElement('div');row.className='queue-row';const label=document.createElement('div');label.textContent='推文 '+job.entryId+' · '+cloudLabel(job);if(job.error){const p=document.createElement('p');p.textContent=job.error;label.append(p);}row.append(label);if(job.state!=='uploading')row.append(button('重试','',async()=>{await message({action:'drive-retry',id:job.id});await renderDrive();}));list.append(row);}
  }
  $('#drive-extension-id').value=chrome.runtime.id;
  $('#drive-copy-id').onclick=()=>navigator.clipboard.writeText(chrome.runtime.id).then(()=>notice('扩展 ID 已复制'),e=>notice(e.message));
  $('#drive-connect').onclick=async()=>{const b=$('#drive-connect');b.disabled=true;$('#drive-status').textContent='正在请求 Google 授权…';try{await message({action:'drive-connect'});notice('已连接，原图将在后台上传');}catch(e){notice(e.message);}finally{b.disabled=false;await renderDrive().catch(e=>notice(e.message));}};
  $('#drive-disconnect').onclick=async()=>{await message({action:'drive-disconnect'});await renderDrive();};
  $('#drive-more').onclick=()=>{driveSize+=10;renderDrive().catch(e=>notice(e.message));};
  async function renderQueue(){
    const {jobs}=await message({action:'library-queue-status'}),pending=jobs.filter(j=>j.state!=='saved');
    $('#queue-count').textContent=pending.length;$('#queue-summary').textContent=pending.length?pending.length+' 组正在保存或等待处理。网络恢复后自动重试，连续失败 5 次可手动重试。':'队列已处理完毕。新增点赞会保存整组原图，已有的历史点赞不会自动导入。';
    const list=$('#queue-list');list.replaceChildren();$('#queue-more').hidden=pending.length<=queueSize;
    for(const job of pending.slice(0,queueSize)){
      const row=document.createElement('div');row.className='queue-row';row.dataset.id=job.id;
      const info=document.createElement('div'),title=document.createElement('a');title.href=job.source.href;title.target='_blank';title.rel='noopener noreferrer';title.textContent=job.source.author+' · '+job.source.images.length+' 张原图';
      const status=document.createElement('p');status.className=job.state==='failed'?'queue-error':'';status.textContent=job.state==='saving'?'正在保存整组原图…':job.state==='failed'?'保存失败 · '+job.error:job.error?'等待重试 · '+job.error:'等待保存';
      info.append(title,status);row.append(info);
      if(job.state!=='saving')row.append(button('重试','',async()=>{await message({action:'library-queue-retry',id:job.id});await renderQueue();}));
      list.append(row);
    }
  }
  $('#queue-more').onclick=()=>{queueSize+=20;renderQueue().catch(e=>notice(e.message));};
  async function render(){
    imageObserver.disconnect();for(const url of objectURLs)URL.revokeObjectURL(url);objectURLs.clear();$('#grid').replaceChildren();
    const search=$('#search').value.trim().toLowerCase(),state=$('#state').value;
    const list=entries.filter(e=>(state==='all'||e.state===state)&&(!search||[e.author,e.id,e.href,...e.tags].join(' ').toLowerCase().includes(search)));
    $('#results').textContent=list.length+' 条收藏';$('#empty').hidden=list.length>0;$('#more').hidden=list.length<=pageSize;
    if(!list.length&&entries.length){$('#empty b').textContent='没有匹配的收藏';$('#empty p').textContent='试试其他作者、标签或处理状态。';}
    else{$('#empty b').textContent='从第一张图开始。';$('#empty p').textContent='在拾图中点赞或点「收下」，整组原图和来源会后台保存。';}
    for(const entry of list.slice(0,pageSize)){
      const card=document.createElement('article');card.className='card';card.dataset.id=entry.id;card.classList.toggle('focused',location.hash==='#'+entry.id);
      const covers=document.createElement('div');covers.className='covers'+(entry.photos.length===1?' single':'');
      for(const [index,photo]of entry.photos.entries()){
        const b=button('', '',async()=>{const asset=await XIFLibrary.read('assets',photo.hash);if(!asset)throw Error('原图文件缺失');if(selected?.url)URL.revokeObjectURL(selected.url);selected={entry,photo,url:URL.createObjectURL(asset.blob)};$('#preview img').src=selected.url;$('#preview').showModal();});
        const img=new Image();img.alt=photo.alt;img.loading='lazy';const badge=document.createElement('span');badge.textContent=(index+1)+'/'+entry.photos.length;b.append(img,badge);covers.append(b);
        img.dataset.hash=photo.hash;imageObserver.observe(img);
      }
      const meta=document.createElement('div');meta.className='meta';const top=document.createElement('div');top.className='meta-top';
      const author=document.createElement(entry.authorURL?'a':'span');author.className='author';author.textContent=entry.author;if(entry.authorURL){author.href=entry.authorURL;author.target='_blank';author.rel='noopener noreferrer';}
      const source=document.createElement('a');source.className='source';source.textContent='原推文';source.href=entry.href;source.target='_blank';source.rel='noopener noreferrer';top.append(author,source);
      const date=document.createElement('p');date.className='date';date.textContent=new Date(entry.createdAt).toLocaleDateString('zh-CN')+' · '+entry.photos.length+' 张原图';
      const stateLine=document.createElement('div');stateLine.className='state-line';const statePill=document.createElement('span');statePill.className='state-pill';statePill.textContent=entry.state==='sent'?'已发送 · 你确认':entry.state==='copied'?'已复制，待发送':'待处理';stateLine.append(statePill,document.createTextNode('复制 '+entry.photos.filter(p=>p.copiedAt).length+'/'+entry.photos.length));
      const tags=document.createElement('div');tags.className='tags';const field=document.createElement('input');field.value=entry.tags.join('，');field.placeholder='标签：角色、摄影、参考…';field.setAttribute('aria-label','编辑 '+entry.id+' 的标签');tags.append(field,button('保存标签','',async()=>{await message({action:'library-edit',id:entry.id,patch:{tags:field.value}});notice('标签已保存');await refresh();}));
      const actions=document.createElement('div');actions.className='actions';actions.append(button(entry.photos.length>1?'复制整组':'复制 PNG','primary',()=>copy(entry)),button('导出原图','',()=>exportPhotos(entry)),button(entry.state==='sent'?'重新处理':'我已发送','confirm-sent',async()=>{await message({action:'library-edit',id:entry.id,patch:{state:entry.state==='sent'?'saved':'sent'}});await refresh();}),button('移除','remove',async()=>{if(!confirm('移除这条本地收藏？不影响 X 的点赞或书签，共用原图会保留。'))return;await message({action:'library-delete',id:entry.id});await refresh();}));
      meta.append(top,date,stateLine,tags,actions);card.append(covers,meta);$('#grid').append(card);
    }
    cloudPills(driveState);
  }
  $('#home').onclick=$('#empty-home').onclick=()=>chrome.tabs.create({url:'https://x.com/home'});
  $('#search').oninput=()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{pageSize=50;render();},120);};
  $('#state').onchange=()=>{pageSize=50;render();};$('#more').onclick=()=>{pageSize+=50;render();};
  $('#export').onclick=async()=>{if(busy)return;busy=true;$('#export').disabled=true;try{
    const assets=await XIFLibrary.all('assets'),suffix=new Map(assets.map(a=>[a.hash,extension(a.mime)]));
    const metadata={format:'xif-library-v1',version:'2.4.0-lab.10',exportedAt:new Date().toISOString(),entries:(await XIFLibrary.all('entries')).map(e=>({...e,photos:e.photos.map(p=>({...p,file:'images/'+p.hash+'.'+suffix.get(p.hash)}))}))};
    const files=[{name:'collection.json',blob:new Blob([JSON.stringify(metadata,null,2)],{type:'application/json'})},...assets.map(a=>({name:'images/'+a.hash+'.'+extension(a.mime),blob:a.blob}))];
    await download(await XIFZip.zip(files),'XIF-collection-'+new Date().toISOString().slice(0,10)+'.zip');notice('收藏 ZIP 导出已开始，包含原图与出处清单');
  }catch(e){notice(e.message);}finally{busy=false;$('#export').disabled=false;}};
  $('#close-preview').onclick=()=>$('#preview').close();
  $('#preview').addEventListener('close',()=>{$('#preview img').removeAttribute('src');$('#preview img').classList.remove('zoomed');if(selected?.url)URL.revokeObjectURL(selected.url);selected=null;});
  $('#preview img').ondblclick=()=>$('#preview img').classList.toggle('zoomed');$('#preview img').title='双击查看原尺寸，再双击适应窗口';
  $('#copy-preview').onclick=()=>copy(selected.entry,[selected.photo]).catch(e=>notice(e.message));
  $('#download-preview').onclick=()=>exportPhotos(selected.entry,[selected.photo]).catch(e=>notice(e.message));
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!changes.collectorRevision)return;const type=changes.collectorRevision.newValue?.type;if(type==='drive-change'){clearTimeout(driveTimer);driveTimer=setTimeout(()=>renderDrive().catch(e=>notice(e.message)),150);}if(type==='queue-change'){clearTimeout(queueTimer);queueTimer=setTimeout(()=>renderQueue().catch(e=>notice(e.message)),150);}if(type==='library-change'){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh().catch(e=>notice(e.message)),150);}});
  addEventListener('pagehide',()=>{for(const url of objectURLs)URL.revokeObjectURL(url);if(selected?.url)URL.revokeObjectURL(selected.url);});
  refresh().catch(e=>notice('收藏库读取失败：'+e.message));
})();
