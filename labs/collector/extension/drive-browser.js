/* Cloud access stays in the worker. Only this app's root and descendants are exposed. */
(function(scope){
 'use strict';
 const BASE='https://www.googleapis.com/drive/v3/',FOLDER='application/vnd.google-apps.folder',SHORTCUT='application/vnd.google-apps.shortcut',MAX=40*1024*1024;
 const fields='id,name,mimeType,size,parents,trashed,appProperties,shortcutDetails,capabilities(canDownload)',valid=id=>{if(typeof id!=='string'||!/^[-\w]{1,200}$/.test(id))throw Error('文件编号无效');return id;};
 class DriveBrowser{
  constructor(sync){this.sync=sync;this.cache=new Map();this.bytes=0;this.session=null;this.rulesLock=Promise.resolve();}
  clear(){this.cache.clear();this.bytes=0;this.session=null;}
  async context(){
   const config=await this.sync.config();if(!config.enabled||!config.account) {this.clear();throw Error('请先连接 Google Drive');}
   if(!config.root?.fileId)throw Error('原图库尚未创建，请等待首次上传完成');
   const key=config.account.id+':'+this.sync.epoch+':'+config.root.fileId;
   if(this.session?.key===key&&Date.now()-this.session.time<60000){await this.session.client.guard();return this.session;}
   this.clear();const client=this.sync.client(await this.sync.getToken(false),this.sync.epoch,config.account.id),actual=await client.account();if(actual.id!==config.account.id)throw Error('Google 账号变化，请重新连接');
   const root=valid(config.root.fileId),meta=await this.meta(client,root);if(meta.trashed||meta.mimeType!==FOLDER||meta.appProperties?.xifKind!=='root-v1')throw Error('找不到拾图原图库');
   this.session={key,client,root,account:config.account.id,time:Date.now()};return this.session;
  }
  async meta(client,id){return client.json(BASE+'files/'+valid(id)+'?fields='+encodeURIComponent(fields));}
  async inside(c,id){
   let file=await this.meta(c.client,id),current=file;const seen=new Set();
   for(let depth=0;depth<12;depth++){
    if(current.trashed)break;if(current.id===c.root)return file;
    if(seen.has(current.id)||!current.parents?.length)break;seen.add(current.id);current=await this.meta(c.client,current.parents[0]);
   }throw Error('只能管理拾图原图库中的文件');
  }
  async list(folder,pageToken){
   const c=await this.context(),id=folder?valid(folder):c.root,meta=await this.inside(c,id);if(meta.mimeType!==FOLDER)throw Error('请选择文件夹');
   if(pageToken!==undefined&&(typeof pageToken!=='string'||pageToken.length>2000))throw Error('分页无效');
   const params=new URLSearchParams({q:"'"+id+"' in parents and trashed = false and (mimeType contains 'image/' or mimeType = '"+FOLDER+"' or mimeType = '"+SHORTCUT+"')",pageSize:'50',orderBy:'folder,name',fields:'nextPageToken,files('+fields+')'});if(pageToken)params.set('pageToken',pageToken);
   const result=await c.client.json(BASE+'files?'+params);await c.client.guard();
   return {ok:true,root:c.root,folder:{id:meta.id,name:meta.name},nextPageToken:result.nextPageToken||'',files:(result.files||[]).map(f=>({id:f.id,name:f.name,mimeType:f.mimeType,size:Number(f.size)||0,folder:f.mimeType===FOLDER,shortcut:f.mimeType===SHORTCUT}))};
  }
  async image(c,id){
   let file=await this.inside(c,valid(id));if(file.mimeType===SHORTCUT){file=await this.inside(c,valid(file.shortcutDetails?.targetId));}
   if(!['image/png','image/jpeg','image/webp','image/avif','image/gif'].includes(file.mimeType)||file.capabilities?.canDownload===false)throw Error('这不是可读取的图片');
   if(!Number.isSafeInteger(Number(file.size))||Number(file.size)<1||Number(file.size)>MAX)throw Error('原图超过 40 MB，请在 Drive 单独处理');
   const key=c.key+':'+file.id,cached=this.cache.get(key);let blob;
   if(cached&&Date.now()-cached.time<120000)blob=cached.blob;
   else{
    const response=await c.client.request(BASE+'files/'+valid(file.id)+'?alt=media');
    const length=Number(response.headers.get('Content-Length'));if(length>MAX)throw Error('原图超过读取限制');
    const reader=response.body.getReader(),parts=[];let size=0,timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('原图读取超时，请重试')),30000);});
    try{while(true){const r=await Promise.race([reader.read(),timeout]);if(r.done)break;size+=r.value.length;if(size>MAX)throw Error('原图超过读取限制');parts.push(r.value);}}finally{clearTimeout(timer);await reader.cancel().catch(()=>{});}
    if(size!==Number(file.size))throw Error('原图读取不完整，请重试');blob=new Blob(parts,{type:file.mimeType});await c.client.guard();
    if(cached){this.bytes-=cached.blob.size;this.cache.delete(key);}while(this.bytes+blob.size>64*1024*1024&&this.cache.size){const first=this.cache.keys().next().value;this.bytes-=this.cache.get(first).blob.size;this.cache.delete(first);}this.cache.set(key,{blob,time:Date.now()});this.bytes+=blob.size;
   }await c.client.guard();return {file,blob};
  }
  async converted(id,preview=false,large=false){
   const c=await this.context(),{file,blob}=await this.image(c,id),bytes=new Uint8Array(await blob.arrayBuffer()),parts=[];
   for(let offset=0;offset<bytes.length;offset+=32768)parts.push(String.fromCharCode(...bytes.subarray(offset,offset+32768)));
   const result=await scope.XIFOffscreen.request({action:preview?'local-preview':'local-copy',edge:large?1600:640,data:'data:'+blob.type+';base64,'+btoa(parts.join(''))});await c.client.guard();if(!result?.ok)throw Error(result?.error||'图片转换失败');return {...result,name:file.name};
  }
  async prepare(tabId,ids){
   if(!Array.isArray(ids)||!ids.length||ids.length>20||new Set(ids).size!==ids.length)throw Error('请选择 1–20 张不同的图片');ids.forEach(valid);
   const c=await this.context(),names=[],targets=new Set();for(const id of ids){let f=await this.inside(c,id);if(f.mimeType===SHORTCUT)f=await this.inside(c,valid(f.shortcutDetails?.targetId));if(targets.has(f.id))throw Error('选择中包含同一原图的多个入口，请保留其中一个');targets.add(f.id);names.push(scope.XIF.filenamePart(f.name.replace(/\.[^.]+$/,'')));}
   return scope.XIFNativeCopy.prepare(tabId,ids,undefined,false,async i=>{await c.client.guard();const result=await this.converted(ids[i]);await c.client.guard();return result;},false,names);
  }
  async create(name){
   if(typeof name!=='string'||!name.trim()||name.length>80||/[\\/\x00-\x1f]/.test(name))throw Error('文件夹名称应为 1–80 字，不能含路径字符');
   const c=await this.context(),id=await c.client.generateId();const file=await c.client.json(BASE+'files?fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,name:name.trim(),mimeType:FOLDER,parents:[c.root],appProperties:{xifKind:'category-v1'}})});return {ok:true,folder:file};
  }
  rulesKey(c){return 'xif-folder-rules:'+c.account+':'+c.root;}
  async rules(){const c=await this.context(),key=this.rulesKey(c);return {ok:true,rules:(await this.sync.chrome.storage.local.get(key))[key]||[]};}
  saveRule(folder,text,priority){
   const work=this.rulesLock.catch(()=>{}).then(async()=>{if(typeof text!=='string'||text.length>2000||!Number.isSafeInteger(priority)||priority<0||priority>999)throw Error('规则最多 2000 字，优先级为 0–999');const c=await this.context(),file=await this.inside(c,valid(folder));if(file.mimeType!==FOLDER||file.id===c.root)throw Error('请选择分类文件夹');const key=this.rulesKey(c),rules=(await this.sync.chrome.storage.local.get(key))[key]||[],next=rules.filter(r=>r.folder!==folder);if(text.trim())next.push({folder,name:file.name,text:text.trim(),priority,updatedAt:Date.now()});if(next.length>200)throw Error('最多保存 200 条规则');await c.client.guard();await this.sync.chrome.storage.local.set({[key]:next});return {ok:true};});this.rulesLock=work;return work;
  }
  async categorize(ids,folder){
   if(!Array.isArray(ids)||!ids.length||ids.length>20||new Set(ids).size!==ids.length)throw Error('每次可归入 1–20 张图');ids.forEach(valid);const c=await this.context(),target=await this.inside(c,valid(folder));if(target.mimeType!==FOLDER||target.id===c.root)throw Error('请选择分类文件夹');let done=0;
   try{for(const id of ids){let f=await this.inside(c,id);if(f.mimeType===SHORTCUT)f=await this.inside(c,valid(f.shortcutDetails?.targetId));if(!f.mimeType.startsWith('image/'))throw Error('仅支持图片');const q="'"+target.id+"' in parents and trashed = false and mimeType = '"+SHORTCUT+"' and appProperties has { key='xifTarget' and value='"+valid(f.id)+"' }",found=await c.client.json(BASE+'files?'+new URLSearchParams({q,fields:'files(id)',pageSize:'1'}));if(!found.files?.length)await c.client.json(BASE+'files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:await c.client.generateId(),name:f.name,mimeType:SHORTCUT,parents:[target.id],shortcutDetails:{targetId:f.id},appProperties:{xifTarget:f.id}})});done++;}return {ok:true,done};}catch(e){throw Error('已归入 '+done+'/'+ids.length+' 张；'+e.message+'。可重试，已存在的快捷方式会跳过');}
  }
 }
 scope.XIFDriveBrowser={DriveBrowser};if(typeof module!=='undefined')module.exports=scope.XIFDriveBrowser;
})(globalThis);
