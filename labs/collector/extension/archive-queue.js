/* Durable local original-file queue. No cloud connection is implied by a saved job. */
(function(scope){
  'use strict';
  class ArchiveQueue {
    constructor({store,changed=async()=>{},now=()=>Date.now()}) {
      this.store=store;this.changed=changed;this.now=now;this.lock=Promise.resolve();this.running=null;
      this.ready=this.serial(async()=>{
        for(const job of await this.jobs(['saving']))await store.putJob({...job,state:'pending',nextAt:0});
      });
    }
    serial(work){const task=this.lock.then(work,work);this.lock=task.catch(()=>{});return task;}
    async jobs(states){return this.store.jobs?this.store.jobs(states):(await this.store.all('jobs')).filter(j=>states.includes(j.state));}
    async notify(type='queue-change'){try{await this.changed(type);}catch{/* Committed jobs survive a closed page. */}}
    async add(value){
      const source=this.store.input(value);
      const job=await this.serial(async()=>{
        const old=await this.store.read('jobs',source.id),entry=await this.store.read('entries',source.id);
        const same=old&&old.source.images.length===source.images.length&&old.source.images.every((p,i)=>p.url===source.images[i].url);
        if(same&&old.state!=='saved')return old;
        const saved=entry&&source.images.every(im=>entry.photos.some(p=>p.url===im.url));
        const row={id:source.id,source,state:saved?'saved':'pending',attempts:0,nextAt:0,error:'',createdAt:old?.createdAt||this.now(),updatedAt:this.now()};
        await this.store.putJob(row);return row;
      });
      await this.notify();return job;
    }
    async retry(id){
      await this.serial(async()=>{
        const job=await this.store.read('jobs',id);if(!job||job.state==='saved'||job.state==='saving')return;
        await this.store.putJob({...job,state:'pending',attempts:0,nextAt:0,error:'',updatedAt:this.now()});
      });
      await this.notify();
    }
    async list(){await this.ready;return (await this.jobs(['pending','saving','failed'])).sort((a,b)=>b.createdAt-a.createdAt);}
    pump(){
      if(this.running)return this.running;
      this.running=this.drain().finally(()=>{this.running=null;});return this.running;
    }
    async drain(){
      await this.ready;
      while(true){
        const job=await this.serial(async()=>{
          const next=(await this.jobs(['pending'])).filter(j=>j.nextAt<=this.now()).sort((a,b)=>a.createdAt-b.createdAt)[0];
          if(!next)return null;
          const row={...next,state:'saving',attempts:next.attempts+1,updatedAt:this.now()};await this.store.putJob(row);return row;
        });
        if(!job)return;
        await this.notify();
        let error='';try{await this.store.save(job.source);}catch(e){error=String(e?.message||'原图保存失败').slice(0,250);}
        await this.serial(async()=>{
          const current=await this.store.read('jobs',job.id);
          // A new media descriptor may have replaced this job while it was saving.
          if(current.state!=='saving'||JSON.stringify(current.source.images)!==JSON.stringify(job.source.images))return;
          await this.store.putJob({...job,state:error?(job.attempts>=5?'failed':'pending'):'saved',error,nextAt:error?this.now()+Math.min(900000,60000*2**(job.attempts-1)):0,updatedAt:this.now()});
        });
        await this.notify(error?'queue-change':'library-change');
      }
    }
  }
  scope.XIFArchiveQueue=ArchiveQueue;if(typeof module!=='undefined')module.exports=ArchiveQueue;
})(globalThis);
