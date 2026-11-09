const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib'),{spawn,spawnSync}=require('node:child_process'),vm=require('node:vm');
const {crc32}=require('../labs/collector/extension/archive-zip.js');
function png(width,height){
 const chunk=(type,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b;};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(Buffer.alloc((width*4+1)*height))),chunk('IEND',Buffer.alloc(0))]);
}
test('Windows helper accepts 20 unchanged PNGs above 100 million combined pixels and still rejects oversized individuals',{skip:process.platform!=='win32',timeout:30000},async()=>{
 const stable=fs.readFileSync(path.join(__dirname,'../extension/native/host.cs'));
 assert.deepEqual(fs.readFileSync(path.join(__dirname,'../labs/collector/extension/native/host.cs')),stable);
 const cache=process.env.XIF_TEST_TEMP||path.join(path.parse(process.cwd()).root,'codex','test-cache','x-image-flow');fs.mkdirSync(cache,{recursive:true});const dir=fs.mkdtempSync(path.join(cache,'native-pixels-')),exe=path.join(dir,'host.exe');
 const compiler=['Framework64','Framework'].map(v=>path.join(process.env.WINDIR,'Microsoft.NET',v,'v4.0.30319','csc.exe')).find(p=>fs.existsSync(p));assert(compiler,'Windows .NET compiler required');
 const build=spawnSync(compiler,['/nologo','/codepage:65001','/target:winexe','/out:'+exe,'/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/reference:System.Web.Extensions.dll',path.join(__dirname,'../extension/native/host.cs')],{encoding:'utf8',windowsHide:true});assert.equal(build.status,0,build.stdout+build.stderr);
 const child=spawn(exe,[],{env:{...process.env,TEMP:dir,TMP:dir},windowsHide:true,stdio:['pipe','pipe','pipe']});let buffer=Buffer.alloc(0),number=0;const pending=new Map();
 child.stdout.on('data',bytes=>{buffer=Buffer.concat([buffer,bytes]);while(buffer.length>=4&&buffer.length>=4+buffer.readUInt32LE(0)){const length=buffer.readUInt32LE(0),reply=JSON.parse(buffer.subarray(4,4+length));buffer=buffer.subarray(4+length);pending.get(reply.requestId)?.(reply);pending.delete(reply.requestId);}});
 const call=(op,fields={})=>new Promise((resolve,reject)=>{const requestId=String(++number),data=Buffer.from(JSON.stringify({op,requestId,...fields})),prefix=Buffer.alloc(4),timer=setTimeout(()=>{pending.delete(requestId);reject(Error('Native response timed out'));},10000);pending.set(requestId,v=>{clearTimeout(timer);resolve(v);});prefix.writeUInt32LE(data.length);child.stdin.write(Buffer.concat([prefix,data]));});
 try{
  const capability=await call('ping');assert.equal(capability.version,'1.3.1');assert.equal(capability.independentPNGs,true);
  assert.equal((await call('begin',{count:20})).ok,true);
  const bytes=png(3000,2000),data='data:image/png;base64,'+bytes.toString('base64');
  for(let i=0;i<20;i++)assert.equal((await call('image',{index:i,data,name:'作者_图'+String(i+1).padStart(2,'0')})).ok,true,'image '+i+' must not hit a cumulative pixel budget');
  const root=path.join(dir,'XImageFlowClipboard'),folder=path.join(root,fs.readdirSync(root)[0]),names=fs.readdirSync(folder).sort();assert.equal(names.length,20);assert.equal(3000*2000*names.length,120000000);
  names.forEach((name,i)=>{assert.equal(name,'作者_图'+String(i+1).padStart(2,'0')+'.png');assert.deepEqual(fs.readFileSync(path.join(folder,name)),bytes);});
  assert.equal((await call('abort')).ok,true);assert(!fs.existsSync(folder),'abort removes every prepared file without touching the clipboard');
  assert.equal((await call('begin',{count:21})).ok,false);
  assert.equal((await call('begin',{count:1})).ok,true);
  const oversized=Buffer.from(bytes);oversized.writeUInt32BE(10001,16);oversized.writeUInt32BE(10000,20);
  const rejected=await call('image',{index:0,data:'data:image/png;base64,'+oversized.toString('base64')});assert.equal(rejected.ok,false);assert.match(rejected.error,/第 1 张.*单张上限/);
  const long=Buffer.from(bytes);long.writeUInt32BE(32768,16);long.writeUInt32BE(1,20);assert.equal((await call('image',{index:0,data:'data:image/png;base64,'+long.toString('base64')})).ok,false);
  assert.equal((await call('commit')).ok,false,'an incomplete batch must never write the clipboard');await call('abort');
 }finally{child.stdin.end();await new Promise(resolve=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(()=>{child.kill();resolve();},2000);child.once('exit',()=>{clearTimeout(timer);resolve();});});}
});
for(const root of ['extension','labs/collector/extension'])test(root+': old helper pixel errors explain upgrade and discard the partial job without retrying or committing',async()=>{
 let closed=0,images=0;const calls=[];
 const chrome={runtime:{connectNative(){const listeners=[];return {onMessage:{addListener:f=>listeners.push(f)},onDisconnect:{addListener(){}},disconnect(){closed++;},postMessage(m){calls.push(m.op);const error=m.op==='image'&&++images===2;queueMicrotask(()=>listeners.forEach(f=>f({requestId:m.requestId,ok:!error,error:'整组图片尺寸过大',maxBatchCount:20})));}};}},tabs:{onRemoved:{addListener(){}},sendMessage:async()=>{}}};
 const c={chrome,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,XIFOffscreen:{request:async()=>({ok:true,data:'PNG'})}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',root,'native-copy.js'),'utf8'),c);
 await assert.rejects(c.XIFNativeCopy.prepare(1,['a','b']),/升级到 1\.3\.1.*选择仍保留/);assert.equal(closed,1);assert.equal(images,2);assert(!calls.includes('commit'));
 const job=await c.XIFNativeCopy.prepare(1,['c']);assert.equal(job.ok,true);c.XIFNativeCopy.abort(1,job.jobId);
});
