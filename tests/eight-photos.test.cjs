const test=require('node:test'),assert=require('node:assert/strict');
const X=require('../labs/collector/extension/shared.js');
const A=require('../labs/collector/extension/archive-presentation.js');
const C=require('../labs/collector/extension/collection-flow.js');
const V=require('../labs/collector/extension/video-meta.js');
const L=require('../labs/collector/extension/library-store.js');
const B=require('../labs/collector/extension/bulk-plan.js');
function scene(w,h){const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4;data[p]=120+90*Math.sin(y/9+x/37);data[p+1]=120+90*Math.sin(y/19+x/21);data[p+2]=120+90*Math.cos(y/13+x/11);data[p+3]=255;}return {width:w,height:h,data};}
function crop(im,x,y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let j=0;j<h;j++)data.set(im.data.subarray(((j+y)*im.width+x)*4,((j+y)*im.width+x+w)*4),j*w*4);return {width:w,height:h,data};}
const urls=n=>Array.from({length:n},(_,i)=>'https://pbs.twimg.com/media/test'+i+'?format=png');
test('six and eight consecutive cuts keep every piece, without factorial strip search',()=>{
 for(const n of [6,8]){const full=scene(n*60,240),cuts=Array.from({length:n},(_,i)=>crop(full,i*60,0,60,240)),r=X.detect(cuts);assert.equal(r.mode,'horizontal');assert.deepEqual(r.order,Array.from({length:n},(_,i)=>i));assert(r.suggested);assert.equal(X.geometry(cuts,r.mode).width,n*60);const photos=urls(n).map(url=>({url}));assert.equal(C.plan(photos).urls.length,n);assert.equal(C.plan(photos,r).urls.length,n);}
 assert.throws(()=>X.detect(Array.from({length:9},()=>scene(8,8))),/2–8/);
});
test('both six-panel layouts keep original sizes and are valid for copying and archiving',()=>{
 const sizes=Array.from({length:6},()=>({width:100,height:120}));
 for(const [mode,w,h]of [['grid3x2',300,240],['grid2x3',200,360]]){const g=X.geometry(sizes,mode);assert.equal(g.width,w);assert.equal(g.height,h);assert.equal(new Set(g.cells.map(c=>c.x+':'+c.y)).size,6);assert.equal(B.validate([{urls:urls(6),mode,blend:false,seams:[]}])[0].urls.length,6);assert.equal(A.plan({photos:urls(6).map(url=>({url})),archiveChoice:mode}).mode,mode);assert.throws(()=>B.validate([{urls:urls(5),mode,blend:false,seams:[]}]),/布局/);}
});
test('cover exclusion requires an explicit user choice; ambiguous or differently sized first images stay in the album',()=>{
 const entry={photos:urls(8).map(url=>({url}))};assert.equal(A.plan(entry).kind,'album');const plan=A.plan({...entry,archiveChoice:'cover-horizontal'});assert.equal(plan.kind,'mixed');assert.deepEqual(plan.order,[1,2,3,4,5,6,7]);assert.equal(A.plan({...entry,archiveChoice:'horizontal'}).order.length,8);
 const flat=Array.from({length:8},()=>({width:30,height:120,data:new Uint8ClampedArray(30*120*4).fill(255)}));assert.equal(A.plan(entry,X.detect(flat)).kind,'album');
});
test('received X media and archive validation keep photos 5-8 in order, rejecting external sources',()=>{
 const media=urls(8).map((url,i)=>({type:'photo',media_url_https:url,original_info:{width:100+i,height:200},ext_alt_text:'piece'+i}));
 const records=V.extract({rest_id:'123',legacy:{id_str:'123',extended_entities:{media}}});assert.equal(records[0].media.length,8);assert.deepEqual(records[0].media.map(m=>m.order),[1,2,3,4,5,6,7,8]);assert.equal(records[0].media[7].width,107);
 const value={id:'123',href:'https://x.com/artist/status/123',images:urls(8).map(url=>({url}))};assert.equal(L.input(value).images.length,8);assert.throws(()=>L.input({...value,images:urls(9).map(url=>({url}))}));assert.equal(V.extract({rest_id:'123',legacy:{id_str:'123',extended_entities:{media:[{type:'photo',media_url_https:'https://evil.example/p.png'}]}}}).length,0);
});
test('six-panel detection selects row-major 3x2 and 2x3 layouts from actual continuous pixels',()=>{
 for(const cols of [3,2]){const rows=6/cols,full=scene(cols*120,rows*120),cuts=Array.from({length:6},(_,i)=>crop(full,(i%cols)*120,Math.floor(i/cols)*120,120,120)),r=X.detect(cuts);assert.equal(r.mode,cols===3?'grid3x2':'grid2x3');assert.deepEqual(r.order,[0,1,2,3,4,5]);assert(r.suggested);}
});
