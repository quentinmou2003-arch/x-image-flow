/* Drive v3 client: credentials stay in the worker; upload IDs are saved before writes. */
(function(scope){
  'use strict';
  const BASE='https://www.googleapis.com/drive/v3/',FIELDS='id,size,sha256Checksum,trashed,mimeType,appProperties';
  class DriveError extends Error{constructor(message,code='retry'){super(message);this.code=code;}}
  const id=value=>{if(typeof value!=='string'||!/^[\w-]{1,200}$/.test(value))throw new DriveError('云端文件编号无效','invalid');return value;};
  function allowed(value){const url=new URL(value);if(url.origin!=='https://www.googleapis.com'||!/^\/(?:upload\/)?drive\/v3\//.test(url.pathname)||url.username||url.password)throw new DriveError('拒绝异常的云端上传地址','invalid');return url.href;}
  async function digest(blob){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');}
  class DriveClient{
    constructor({token,fetcher=fetch,guard=async()=>{},invalidate=async()=>{},signal}){Object.assign(this,{token,guard,invalidate,signal});this.fetcher=fetcher.bind(scope);}
    async request(url,options={},accept=[]){
      await this.guard();
      const target=allowed(url),controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,25000);this.signal?.addEventListener('abort',abort,{once:true});if(this.signal?.aborted)abort();
      let response;try{response=await this.fetcher(target,{...options,headers:{...options.headers,Authorization:'Bearer '+this.token},credentials:'omit',redirect:'error',signal:controller.signal});}catch{throw new DriveError('云盘网络中断，稍后继续上传');}finally{clearTimeout(timer);this.signal?.removeEventListener('abort',abort);}
      await this.guard();
      if(response.ok||accept.includes(response.status))return response;
      if(response.status===401){await this.invalidate();throw new DriveError('Google 授权已失效，请重新连接','auth');}
      let reason='';try{reason=(await response.json()).error?.errors?.[0]?.reason||'';}catch{}
      if(reason==='storageQuotaExceeded')throw new DriveError('Google Drive 空间不足，请清理空间后重试','quota');
      if(response.status===429||['rateLimitExceeded','userRateLimitExceeded'].includes(reason))throw new DriveError('Google 暂时限流，将稍后重试');
      if(response.status===403)throw new DriveError('Google 拒绝访问，请检查 Drive API、授权范围与账号','auth');
      throw new DriveError('云盘请求失败 ('+response.status+')');
    }
    async json(url,options={},accept=[]){const r=await this.request(url,options,accept);return r.status===404?null:r.json();}
    async account(){const result=await this.json(BASE+'about?fields=user(permissionId,emailAddress,displayName)');if(!result.user?.permissionId)throw new DriveError('无法确认云盘账号','auth');return {id:id(result.user.permissionId),email:String(result.user.emailAddress||''),name:String(result.user.displayName||'Google 用户')};}
    async generateId(){const value=await this.json(BASE+'files/generateIds?count=1&space=drive&type=files');return id(value.ids?.[0]);}
    async file(fileId){return this.json(BASE+'files/'+id(fileId)+'?fields='+encodeURIComponent(FIELDS),{},[404]);}
    async folder(ref,persist){
      if(!ref.fileId){
        const q="trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='xifKind' and value='root-v1' }";
        const found=await this.json(BASE+'files?spaces=drive&pageSize=100&fields=files(id)&q='+encodeURIComponent(q));
        ref.fileId=found.files?.[0]?.id||await this.generateId();await persist(ref);
      }
      const old=await this.file(ref.fileId);
      if(old){if(old.trashed||old.mimeType!=='application/vnd.google-apps.folder'||old.appProperties?.xifKind!=='root-v1')throw new DriveError('拾图云端目录已删除或改变，请恢复该目录后重试','folder');return ref.fileId;}
      await this.json(BASE+'files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:ref.fileId,name:'拾图 · 原图库',mimeType:'application/vnd.google-apps.folder',appProperties:{xifKind:'root-v1'}})},[409]);
      const created=await this.file(ref.fileId);if(!created||created.trashed||created.mimeType!=='application/vnd.google-apps.folder')throw new DriveError('云端目录尚未确认');return ref.fileId;
    }
    verify(file,blob,hash){
      if(!file||file.trashed)return false;
      if(Number(file.size)!==blob.size||file.sha256Checksum?.toLowerCase()!==hash||file.appProperties?.xifHash!==hash)throw new DriveError('云端文件校验不一致，请重试或检查文件是否被改动','integrity');
      return true;
    }
    async upload({blob,hash,name,parent,ref,persist}){
      if(!/^[a-f0-9]{64}$/.test(hash)||!blob.size)throw new DriveError('待上传原图无效','invalid');
      if(!ref.fileId){
        const q="trashed = false and '"+id(parent)+"' in parents and appProperties has { key='xifHash' and value='"+hash+"' }";
        const found=await this.json(BASE+'files?spaces=drive&pageSize=100&fields=files(id)&q='+encodeURIComponent(q));
        ref.fileId=found.files?.[0]?.id||await this.generateId();await persist(ref);
      }
      const existing=await this.file(ref.fileId);
      if(existing){if(existing.trashed)throw new DriveError('云端原图已在回收站，请恢复后重试','integrity');if(this.verify(existing,blob,hash)){ref.complete=true;ref.session='';await persist(ref);return ref.fileId;}}
      let offset=0;
      if(ref.session){
        const probe=await this.request(ref.session,{method:'PUT',headers:{'Content-Range':'bytes */'+blob.size}},[308,404,410]);
        if(probe.ok){const done=await this.file(ref.fileId);if(!this.verify(done,blob,hash))throw new DriveError('云端文件尚未确认');ref.session='';ref.complete=true;await persist(ref);return ref.fileId;}
        if(probe.status===308)offset=this.offset(probe,blob.size);else{ref.session='';await persist(ref);}
      }
      if(!ref.session){
        const start=await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields='+encodeURIComponent(FIELDS),{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':blob.type||'application/octet-stream','X-Upload-Content-Length':String(blob.size)},body:JSON.stringify({id:ref.fileId,name,parents:[id(parent)],appProperties:{xifHash:hash,xifKind:'original-v1'}})},[409]);
        if(start.status===409){const done=await this.file(ref.fileId);if(this.verify(done,blob,hash))return ref.fileId;throw new DriveError('文件已存在但尚未确认');}
        ref.session=allowed(start.headers.get('Location'));await persist(ref);offset=0;
      }
      while(offset<blob.size){
        const end=Math.min(blob.size,offset+4*1024*1024);
        const result=await this.request(ref.session,{method:'PUT',headers:{'Content-Type':blob.type||'application/octet-stream','Content-Range':`bytes ${offset}-${end-1}/${blob.size}`},body:blob.slice(offset,end)},[308,404,410]);
        if(result.status===404||result.status===410){ref.session='';await persist(ref);throw new DriveError('上传会话已过期，将重新开始');}
        if(result.status===308){const next=this.offset(result,blob.size);if(next<=offset||next>end)throw new DriveError('云端上传进度异常');offset=next;ref.offset=offset;await persist(ref);continue;}
        const done=await this.file(ref.fileId);if(!this.verify(done,blob,hash))throw new DriveError('云端文件尚未确认');ref.complete=true;ref.session='';ref.offset=blob.size;await persist(ref);return ref.fileId;
      }
      throw new DriveError('云端未确认完整文件，请重试');
    }
    offset(response,size){const range=response.headers.get('Range');if(!range)return 0;const match=range.match(/^bytes=0-(\d+)$/);const n=match?Number(match[1])+1:NaN;if(!Number.isSafeInteger(n)||n<0||n>size)throw new DriveError('云端上传进度无效');return n;}
  }
  scope.XIFDrive={DriveClient,DriveError,digest,allowed};if(typeof module!=='undefined')module.exports=scope.XIFDrive;
})(globalThis);
