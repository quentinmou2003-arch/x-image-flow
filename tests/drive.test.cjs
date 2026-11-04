const test=require('node:test'),assert=require('node:assert/strict');
const {DriveClient,DriveError,digest,allowed}=require('../labs/collector/extension/drive-client.js');
const {DriveSync,KEY}=require('../labs/collector/extension/drive-sync.js');
function service(){
 const files=new Map(),sessions=new Map(),calls=[];let sequence=0,uploads=0,account='accountA',lostAt=0;
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 const fetcher=async(url,o={})=>{
  calls.push({url,method:o.method||'GET',headers:o.headers});const u=new URL(url),method=o.method||'GET';
  if(u.pathname.endsWith('/about'))return json({user:{permissionId:account,emailAddress:account+'@example.com',displayName:account}});
  if(u.pathname.endsWith('/generateIds'))return json({ids:['file'+(++sequence)]});
  if(u.pathname.startsWith('/upload/')&&method==='POST'){
   const metadata=JSON.parse(o.body),session='https://www.googleapis.com/upload/drive/v3/files?upload_id='+metadata.id;
   if(files.has(metadata.id))return json({},409);
   sessions.set(session,{metadata,total:Number(o.headers['X-Upload-Content-Length']),offset:0,chunks:[]});return new Response(null,{status:200,headers:{Location:session}});
  }
  if(u.searchParams.has('upload_id')){
   const session=sessions.get(url);if(!session)return json({},404);
   const range=o.headers['Content-Range'];if(range.startsWith('bytes */'))return session.done?json(files.get(session.metadata.id)):new Response(null,{status:308,headers:session.offset?{Range:'bytes=0-'+(session.offset-1)}:{}});
   const m=range.match(/^bytes (\d+)-(\d+)\/(\d+)$/);assert(m);assert.equal(Number(m[1]),session.offset);const bytes=new Uint8Array(await o.body.arrayBuffer());assert.equal(bytes.length,Number(m[2])-Number(m[1])+1);session.chunks.push(bytes);session.offset+=bytes.length;uploads++;
   if(session.offset===session.total){const blob=new Blob(session.chunks);const file={...session.metadata,size:String(blob.size),sha256Checksum:await digest(blob),blob};files.set(file.id,file);session.done=true;}
   if(lostAt===uploads)throw Error('lost response');
   return session.done?json(files.get(session.metadata.id)):new Response(null,{status:308,headers:{Range:'bytes=0-'+(session.offset-1)}});
  }
  if(u.pathname.endsWith('/files')&&method==='POST'){const value=JSON.parse(o.body);files.set(value.id,value);return json(value);}
  if(u.pathname.endsWith('/files')){const query=u.searchParams.get('q')||'',hash=query.match(/key='xifHash' and value='([a-f0-9]+)'/)?.[1];return json({files:[...files.values()].filter(f=>hash?f.appProperties?.xifHash===hash:f.mimeType==='application/vnd.google-apps.folder')});}
  const id=u.pathname.split('/').pop();return files.has(id)?json(files.get(id)):json({},404);
 };
 return {files,sessions,calls,fetcher,get uploads(){return uploads;},loseAt:n=>lostAt=n,account:value=>account=value};
}
function state(){const maps={entries:new Map(),assets:new Map(),driveJobs:new Map(),driveRecords:new Map()},local={};const store={read:async(n,id)=>structuredClone(maps[n].get(id)),all:async n=>structuredClone([...maps[n].values()]),putDrive:async(n,v)=>maps[n].set(v.id,structuredClone(v)),driveJobs:async(a,states)=>structuredClone([...maps.driveJobs.values()].filter(j=>j.account===a&&states.includes(j.state)))};let interactive=0;const chrome={runtime:{getManifest:()=>({oauth2:{client_id:'sample.apps.googleusercontent.com'}})},storage:{local:{get:async key=>({[key]:structuredClone(local[key])}),set:async value=>Object.assign(local,structuredClone(value))}},identity:{getAuthToken:async options=>{if(options.interactive)interactive++;return {token:'private-token',grantedScopes:['https://www.googleapis.com/auth/drive.file']};},removeCachedAuthToken:async()=>{}}};return{maps,local,store,chrome,get interactive(){return interactive;}};}
async function seed(s){const photos=[];for(let i=0;i<4;i++){const blob=new Blob(['ORIGINAL '+i],{type:'image/jpeg'}),hash=await digest(blob);s.maps.assets.set(hash,{hash,blob,mime:blob.type,bytes:blob.size});photos.push({hash,url:'https://pbs.twimg.com/media/p'+i+'?format=jpg',alt:'part'+i});}s.maps.entries.set('100',{id:'100',href:'https://x.com/artist/status/100',author:'Artist',authorURL:'https://x.com/artist',tags:['参考'],photos});}
test('Drive uploads exact bytes and accepts completion only after server checksum and size verification',async()=>{
 const api=service(),client=new DriveClient({token:'secret',fetcher:api.fetcher}),blob=new Blob(['original JPEG bytes'],{type:'image/jpeg'}),hash=await digest(blob),ref={};let persisted=0;
 const args={blob,hash,name:hash+'.jpg',parent:'root',ref,persist:async()=>persisted++};const fileId=await client.upload(args);assert.equal(await api.files.get(fileId).blob.text(),await blob.text());assert(ref.complete);assert(persisted>=3);await client.upload(args);assert.equal(api.uploads,1);
 await client.upload({...args,ref:{}});assert.equal(api.uploads,1,'same Drive file reused after the local upload reference is missing');
 assert(api.calls.every(c=>c.headers.Authorization==='Bearer secret'));assert(api.calls.every(c=>!c.url.includes('secret')));
});
test('Drive retries a lost final receipt by checking the same file ID without uploading a duplicate',async()=>{
 const api=service(),client=new DriveClient({token:'t',fetcher:api.fetcher}),blob=new Blob(['image']),ref={},args={blob,hash:await digest(blob),name:'original.png',parent:'root',ref,persist:async()=>{}};api.loseAt(1);
 await assert.rejects(client.upload(args),/网络中断/);assert(ref.fileId);await client.upload(args);assert.equal(api.files.size,1);assert.equal(api.uploads,1);
});
test('Drive resumes from the server acknowledged byte offset after a chunk response is lost',async()=>{
 const api=service(),client=new DriveClient({token:'t',fetcher:api.fetcher}),blob=new Blob([new Uint8Array(5*1024*1024).fill(173)]),ref={},args={blob,hash:await digest(blob),name:'large.jpg',parent:'root',ref,persist:async()=>{}};api.loseAt(1);
 await assert.rejects(client.upload(args),/网络中断/);await client.upload(args);assert.equal(api.uploads,2);assert.equal(Number(api.files.get(ref.fileId).size),blob.size);
});
test('Drive rejects foreign upload URLs before credentials or bytes leave the worker',async()=>{
 let calls=0;const client=new DriveClient({token:'private',fetcher:async()=>{calls++;return new Response();}});await assert.rejects(client.request('https://evil.example/upload/drive/v3/files'),/异常/);assert.equal(calls,0);assert.throws(()=>allowed('https://www.googleapis.com.evil.example/drive/v3/files'));assert.throws(()=>allowed('http://www.googleapis.com/drive/v3/files'));
});
test('Drive classifies revoked authorization, exhausted space and rate limits without replaying writes',async()=>{
 for(const [status,reason,code]of [[401,'','auth'],[403,'storageQuotaExceeded','quota'],[429,'','retry']]){let calls=0,removed=0;const client=new DriveClient({token:'private',fetcher:async()=>{calls++;return new Response(JSON.stringify({error:{errors:[{reason}]}}),{status});},invalidate:async()=>removed++});await assert.rejects(client.request('https://www.googleapis.com/drive/v3/files',{method:'POST'}),e=>e.code===code);assert.equal(calls,1);assert.equal(removed,status===401?1:0);}
});
test('Drive cannot claim a changed cloud file is synchronized',()=>{
 const client=new DriveClient({token:'t'});assert.throws(()=>client.verify({size:'4',sha256Checksum:'bad',appProperties:{xifHash:'a'.repeat(64)}},new Blob(['four']),'a'.repeat(64)),/校验不一致/);assert.equal(client.verify({trashed:true},new Blob(['four']),'a'.repeat(64)),false);
});
test('Drive sync requires explicit connection and commits a complete four-photo album plus source manifest',async()=>{
 const s=state(),api=service();await seed(s);const sync=new DriveSync({...s,fetcher:api.fetcher});await sync.pump();assert.equal(api.calls.length,0);assert.equal(s.interactive,0);
 await sync.connect();await sync.pump();const job=[...s.maps.driveJobs.values()][0];assert.equal(job.state,'synced');assert.equal(job.done,4);assert.equal(api.files.size,6);
 const metadata=JSON.parse(await api.files.get(job.manifestId).blob.text());assert.equal(metadata.photos.length,4);assert.equal(metadata.author,'Artist');assert.equal(metadata.href,'https://x.com/artist/status/100');assert.deepEqual(metadata.tags,['参考']);
 assert.deepEqual(metadata.photos.map(p=>p.hash),s.maps.entries.get('100').photos.map(p=>p.hash));await sync.enqueue('100');await sync.pump();assert.equal(api.uploads,5);assert.equal(s.interactive,1);assert(!JSON.stringify(s.local).includes('private-token'));assert(!JSON.stringify(await sync.status()).includes('private-token'));
});
test('partial cloud upload is never a complete album; retry and worker restart reuse committed originals',async()=>{
 const s=state(),api=service();await seed(s);const sync=new DriveSync({...s,fetcher:api.fetcher});await sync.connect();api.loseAt(2);await sync.pump();assert.equal([...s.maps.driveJobs.values()][0].state,'pending');assert.equal(api.uploads,2);
 const resumed=new DriveSync({...s,fetcher:api.fetcher});await resumed.retry([...s.maps.driveJobs.keys()][0]);await resumed.pump();assert.equal([...s.maps.driveJobs.values()][0].state,'synced');assert.equal(api.uploads,5);
});
test('account switches pause rather than label old account files as new account sync',async()=>{
 const s=state(),api=service();await seed(s);const sync=new DriveSync({...s,fetcher:api.fetcher});await sync.connect();api.account('accountB');await sync.pump();assert.equal(api.uploads,0);assert(s.local[KEY].paused);assert.match(s.local[KEY].error,/账号变化/);assert([...s.maps.driveJobs.values()].every(j=>j.account==='accountA'&&j.state!=='synced'));
 await sync.disconnect();await sync.connect();await sync.pump();assert([...s.maps.driveJobs.values()].some(j=>j.account==='accountB'&&j.state==='synced'));
});
test('disconnect stops future uploads and does not delete remote or local originals',async()=>{
 const s=state(),api=service();await seed(s);const sync=new DriveSync({...s,fetcher:api.fetcher});await sync.connect();await sync.pump();const count=api.calls.length;await sync.disconnect();await sync.pump();assert.equal(api.calls.length,count);assert.equal(api.files.size,6);assert.equal(s.maps.assets.size,4);assert.equal((await sync.status()).enabled,false);
});
