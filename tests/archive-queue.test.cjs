const test=require('node:test'),assert=require('node:assert/strict');
const Queue=require('../labs/collector/extension/archive-queue.js');
globalThis.XIF=require('../labs/collector/extension/shared.js');
const {input}=require('../labs/collector/extension/library-store.js');
const source=(id='100',count=4)=>({id,href:'https://x.com/artist/status/'+id,author:'Artist',authorURL:'https://x.com/artist',images:Array.from({length:count},(_,i)=>({url:'https://pbs.twimg.com/media/p'+i+'?format=jpg',alt:'part '+i}))});
function fixture(save){const jobs=new Map(),entries=new Map();let calls=0,clock=1000000;const store={input,all:async name=>structuredClone([...(name==='jobs'?jobs:entries).values()]),read:async(name,id)=>structuredClone((name==='jobs'?jobs:entries).get(id)),putJob:async job=>jobs.set(job.id,structuredClone(job)),save:async value=>{calls++;if(save)await save(value);entries.set(value.id,{id:value.id,photos:value.images.map(im=>({url:im.url}))});}};return {jobs,entries,store,get calls(){return calls;},get clock(){return clock;},advance:()=>clock+=1000000,queue:()=>new Queue({store,now:()=>clock})};}
test('archive queue persists descriptors first and keeps the whole album in source order',async()=>{
 const f=fixture(),q=f.queue();await q.add(source());assert.equal(f.calls,0);assert.equal(f.jobs.get('100').state,'pending');assert.equal(f.jobs.get('100').source.images.length,4);
 await q.pump();assert.equal(f.calls,1);assert.equal(f.jobs.get('100').state,'saved');assert.deepEqual(f.entries.get('100').photos.map(p=>p.url),source().images.map(im=>XIF.mediaURL(im.url)));
 await q.add(source());await q.pump();assert.equal(f.calls,1);assert.equal(f.jobs.size,1);
});
test('archive queue restart resumes an interrupted save and concurrent pumps do not duplicate work',async()=>{
 const f=fixture(),q=f.queue();await q.add(source());f.jobs.get('100').state='saving';const restarted=f.queue();await Promise.all([restarted.pump(),restarted.pump(),restarted.pump()]);assert.equal(f.calls,1);assert.equal(f.jobs.get('100').state,'saved');
});
test('failed downloads stay visible, retry with backoff and can be manually resumed after five attempts',async()=>{
 let broken=true;const f=fixture(async()=>{if(broken)throw Error('offline');}),q=f.queue();await q.add(source());
 for(let attempt=1;attempt<=5;attempt++){await q.pump();assert.equal(f.calls,attempt);assert.equal(f.entries.size,0);assert.equal(f.jobs.get('100').state,attempt===5?'failed':'pending');assert.equal(f.jobs.get('100').error,'offline');await q.pump();assert.equal(f.calls,attempt);f.advance();}
 broken=false;await q.retry('100');await q.pump();assert.equal(f.jobs.get('100').state,'saved');assert.equal(f.entries.size,1);
});
test('a failed album does not block later albums and duplicate enqueues preserve the retry cooldown',async()=>{
 const f=fixture(async value=>{if(value.id==='100')throw Error('403');}),q=f.queue();await q.add(source());await q.add(source('101'));await q.pump();
 assert.equal(f.calls,2);assert.equal(f.jobs.get('101').state,'saved');const pending=structuredClone(f.jobs.get('100'));await q.add(source());await q.pump();assert.equal(f.calls,2);assert.equal(f.jobs.get('100').nextAt,pending.nextAt);
});
test('queue validates sources before persistence and resaving a removed collection is possible',async()=>{
 const f=fixture(),q=f.queue();await assert.rejects(q.add({...source(),href:'https://evil.example/status/100'}));assert.equal(f.jobs.size,0);
 await q.add(source());await q.pump();f.entries.delete('100');await q.add(source());await q.pump();assert.equal(f.calls,2);
});
test('queue resumes safely when the files were committed just before the worker stopped',async()=>{
 const f=fixture(),q=f.queue();await q.add(source());await q.pump();f.jobs.get('100').state='saving';
 const restarted=f.queue();await restarted.pump();assert.equal(f.jobs.get('100').state,'saved');assert.equal(f.entries.size,1);
});
