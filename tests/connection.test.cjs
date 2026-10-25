const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const roots=['extension','labs/collector/extension'];
const missing=()=>Error('Could not establish connection. Receiving end does not exist.');
function client(root,send,create){
 const state={exists:false,creates:0,contexts:0};
 const chrome={runtime:{getURL:p=>'chrome-extension://test/'+p,getContexts:async()=>{state.contexts++;return state.exists?[{}]:[];},sendMessage:send},offscreen:{createDocument:async()=>{state.exists=true;state.creates++;if(create)await create();}}};
 const context={chrome,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,5)),clearTimeout,Date:{now:()=>Date.now()*100}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',root,'offscreen-client.js'),'utf8'),context);
 return {request:context.XIFOffscreen.request,state};
}
for(const root of roots){
 test(root+': concurrent requests wait for the receiver, even when a loading context already exists',async()=>{
  let ready=false,pings=0,work=0,release;
  const gate=new Promise(resolve=>release=resolve);
  const c=client(root,async m=>{if(m.action==='ready'){pings++;if(!ready)throw missing();return {ok:true,ready:true};}work++;assert(ready);return {ok:true};},()=>gate);
  const first=c.request({action:'copy'});
  await new Promise(resolve=>setImmediate(resolve));
  assert(c.state.exists);const others=[c.request({action:'analyze'}),c.request({action:'preview'})];
  await new Promise(resolve=>setImmediate(resolve));assert.equal(work,0);assert.equal(pings,0);
  release();setTimeout(()=>ready=true,12);
  await Promise.all([first,...others]);assert.equal(c.state.creates,1);assert.equal(work,3);assert(pings>=2);
 });
 test(root+': disappearance after readiness recreates the receiver and retries only image preparation',async()=>{
  let attempts=0;
  const c=client(root,async m=>{if(m.action==='ready')return {ok:true,ready:true};if(++attempts===1){c.state.exists=false;throw missing();}return {ok:true,data:'PNG'};});
  assert.equal((await c.request({action:'copy'})).data,'PNG');assert.equal(attempts,2);assert.equal(c.state.creates,2);
 });
 test(root+': channel closure is bounded and never closes an existing document',async()=>{
  let attempts=0;
  const c=client(root,async m=>{if(m.action==='ready')return {ok:true,ready:true};attempts++;throw Error('The message port closed before a response was received.');});
  await assert.rejects(c.request({action:'preview'}),/图片处理连接未就绪/);assert.equal(attempts,2);assert.equal(c.state.creates,1);
 });
 test(root+': application failures and non-image operations are never replayed',async()=>{
  let attempts=0;
  const c=client(root,async m=>{if(m.action==='ready')return {ok:true,ready:true};attempts++;return {ok:false,error:'图片请求失败 (403)'};});
  assert.equal((await c.request({action:'copy'})).error,'图片请求失败 (403)');assert.equal(attempts,1);
  for(const action of ['batch-commit','tweet-action','library-save'])await assert.rejects(c.request({action}),/不支持恢复/);
  assert.equal(attempts,1);
  const denied=client(root,async m=>{if(m.action==='ready')return {ok:true,ready:true};throw Error('denied');});
  await assert.rejects(denied.request({action:'copy'}),/denied/);assert.equal(denied.state.contexts,1);
 });
 test(root+': silent receiver times out and the next click can recover',async()=>{
  let ready=false,work=0;
  const c=client(root,async m=>{if(m.action==='ready')return ready?{ok:true,ready:true}:new Promise(()=>{});work++;return {ok:true};});
  await assert.rejects(c.request({action:'copy'}),/图片处理连接未就绪/);assert.equal(work,0);
  ready=true;await c.request({action:'copy'});assert.equal(work,1);assert.equal(c.state.creates,1);
 });
 test(root+': readiness responds immediately while the export queue is busy and rejects other senders',()=>{
  let listener;
  const context={chrome:{runtime:{id:'test',onMessage:{addListener:f=>listener=f}}}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'..',root,'offscreen.js'),'utf8'),context);
  vm.runInContext('exportQueue = new Promise(() => {});',context);
  let result;listener({target:'offscreen',action:'ready'},{id:'test'},r=>result=r);assert.equal(result.ready,true);
  result=null;listener({target:'offscreen',action:'ready'},{id:'other'},r=>result=r);assert.equal(result,null);
 });
 test(root+': missing background and invalidated pages give actionable errors without replaying writes',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'..',root,'content.js'),'utf8');
  const block=source.slice(source.indexOf('  function disconnected('),source.indexOf('  function toast('));
  async function run(runtime){let calls=0;const context={chrome:{runtime:{id:'test',sendMessage:()=>{calls++;return runtime();}}},Error,setTimeout,clearTimeout,$:()=>({})};
   vm.createContext(context);vm.runInContext(block+';globalThis.send = message;',context);
   let error;try{await context.send({action:'batch-commit'});}catch(e){error=e;}
   assert.equal(calls,1);return error;
  }
  assert.match((await run(async()=>{throw missing();})).message,/插件后台未连接.*重新加载/);
  assert.match((await run(async()=>({ok:false,error:missing().message}))).message,/插件后台未连接/);
  assert.match((await run(async()=>{throw Error('Extension context invalidated.');})).message,/插件连接已失效/);
  assert.match((await run(async()=>{throw Error('The message port closed before a response was received.');})).message,/先确认操作结果/);
  assert.match((await run(async()=>({ok:false,error:'原始图片错误'}))).message,/原始图片错误/);
 });
}
