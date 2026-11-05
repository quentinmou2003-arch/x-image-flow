const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
for(const root of ['extension','labs/collector/extension']){
 const ctx={URL};vm.createContext(ctx);for(const f of ['shared.js','bulk-plan.js'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..',root,f),'utf8'),ctx);
 const url=n=>'https://pbs.twimg.com/media/p'+n+'?format=png',single=n=>({urls:[url(n)]}),joined={urls:[url(2),url(3)],mode:'horizontal',blend:false,seams:[{overlap:12,shift:-7}]};
 test(root+': mixed plans preserve output order, source order and exact confirmed seams',()=>{
  const result=JSON.parse(JSON.stringify(ctx.XIFBulkPlan.validate([single(1),joined,single(4)])));assert.equal(result.length,3);assert.deepEqual(result.map(p=>p.urls.map(u=>new URL(u).pathname)),[['/media/p1'],['/media/p2','/media/p3'],['/media/p4']]);assert.deepEqual(result[1].seams,joined.seams);assert.equal(result[1].blend,false);
  assert.equal(ctx.XIFBulkPlan.validate(Array.from({length:20},(_,i)=>({urls:[url(i*4),url(i*4+1),url(i*4+2),url(i*4+3)],mode:'grid',blend:false,seams:[]}))).length,20);
 });
 test(root+': malformed, oversized, duplicate and unconfirmed plans cannot reach the helper',()=>{
  for(const value of [null,[],Array.from({length:21},(_,i)=>single(i)),[single(1),single(1)],[single(2),joined],[{urls:['https://evil.example/image.png']}],[{...joined,seams:[]}],[{...joined,seams:[{overlap:-1,shift:0}]}],[{...joined,seams:[{overlap:1,shift:1.5}]}],[{...joined,mode:'grid'}],[{...joined,blend:undefined}],[{...single(1),mode:'horizontal'}]])assert.throws(()=>ctx.XIFBulkPlan.validate(value));
 });
 test(root+': confirming a stitch replaces its pieces without moving other selections or losing a full queue',()=>{
  ctx.XIFMotion={isGIF:()=>false};vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..',root,'bulk-picker.js'),'utf8'),ctx);
  const picker=Object.assign(Object.create(ctx.XIFBulkPicker.prototype),{active:true,preparing:false,selected:new Map(Array.from({length:20},(_,i)=>[url(i),single(i)])),plans:new Map(),invalidate(){},render(){},toast(){}}),g={id:'100',images:[{url:url(0)},{url:url(1)}]},plan={urls:[url(0),url(1)],mode:'horizontal',blend:false,seams:[{overlap:0,shift:0}]};
  assert.equal(picker.confirm(g,plan),true);assert.equal(picker.selected.size,19);assert.deepEqual([...picker.selected.keys()].slice(0,3),['stitch:100',url(2),url(3)]);
  picker.selected.set(url(20),single(20));const before=[...picker.selected.keys()];assert.equal(picker.confirm({id:'200',images:[{url:url(30)},{url:url(31)}]},{...plan,urls:[url(30),url(31)]}),false);assert.deepEqual([...picker.selected.keys()],before);
  assert.equal(picker.confirm({...g,id:'300'},plan),false,'another stitch sharing originals is rejected without changing the queue');assert.deepEqual([...picker.selected.keys()],before);
  picker.independent(g);assert.equal(picker.plans.has('100'),false);assert.equal(picker.selected.has('stitch:100'),false);assert.equal(picker.selected.size,19);
 });
}
