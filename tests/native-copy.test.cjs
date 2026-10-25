const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('native batches are atomic, ordered, owner-bound and discarded after failures',async()=>{
 const operations=[],exports=[],ports=[];let failImage=false;
 const chrome={runtime:{connectNative:()=>{const listeners=[];const p={onMessage:{addListener:f=>listeners.push(f)},onDisconnect:{addListener:()=>{}},closed:false,disconnect(){this.closed=true},postMessage(m){operations.push(m.op);queueMicrotask(()=>listeners.forEach(f=>f({...m,ok:!(failImage&&m.op==='image'),count:2,error:'image failed'})))} };ports.push(p);return p;},sendMessage:async m=>{exports.push(m.urls);return {ok:true,data:'PNG'}}},tabs:{onRemoved:{addListener:()=>{}}}};
 const context={chrome,crypto:require('node:crypto').webcrypto,XIFOffscreen:{request:m=>chrome.runtime.sendMessage(m)},setTimeout,clearTimeout,Map,Promise,Error};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/native-copy.js'),'utf8'),context);
 const api=context.XIFNativeCopy,prepared=await api.prepare(1,['a','b']);
 assert.equal(operations.includes('commit'),false);assert.deepEqual(JSON.parse(JSON.stringify(exports)),[['a'],['b']]);
 await assert.rejects(api.commit(2,prepared.jobId),/失效/);assert.equal(ports[0].closed,false);
 await assert.rejects(api.prepare(2,['c','d']),/上一组/);
 assert.equal((await api.commit(1,prepared.jobId)).count,2);assert(ports[0].closed);
 failImage=true;await assert.rejects(api.prepare(1,['c','d']),/image failed/);assert(ports[1].closed);
 assert.equal(operations.filter(o=>o==='commit').length,1,'failed preparation never commits');
 failImage=false;const slice=await api.prepare(1,['left','right'],'horizontal',true);assert.deepEqual(JSON.parse(JSON.stringify(exports.at(-1))),['left','right']);api.abort(1,slice.jobId);assert(ports[2].closed);
 const retry=await api.prepare(1,['a','b']);api.abort(1,retry.jobId);assert(ports[3].closed);
});
