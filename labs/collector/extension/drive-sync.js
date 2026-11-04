(function(scope){
  'use strict';
  const KEY='xif-drive-config-v1',SCOPE='https://www.googleapis.com/auth/drive.file';
  const suffix=mime=>({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'}[mime]||'bin');
  function snapshot(entry){return {format:'xif-drive-entry-v1',id:entry.id,href:entry.href,author:entry.author,authorURL:entry.authorURL,tags:entry.tags,photos:entry.photos.map(p=>({hash:p.hash,url:p.url,alt:p.alt}))};}
  class DriveSync{
    constructor({store,chrome,changed=async()=>{},fetcher=fetch,now=()=>Date.now()}){Object.assign(this,{store,chrome,changed,fetcher,now});this.running=null;this.token='';this.epoch=0;this.controller=new AbortController();this.lock=Promise.resolve();this.settings=Promise.resolve();}
    serial(work){const p=this.lock.then(work,work);this.lock=p.catch(()=>{});return p;}
    configured(){return /^[\w.-]+\.apps\.googleusercontent\.com$/.test(this.chrome.runtime.getManifest().oauth2?.client_id||'');}
    async config(){return (await this.chrome.storage.local.get(KEY))[KEY]||{enabled:false};}
    setConfig(value,epoch=this.epoch){const task=this.settings.catch(()=>{}).then(async()=>{if(epoch!==this.epoch)throw new scope.XIFDrive.DriveError('同步已暂停','paused');await this.chrome.storage.local.set({[KEY]:value});});this.settings=task.catch(()=>{});return task;}
    async notify(){try{await this.changed('drive-change');}catch{}}
    async getToken(interactive=false){
      if(!this.configured())throw new scope.XIFDrive.DriveError('请先运行安装包中的「配置 Google Drive.cmd」填写应用客户端 ID','setup');
      try{const value=await this.chrome.identity.getAuthToken({interactive,scopes:[SCOPE],enableGranularPermissions:true});if(!value.token||value.grantedScopes&&!value.grantedScopes.includes(SCOPE))throw Error();this.token=value.token;return value.token;}catch{throw new scope.XIFDrive.DriveError('请点击连接 Google Drive 完成授权','auth');}
    }
    client(token,epoch,account){return new scope.XIFDrive.DriveClient({token,fetcher:this.fetcher,signal:this.controller.signal,invalidate:()=>this.chrome.identity.removeCachedAuthToken({token}),guard:async()=>{const config=await this.config();if(this.epoch!==epoch||account&&(!config.enabled||config.account?.id!==account))throw new scope.XIFDrive.DriveError('同步已暂停','paused');}});}
    async connect(){
      if(this.running||this.connecting)throw Error('上一轮同步或授权正在结束，请稍候再连接');
      this.connecting=true;
      try{
      const epoch=++this.epoch;this.controller.abort();this.controller=new AbortController();
      const token=await this.getToken(true),client=this.client(token,epoch),account=await client.account(),old=await this.config();
      if(old.account&&old.account.id!==account.id)throw new scope.XIFDrive.DriveError('当前 Google 账号与上次不同，请先断开连接，再连接新账号','auth');
      await this.setConfig({enabled:true,paused:false,account,root:old.root||{},error:'',connectedAt:this.now()},epoch);
      // A worker may have ended between an upload and its local receipt.
      for(const job of await this.store.driveJobs(account.id,['uploading','failed']))await this.store.putDrive('driveJobs',{...job,state:'pending',nextAt:0,attempts:0,error:''});
      for(const entry of await this.store.all('entries'))await this.enqueue(entry.id);
      await this.notify();return this.status();
      }finally{this.connecting=false;}
    }
    async disconnect(){
      ++this.epoch;this.controller.abort();await this.setConfig({enabled:false,error:'已断开；云端文件保留，本机仍可收图'});
      if(this.token){await this.chrome.identity.removeCachedAuthToken({token:this.token}).catch(()=>{});this.token='';}
      await this.notify();return {ok:true};
    }
    async enqueue(entryId){return this.serial(async()=>{
      const config=await this.config();if(!config.enabled||!config.account)return;
      const entry=await this.store.read('entries',entryId);if(!entry?.photos.length)return;
      const data=snapshot(entry),revision=await scope.XIFDrive.digest(new Blob([JSON.stringify(data)])),id=config.account.id+':'+entry.id+':'+revision;
      if(await this.store.read('driveJobs',id))return;
      await this.store.putDrive('driveJobs',{id,entryId:entry.id,account:config.account.id,revision,data,state:'pending',attempts:0,nextAt:0,error:'',done:0,createdAt:this.now()});
    });}
    async retry(id){
      const config=await this.config(),job=await this.store.read('driveJobs',id);if(!config.enabled||job?.account!==config.account?.id)throw Error('请先连接对应的 Google 账号');
      if(job.state==='uploading'||job.state==='synced')return;
      await this.setConfig({...config,paused:false,error:''});await this.store.putDrive('driveJobs',{...job,state:'pending',nextAt:0,attempts:0,error:''});await this.notify();
    }
    async status(){const c=await this.config();const jobs=c.account?await this.store.driveJobs(c.account.id,['pending','uploading','failed','synced']):[];return {configured:this.configured(),enabled:c.enabled,paused:!!c.paused,account:c.account?{name:c.account.name,email:c.account.email}:null,folder:c.root?.fileId?'https://drive.google.com/drive/folders/'+c.root.fileId:'',error:c.error||'',jobs:jobs.map(j=>({id:j.id,entryId:j.entryId,state:j.state,error:j.error,done:j.done,total:j.data.photos.length,createdAt:j.createdAt}))};}
    pump(){if(this.connecting)return Promise.resolve();if(this.running)return this.running;this.running=this.drain().finally(()=>{this.running=null;});return this.running;}
    async drain(){
      let config=await this.config();if(!config.enabled||config.paused||!config.account)return;
      const active=await this.store.driveJobs(config.account.id,['pending','uploading']);if(!active.some(j=>j.state==='uploading'||j.nextAt<=this.now()))return;
      const epoch=this.epoch,account=config.account.id;
      try{
        const client=this.client(await this.getToken(false),epoch,account),actual=await client.account();
        if(actual.id!==account)throw new scope.XIFDrive.DriveError('检测到 Google 账号变化，请断开后重新连接','auth');
        for(const job of await this.store.driveJobs(account,['uploading']))await this.store.putDrive('driveJobs',{...job,state:'pending',nextAt:0});
        const root=config.root||{};await client.folder(root,async value=>{await client.guard();config=await this.config();await this.setConfig({...config,root:value},epoch);});
        while(true){
          await client.guard();const job=(await this.store.driveJobs(account,['pending'])).filter(j=>j.nextAt<=this.now()).sort((a,b)=>a.createdAt-b.createdAt)[0];if(!job)break;
          if(!await this.store.read('entries',job.entryId)){await this.store.putDrive('driveJobs',{...job,state:'failed',error:'本机收藏已移除',nextAt:0});continue;}
          await this.store.putDrive('driveJobs',{...job,state:'uploading',attempts:job.attempts+1,error:''});await this.notify();
          try{
            const photos=[];
            for(const [i,photo]of job.data.photos.entries()){
              await client.guard();const asset=await this.store.read('assets',photo.hash);if(!asset)throw new scope.XIFDrive.DriveError('本机原图已缺失，请重新收下','missing');
              const fileId=await this.upload(client,account,root.fileId,asset.blob,asset.hash,asset.hash+'.'+suffix(asset.mime));photos.push({...photo,fileId});
              job.done=i+1;await this.store.putDrive('driveJobs',{...job,state:'uploading',attempts:job.attempts+1});await this.notify();
            }
            const manifest=new Blob([JSON.stringify({...job.data,photos},null,2)],{type:'application/json'}),hash=await scope.XIFDrive.digest(manifest);
            const manifestId=await this.upload(client,account,root.fileId,manifest,hash,'推文-'+job.entryId+'-'+job.revision.slice(0,12)+'.json');
            await client.guard();await this.store.putDrive('driveJobs',{...job,state:'synced',manifestId,error:'',syncedAt:this.now(),attempts:job.attempts+1});await this.notify();
          }catch(e){
            if(this.epoch!==epoch)return;
            const attempts=job.attempts+1,stop=['auth','quota','folder','integrity','missing','invalid'].includes(e.code);
            await this.store.putDrive('driveJobs',{...job,state:stop||attempts>=5?'failed':'pending',attempts,nextAt:this.now()+Math.min(900000,60000*2**(attempts-1)),error:e.message});await this.notify();
            if(['auth','quota','folder'].includes(e.code))throw e;
          }
        }
      }catch(e){if(this.epoch===epoch){config=await this.config();await this.setConfig({...config,paused:['auth','quota','folder'].includes(e.code),error:e.message},epoch);await this.notify();}}
    }
    async upload(client,account,parent,blob,hash,name){
      const id=account+':'+hash,ref=await this.store.read('driveRecords',id)||{id,account,hash};
      return client.upload({blob,hash,name,parent,ref,persist:async value=>{await client.guard();await this.store.putDrive('driveRecords',value);}});
    }
  }
  scope.XIFDriveSync={DriveSync,snapshot,KEY};if(typeof module!=='undefined')module.exports=scope.XIFDriveSync;
})(globalThis);
