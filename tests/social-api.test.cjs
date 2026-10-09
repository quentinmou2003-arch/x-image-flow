const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const filePath=require('path'),test=require('node:test');
const api=require('../extension/social-protocol.js');
const source=fs.readFileSync(filePath.join(__dirname,'../extension/social-bridge.js'),'utf8');
const origin='https://x.com',path=op=>`/i/api/graphql/abcdefgh1234/${op}`;
const auth={authorization:'Bearer PRIVATE_TEST_TOKEN','x-csrf-token':'PRIVATE_CSRF','x-twitter-auth-type':'OAuth2Session'};
const success=op=>({data:{[api.operations[op].result]:'Done'}});
const delay=()=>new Promise(r=>setTimeout(r,5));
function fixture(){
 const handlers=[],messages=[],calls=[];let nextStatus=200,nextJSON=null,nextReject=false;
 class XHR{open(method,url){this.method=method;this.url=url}setRequestHeader(){}addEventListener(_,fn){this.load=fn}send(body){this.status=200;const op=this.url.split('/').pop();this.responseType='json';this.response=success(op);this.load?.()}}
 const window={postMessage:m=>{messages.push(m);queueMicrotask(()=>handlers.forEach(fn=>fn({source:window,origin,data:m})))},addEventListener:(_,fn)=>handlers.push(fn),fetch:async(input,init)=>{
  const url=typeof input==='string'?input:input.url;
  calls.push({url,init});if(nextReject){nextReject=false;throw Error('timeout')}
  const op=url.split('/').pop();const json=nextJSON||(api.operations[op]?success(op):{data:{}});const status=nextStatus;nextJSON=null;nextStatus=200;
  return new Response(JSON.stringify(json),{status,headers:{'content-type':'application/json'}});
 }};
 const ctx={window,XIFSocial:api,XMLHttpRequest:XHR,location:{origin,href:origin+'/home'},document:{cookie:'ct0=FRESH_CSRF'},Headers,Request,Response,URL,AbortSignal,Promise,Map,WeakMap,Set,Reflect,JSON,decodeURIComponent};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {window,messages,calls,XHR,setResponse:(status,json)=>{nextStatus=status;nextJSON=json},rejectNext:()=>nextReject=true,write:async(id,kind,desired)=>{const requestId='req-'+Math.random();window.postMessage({channel:'xif-social-write',requestId,id,kind,desired});await delay();return messages.find(m=>m.channel==='xif-social-reply'&&m.requestId===requestId)?.result}};
}
test('web social API learns requests without exporting credentials and confirms writes',async()=>{
 const f=fixture();
 assert((await f.write('123','like',true)).unavailable);assert.equal(f.calls.length,0,'unavailable sends no write');
 for(const op of Object.keys(api.operations)){
  await f.window.fetch(origin+path(op),{method:'POST',headers:auth,body:JSON.stringify({queryId:'abcdefgh1234',variables:{tweet_id:'123',dark_request:false},features:{flag:true}})});await delay();
 }
 assert.equal(f.messages.filter(m=>m.channel==='xif-social-template').length,4);
 const exported=JSON.stringify(f.messages);assert(!exported.includes('PRIVATE_'),'credentials never exported');
 const t=f.messages.find(m=>m.channel==='xif-social-template').template;
 assert(!JSON.stringify(t).includes('123"'),'tweet id not persisted');
 for(const op of Object.keys(api.operations)){
  const info=api.operations[op],before=f.calls.length;const r=await f.write('456',info.kind,info.state);assert(r.ok&&r.state===info.state);
  assert.equal(f.calls.length,before+1);const call=f.calls.at(-1);assert.equal(call.url,path(op));assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.headers['x-csrf-token'],'FRESH_CSRF');assert.equal(JSON.parse(call.init.body).variables.tweet_id,'456');
 }
 f.setResponse(200,{data:{favorite_tweet:'Done'},errors:[{message:'rejected'}]});assert(!(await f.write('456','like',true)).ok);
 f.setResponse(429,{});assert.match((await f.write('456','like',true)).error,/频繁/);
 f.setResponse(401,{});assert.match((await f.write('456','like',true)).error,/登录/);
 const count=f.calls.length;f.rejectNext();assert(!(await f.write('456','like',true)).ok);assert.equal(f.calls.length,count+1,'no retry after uncertain write');
 f.setResponse(404,{});assert(!(await f.write('456','like',true)).ok);assert(f.messages.some(m=>m.channel==='xif-social-forget'));assert((await f.write('456','like',true)).unavailable);
 const g=fixture();g.window.postMessage({channel:'xif-social-init',templates:[t]});await delay();await g.window.fetch(origin+'/i/api/graphql/read/HomeTimeline',{headers:auth});assert((await g.write('888','like',true)).ok,'saved template works with newly observed auth');
 const h=fixture();const xhr=new h.XHR();xhr.open('POST',origin+path('CreateBookmark'));for(const [k,v]of Object.entries(auth))xhr.setRequestHeader(k,v);xhr.send(JSON.stringify({variables:{tweet_id:'123'},queryId:'abcdefgh1234'}));await delay();assert((await h.write('999','bookmark',true)).ok,'XHR learning');
 const request=new Request(origin+path('DeleteBookmark'),{method:'POST',headers:auth,body:JSON.stringify({variables:{tweet_id:'123'},queryId:'abcdefgh1234'})});await h.window.fetch(request);await delay();assert((await h.write('999','bookmark',false)).ok,'Request learning');
 assert.equal(api.capture('https://evil.test'+path('FavoriteTweet'),JSON.stringify({variables:{tweet_id:'123'}}),origin),null);
 assert.equal(api.template({path:'/i/api/graphql/abcdefgh1234/CreateTweet'}),null);
 assert.equal(api.template({path:path('FavoriteTweet'),queryId:'different'}),null);
 assert.equal(api.template({path:path('FavoriteTweet'),authorization:'secret'}).authorization,undefined);
 assert(!(await h.write('not-an-id','like',true)).ok);
 const group={like:true,apiState:{like:{state:true,time:0}}};
 assert.equal(api.syncNativeState(group,'like',{on:false}),false);assert.equal(group.like,true,'old native button cannot undo a confirmed API write');
 api.syncNativeState(group,'like',{on:true});assert.equal(group.apiState.like,undefined);
 assert(api.syncNativeState(group,'like',{on:false}));assert.equal(group.like,false,'native updates work once reconciled');
 const records=require('../extension/video-meta.js').extract({rest_id:'987',legacy:{favorited:true,bookmarked:false}});
 assert.deepEqual(records[0].state,{like:true,bookmark:false});
 console.log('PASS all four operations, fetch/XHR/Request learning, stored templates, credentials isolation, fresh CSRF, server errors, no retries, invalidation and input allowlist');
});
