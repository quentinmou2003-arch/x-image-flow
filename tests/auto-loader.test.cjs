const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
function clock(){let time=0,sequence=0;const timers=new Map();return {now:()=>time,setTimer:(fn,ms)=>{const id=++sequence;timers.set(id,{at:time+ms,fn});return id;},clearTimer:id=>timers.delete(id),async advance(ms){const end=time+ms;for(let i=0;i<1000;i++){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due){time=end;break;}time=due[1].at;timers.delete(due[0]);due[1].fn();await Promise.resolve();await Promise.resolve();}await Promise.resolve();},count:()=>timers.size};}
for(const folder of ['extension','labs/collector/extension']){
 const Loader=require(path.join(__dirname,'..',folder,'auto-loader.js'));
 test(folder+': primes on entry, fills only the nearby buffer and responds to wheel wakeups',async()=>{
  const c=clock();let need=false,calls=0;const loader=new Loader({...c,allowed:()=>true,needed:()=>need,load:async()=>{calls++;need=false;return {progress:true};}});
  loader.start();await c.advance(0);assert.equal(calls,1,'entry starts one source fetch even with a full buffer');await c.advance(10000);assert.equal(calls,1,'never crawl far beyond the reader');
  need=true;loader.wake();await c.advance(0);assert.equal(calls,2);loader.stop();assert.equal(c.count(),0);
 });
 test(folder+': empty responses retry automatically with capped backoff; wheel events do not bypass it',async()=>{
  const c=clock(),attempts=[];const loader=new Loader({...c,allowed:()=>true,needed:()=>true,load:async()=>{attempts.push(c.now());return {progress:false};}});
  loader.start();await c.advance(0);assert.deepEqual(attempts,[0]);
  for(let n=0;n<10;n++){loader.wake();await c.advance(100);}assert.equal(attempts.length,1);
  await c.advance(1000);assert.deepEqual(attempts,[0,2000]);await c.advance(4000);assert.deepEqual(attempts,[0,2000,6000]);
  await c.advance(120000);assert(attempts.length<10);assert(attempts.length>5);assert.equal(attempts.at(-1)-attempts.at(-2),30000);
  loader.wake(true);await c.advance(0);assert.equal(attempts.at(-1),c.now(),'explicit retry remains available');loader.stop();
 });
 test(folder+': blocked, offline or hidden views pause and later resume without a click',async()=>{
  const c=clock();let allowed=false,calls=0;const loader=new Loader({...c,allowed:()=>allowed,needed:()=>true,load:async()=>{calls++;return {progress:true};}});
  loader.start();await c.advance(4000);assert.equal(calls,0);allowed=true;await c.advance(1000);assert(calls>0);allowed=false;const old=calls;await c.advance(6000);assert.equal(calls,old);loader.stop();
 });
 test(folder+': restart cancels old work, does not overlap requests or inherit its failure backoff',async()=>{
  const c=clock();let finish,currentCheck,calls=0,active=0,max=0;
  const loader=new Loader({...c,allowed:()=>true,needed:()=>true,load:async current=>{calls++;active++;max=Math.max(max,active);if(calls===1){currentCheck=current;await new Promise(resolve=>finish=resolve);}active--;return {progress:false};}});
  loader.start();await c.advance(0);assert.equal(currentCheck(),true);loader.stop();assert.equal(currentCheck(),false);loader.start();await c.advance(0);assert.equal(calls,1);finish();await c.advance(0);await c.advance(250);assert.equal(calls,2);assert.equal(max,1);assert.equal(loader.misses,1);loader.stop();
 });
 test(folder+': thrown source errors recover; observed late content resets the cooldown',async()=>{
  const c=clock();let calls=0;const loader=new Loader({...c,allowed:()=>true,needed:()=>true,load:async()=>{calls++;throw Error('temporary source failure');}});
  loader.start();await c.advance(0);assert.equal(loader.misses,1);await c.advance(1000);assert.equal(calls,1);loader.progress();await c.advance(0);assert.equal(calls,2);loader.stop();await c.advance(100000);assert.equal(calls,2);
 });
}
