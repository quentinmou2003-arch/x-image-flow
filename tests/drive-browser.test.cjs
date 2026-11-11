const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const F='application/vnd.google-apps.folder',S='application/vnd.google-apps.shortcut',bytes=Buffer.from('original-test-bytes'),files=new Map([
 ['root',{id:'root',name:'拾图原图库',mimeType:F,appProperties:{xifKind:'root-v1'}}],['folder',{id:'folder',name:'流浪者',mimeType:F,parents:['root']}],['image',{id:'image',name:'作者_原文件名.png',mimeType:'image/png',size:String(bytes.length),parents:['root'],capabilities:{canDownload:true}}],['outside',{id:'outside',mimeType:'image/png',size:'4',parents:['elsewhere']}],['elsewhere',{id:'elsewhere',mimeType:F}],['link',{id:'link',name:'作者_原文件名.png',mimeType:S,parents:['folder'],shortcutDetails:{targetId:'image'}}]
 ]),storage={},calls=[],native=[],conversions=[];let config={enabled:true,account:{id:'account'},root:{fileId:'root'}},actual='account',count=0;
 const sync={epoch:0,chrome:{storage:{local:{get:async k=>({[k]:storage[k]}),set:async value=>Object.assign(storage,value)}}},config:async()=>config,getToken:async()=> 'private-test-token',client:()=>client};
 const client={guard:async()=>{if(!config.enabled||config.account.id!=='account')throw Error('同步已暂停');},account:async()=>({id:actual}),generateId:async()=> 'new'+(++count),json:async(url,o={})=>{
  calls.push({url,method:o.method||'GET',body:o.body});const u=new URL(url);
  if(o.method==='POST'){const value=JSON.parse(o.body);files.set(value.id,value);return value;}
  if(u.pathname.endsWith('/files')){const q=u.searchParams.get('q'),parent=q.match(/^'([^']+)' in parents/)?.[1],target=q.match(/key='xifTarget' and value='([^']+)'/)?.[1];return {files:[...files.values()].filter(f=>f.parents?.includes(parent)&&(!target||f.appProperties?.xifTarget===target)),nextPageToken:''};}
  const f=files.get(u.pathname.split('/').pop());if(!f)throw Error('missing');return structuredClone(f);
 },request:async url=>{calls.push({url,method:'MEDIA'});return new Response(bytes);}};
 const c={URLSearchParams,Blob,Date,Uint8Array,Map,Set,Number,String,Error,setTimeout,clearTimeout,module:{exports:{}},XIF:require('../labs/collector/extension/shared.js'),btoa:v=>Buffer.from(v,'binary').toString('base64'),XIFOffscreen:{request:async value=>{conversions.push(value);return {ok:true,data:'PNG',width:12,height:14};}},XIFNativeCopy:{prepare:async(tab,ids,mode,blend,provider,gif,names)=>{for(let i=0;i<ids.length;i++)native.push({id:ids[i],name:names[i],value:await provider(i)});return {ok:true,jobId:'test-job',count:ids.length};}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../labs/collector/extension/drive-browser.js'),'utf8'),c);return {browser:new c.XIFDriveBrowser.DriveBrowser(sync),files,calls,storage,native,conversions,bytes,sync,setConfig:v=>config=v,setActual:v=>actual=v};
}
test('cloud browser lists live Drive contents, checks root ancestry and keeps credentials out of responses',async()=>{
 const s=setup(),result=await s.browser.list();assert.equal(result.folder.id,'root');assert(result.files.some(f=>f.id==='image'));assert(!JSON.stringify(result).includes('private-test-token'));
 await assert.rejects(s.browser.list('elsewhere'),/只能管理/);await assert.rejects(s.browser.converted('outside'),/只能管理/);await assert.rejects(s.browser.list("root' or true"),/编号/);assert(!s.calls.some(c=>c.method==='MEDIA'));
});
test('cloud copy resolves in-root shortcuts, retains names/order and uses bounded transient cache',async()=>{
 const s=setup();await s.browser.converted('link',true);assert.equal(s.conversions[0].action,'local-preview');assert.equal(s.conversions[0].data,'data:image/png;base64,'+s.bytes.toString('base64'));
 const job=await s.browser.prepare(8,['link']);assert.equal(job.count,1);assert.deepEqual(s.native.map(v=>v.name),['作者_原文件名']);assert.equal(s.calls.filter(c=>c.method==='MEDIA').length,1);assert(s.browser.bytes<=64*1024*1024);await assert.rejects(s.browser.prepare(8,['link','image']),/同一原图/);s.browser.clear();assert.equal(s.browser.bytes,0);
 await assert.rejects(s.browser.prepare(8,['image','image']),/不同/);s.files.get('image').size=String(65*1024*1024);await assert.rejects(s.browser.converted('image'),/40 MB/);
});
test('manual categorization creates idempotent shortcuts without moving or renaming originals',async()=>{
 const s=setup(),before=structuredClone(s.files.get('image'));assert.equal((await s.browser.categorize(['image'],'folder')).done,1);await s.browser.categorize(['image'],'folder');const writes=s.calls.filter(c=>c.method==='POST');assert.equal(writes.length,1);assert.equal(JSON.parse(writes[0].body).shortcutDetails.targetId,'image');assert.deepEqual(s.files.get('image'),before);await assert.rejects(s.browser.categorize(['outside'],'folder'),/已归入 0\/1/);
});
test('folder rules are account scoped, validated and do not execute classification or model requests',async()=>{
 const s=setup();await s.browser.saveRule('folder','散兵、黑主、倾奇者均归入流浪者',50);assert.equal((await s.browser.rules()).rules[0].priority,50);assert.equal(s.calls.filter(c=>c.method==='POST').length,0);await assert.rejects(s.browser.saveRule('folder','x',-1),/优先级/);await s.browser.saveRule('folder','',1);assert.equal((await s.browser.rules()).rules.length,0);await assert.rejects(s.browser.create('../坏目录'),/名称/);const made=await s.browser.create('杜林');assert.equal(made.folder.name,'杜林');
 s.setConfig({enabled:false});await assert.rejects(s.browser.rules(),/连接/);assert.equal(s.browser.bytes,0);
 const mismatch=setup();mismatch.setActual('different');await assert.rejects(mismatch.browser.list(),/账号变化/);
});
