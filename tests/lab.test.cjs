const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Script}=require('node:vm');
const root=path.join(__dirname,'../labs/collector/extension');
require(path.join(root,'shared.js'));const store=require(path.join(root,'library-store.js')),zip=require(path.join(root,'archive-zip.js'));
test('collector lab is a separate valid extension and library page files exist',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));assert.equal(m.version,'2.4.0.4');assert.equal(m.version_name,'2.4.0-lab.4');
 for(const file of m.content_scripts.flatMap(s=>s.js).concat(['library.html','library.css','library.js','library-store.js','archive-zip.js','native-copy.js']))assert(fs.existsSync(path.join(root,file)),file);
 for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.js')))new Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
});
test('archive inputs preserve canonical author/source and original image URL',()=>{
 const entry=store.input({id:'123',href:'https://x.com/artist/status/123/photo/1',author:'Artist',authorURL:'https://x.com/artist',images:[{url:'https://pbs.twimg.com/media/art?format=jpg&name=small'}]});
 assert.equal(entry.href,'https://x.com/artist/status/123');assert.equal(entry.authorURL,'https://x.com/artist');assert.match(entry.images[0].url,/name=orig/);
 assert.throws(()=>store.input({id:'123',href:'https://evil.example/status/123',images:[{url:'https://pbs.twimg.com/media/art'}]}));
 assert.throws(()=>store.input({id:'123',href:'https://x.com/artist/status/124',images:[{url:'https://pbs.twimg.com/media/art'}]}));
});
test('library tags trim, deduplicate and bound user metadata',()=>{
 assert.deepEqual(store.tags(' 角色，参考,角色,, '),['角色','参考']);assert.equal(store.tags(Array.from({length:30},(_,i)=>String(i))).length,12);
 assert.equal(store.tags(['x'.repeat(40)])[0].length,24);
});
test('archive ZIP stores exact file bytes with standard headers and CRC',async()=>{
 const bytes=new TextEncoder().encode('123456789');assert.equal(zip.crc32(bytes),0xcbf43926);
 const archive=await zip.zip([{name:'collection.json',blob:new Blob([bytes])}]),buffer=new Uint8Array(await archive.arrayBuffer()),v=new DataView(buffer.buffer);
 assert.equal(v.getUint32(0,true),0x04034b50);assert.equal(v.getUint32(14,true),0xcbf43926);assert.equal(v.getUint32(18,true),9);
 const start=30+v.getUint16(26,true);assert.deepEqual([...buffer.subarray(start,start+9)],[...bytes]);assert.equal(v.getUint32(buffer.length-22,true),0x06054b50);
});
test('archive ZIP rejects traversal and invalid file names',async()=>{
 for(const name of ['../private','/absolute','images/../../bad','images\\bad'])await assert.rejects(zip.zip([{name,blob:new Blob(['x'])}]),/文件名/);
});
