const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
for(const folder of ['extension','labs/collector/extension']){
 const root=path.join(__dirname,'..',folder),motion=require(path.join(root,'motion.js'));
 test(folder+': GIF URL policy accepts only X media and does not misclassify ordinary videos',()=>{
  assert.equal(motion.isGIF({type:'video',gif:true}),true);assert.equal(motion.isGIF({type:'video',url:'https://video.twimg.com/a.mp4'}),false);
  assert.equal(motion.isGIF({url:'https://pbs.twimg.com/media/a?format=gif&name=small'}),true);
  assert.match(motion.url('https://pbs.twimg.com/media/a?format=gif&name=small'),/name=orig/);
  for(const url of ['https://evil.example/a.mp4','https://video.twimg.com.evil.example/a.mp4','https://user:pass@video.twimg.com/a.mp4','https://pbs.twimg.com/media/a?format=png','file:///a.gif'])assert.throws(()=>motion.url(url));
 });
 test(folder+': transcode plans preserve the whole duration while bounding frame pixels and dimensions',()=>{
  for(const [w,h,duration] of [[1920,1080,1.13],[800,1200,30],[3840,2160,120],[100,50,.04]]){
   const p=motion.plan(w,h,duration);assert(p.width<=640&&p.height<=640);assert(p.frames>=2);assert(p.width*p.height*p.frames<=80000000);
   let delay=0;for(let i=0;i<p.frames;i++)delay+=(Math.round((i+1)*p.ticks/p.frames)-Math.round(i*p.ticks/p.frames))*10;
   assert(Math.abs(delay-duration*1000)<=10,'whole animation duration retained');
  }
  for(const params of [[0,100,1],[100,100,121],[100,100,NaN]])assert.throws(()=>motion.plan(...params));
 });
 test(folder+': bundled local encoder creates a real two-frame looping GIF with changing pixels',()=>{
  const context={Uint8Array,Uint8ClampedArray,ArrayBuffer};vm.runInNewContext(fs.readFileSync(path.join(root,'vendor/gifenc.js'),'utf8'),context);const api=context.XIFGIFEncoder,gif=api.GIFEncoder();
  for(const color of [[255,0,0],[0,0,255]]){const rgba=new Uint8Array([...color,255,...color,255,...color,255,...color,255]);const palette=api.quantize(rgba,256);gif.writeFrame(api.applyPalette(rgba,palette),2,2,{palette,delay:100});}
  gif.finish();const bytes=Buffer.from(gif.bytes());assert.equal(bytes.subarray(0,6).toString(),'GIF89a');assert(bytes.includes(Buffer.from('NETSCAPE2.0')));assert.equal(bytes.at(-1),0x3b);
  assert(fs.readFileSync(path.join(root,'vendor/gifenc-LICENSE.md'),'utf8').includes('MIT'));
 });
 test(folder+': GIF native jobs require an updated helper before conversion and commit only once',async()=>{
  const operations=[],ports=[];let capable=false,prepared=0;
  const chrome={runtime:{connectNative:()=>{const callbacks=[];const port={onMessage:{addListener:f=>callbacks.push(f)},onDisconnect:{addListener:()=>{}},disconnect(){this.closed=true;},postMessage(m){operations.push(m.op);queueMicrotask(()=>callbacks.forEach(f=>f({...m,ok:true,gifClipboard:capable,count:1})));}};ports.push(port);return port;}},tabs:{onRemoved:{addListener:()=>{}}}};
  const context={chrome,crypto:require('node:crypto').webcrypto,XIFOffscreen:{request:async()=>{prepared++;return {ok:true,data:'data:image/gif;base64,TEST'};}},setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(path.join(root,'native-copy.js'),'utf8'),context);const api=context.XIFNativeCopy;
  await assert.rejects(api.prepareGIF(7,'https://video.twimg.com/a.mp4'),/更新 GIF/);assert.equal(prepared,0);assert(ports[0].closed);
  capable=true;const job=await api.prepareGIF(7,'https://video.twimg.com/a.mp4');assert.equal(prepared,1);assert.equal(operations.includes('commit'),false);
  await assert.rejects(api.commit(8,job.jobId),/失效/);await api.commit(7,job.jobId);await assert.rejects(api.commit(7,job.jobId),/失效/);assert.equal(operations.filter(op=>op==='commit').length,1);
 });
}
