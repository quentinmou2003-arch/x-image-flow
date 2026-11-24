const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../labs/collector/extension/archive-presentation.js');
const entry={id:'123',photos:[0,1,2,3].map(i=>({url:'https://pbs.twimg.com/media/p'+i,hash:String(i).repeat(64)}))};
test('ordinary albums remain separate PNG outputs, uncertain edges cannot force stitching',()=>{
 for(const suggestion of [undefined,{suggested:false,order:[0,1,2,3],mode:'horizontal'},{suggested:true,mode:'grid',order:[0,0,2,3]}])assert.equal(api.plan(entry,suggestion).kind,'album');
 assert.equal(api.plan({...entry,archiveChoice:'album'},{suggested:true,mode:'horizontal',order:[0,1,2,3]}).kind,'album');
});
test('reliable slice order is used while manual correction overrides the detector',()=>{
 assert.deepEqual(api.plan(entry,{suggested:true,mode:'horizontal',order:[2,0,3,1]}),{kind:'slice',mode:'horizontal',order:[2,0,3,1],blend:true});
 assert.deepEqual(api.plan({...entry,archiveChoice:'grid'},null),{kind:'slice',mode:'grid',order:[0,1,2,3],blend:true});
 assert.throws(()=>api.plan({...entry,archiveChoice:'grid',photos:entry.photos.slice(0,3)}),/四张/);
});
test('cached PNG presentation is invalidated by original changes and user correction',()=>{
 const presentation={format:api.FORMAT,signature:api.signature(entry),kind:'slice',photos:[{hash:'a'.repeat(64)}]};
 assert(api.valid({...entry,presentation}));assert(!api.valid({...entry,archiveChoice:'album',presentation}));assert(!api.valid({...entry,photos:entry.photos.slice(1),presentation}));
 assert(!api.valid({...entry,presentation:{...presentation,kind:'album'}}));
});
