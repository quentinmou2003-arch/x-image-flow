const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
for(const root of ['extension','labs/collector/extension'])test(root+': twenty independent images are prepared sequentially; old helpers and failed images never commit',async()=>{
 let maxBatchCount=20,failAt=-1,active=0,peak=0,closed=0;const calls=[],progress=[];
 const chrome={runtime:{connectNative(){const listeners=[];return {onMessage:{addListener:f=>listeners.push(f)},onDisconnect:{addListener(){}},disconnect(){closed++;},postMessage(m){calls.push(m);queueMicrotask(()=>listeners.forEach(f=>f({...m,ok:!(m.op==='image'&&m.index===failAt),error:'image failed',maxBatchCount,count:20})));}};}},tabs:{onRemoved:{addListener(){}},sendMessage:async(id,m)=>progress.push({id,...m})}};
 const context={chrome,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,XIFOffscreen:{async request(m){active++;peak=Math.max(peak,active);await Promise.resolve();active--;return {ok:true,data:m.urls[0]};}}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',root,'native-copy.js'),'utf8'),context);
 const api=context.XIFNativeCopy,urls=Array.from({length:20},(_,i)=>'url'+i),job=await api.prepare(7,urls);
 assert.equal(peak,1);assert.deepEqual(calls.filter(m=>m.op==='image').map(m=>m.data),urls);assert.equal(progress.length,20);assert.equal(progress.at(-1).done,20);assert.equal(calls.some(m=>m.op==='commit'),false);
 await assert.rejects(api.commit(8,job.jobId),/失效/);assert.equal((await api.commit(7,job.jobId)).count,20);assert.equal(closed,1);
 maxBatchCount=4;const before=calls.filter(m=>m.op==='begin').length;await assert.rejects(api.prepare(7,urls),/更新小助手/);assert.equal(calls.filter(m=>m.op==='begin').length,before);
 maxBatchCount=20;failAt=5;await assert.rejects(api.prepare(7,urls),/image failed/);assert.equal(calls.filter(m=>m.op==='commit').length,1);assert.equal(closed,3);
});
