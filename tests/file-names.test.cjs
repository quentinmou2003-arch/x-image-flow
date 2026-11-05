const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
for(const root of ['extension','labs/collector/extension']){
 const api=require('../'+root+'/shared.js'),group={author:'引用 · 画师 @artist',description:'雨夜街景 https://t.co/abc\n蓝色灯光',id:'1234567890123456789'};
 test(root+': names preserve real author, short post text, post ID and source image index',()=>{assert.equal(api.imageName(group,2),'画师 @artist_雨夜街景 蓝色灯光_1234567890123456789_图02');assert.match(api.imageName(group,1,true),/_拼接$/);assert.equal(api.imageName({author:'@artist',id:'123'},4),'@artist_推文_123_图04');});
 test(root+': filenames bound length and neutralize traversal, reserved devices, controls and bidi',()=>{assert.equal(api.filenamePart('CON'),'_CON');assert.equal(api.filenamePart('nul.txt'),'_nul.txt');const name=api.filenamePart('../a\\b:<x>\u202e\n?* .');assert(!/[\\/:<>?*\x00-\x1f\u202e]/.test(name));assert(!name.startsWith('.'));assert(!/[ .]$/.test(name));const long=api.imageName({...group,author:'画师'.repeat(50),description:'🌸'.repeat(100),id:'1'.repeat(30)},4);assert(long.length<=100);assert.match(long,/_图04$/);assert(!/[\ud800-\udbff]$/.test(long));});
 test(root+': validated mixed plans retain sanitized names but reject non-text metadata',()=>{const c={URL};vm.createContext(c);for(const f of ['shared.js','bulk-plan.js'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..',root,f),'utf8'),c);const item={urls:['https://pbs.twimg.com/media/test?format=png'],name:'作者/描述'};assert.equal(c.XIFBulkPlan.validate([item])[0].name,'作者_描述');assert.throws(()=>c.XIFBulkPlan.validate([{...item,name:{path:'C:/file'}}]));});
 test(root+': named copy checks helper capability before conversion and forwards filename separately',async()=>{
  let namedFiles=false,converted=0;const calls=[];
  const chrome={runtime:{connectNative(){const listeners=[];return {onMessage:{addListener:f=>listeners.push(f)},onDisconnect:{addListener(){}},disconnect(){},postMessage(m){calls.push(m);queueMicrotask(()=>listeners.forEach(f=>f({requestId:m.requestId,ok:true,maxBatchCount:20,namedFiles,count:1})));}};}},tabs:{onRemoved:{addListener(){}},sendMessage:async()=>{}}};
  const c={chrome,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',root,'native-copy.js'),'utf8'),c);
  const prepare=()=>c.XIFNativeCopy.prepare(1,['url'],undefined,false,async()=>{converted++;return {ok:true,data:'PNG'};},false,['画师_街景_123_图01']);
  await assert.rejects(prepare(),/1\.3\.0/);assert.equal(converted,0);assert(!calls.some(m=>m.op==='begin'));
  namedFiles=true;const job=await prepare();const image=calls.find(m=>m.op==='image');assert.equal(image.name,'画师_街景_123_图01');assert.equal(image.data,'PNG');await c.XIFNativeCopy.commit(1,job.jobId);
 });
}
