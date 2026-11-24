/* Prepare cloud-facing PNGs from committed originals before the upload queue runs. */
(function(scope){
  'use strict';
  const FORMAT='xif-cloud-png-v1';
  function signature(entry){return JSON.stringify([entry.archiveChoice||'auto',entry.photos.map(p=>[p.url,p.hash])]);}
  function valid(entry){const p=entry.presentation;return p?.format===FORMAT&&p.signature===signature(entry)&&['album','slice'].includes(p.kind)&&Array.isArray(p.photos)&&p.photos.length===(p.kind==='slice'?1:entry.photos.length)&&p.photos.every(x=>/^[a-f0-9]{64}$/.test(x.hash));}
  function plan(entry,suggestion){
    const n=entry.photos.length,choice=entry.archiveChoice||'auto';
    if(choice==='album'||n<2)return {kind:'album',order:Array.from({length:n},(_,i)=>i)};
    if(choice!=='auto'){
      if(!['horizontal','vertical','grid'].includes(choice)||choice==='grid'&&n!==4)throw Error('四宫格切片需要四张原图');
      return {kind:'slice',mode:choice,order:Array.from({length:n},(_,i)=>i),blend:true};
    }
    const order=suggestion?.order;
    if(suggestion?.suggested===true&&['horizontal','vertical','grid'].includes(suggestion.mode)&&Array.isArray(order)&&order.length===n&&new Set(order).size===n&&order.every(i=>Number.isInteger(i)&&i>=0&&i<n)&&(!(suggestion.mode==='grid')||n===4))return {kind:'slice',mode:suggestion.mode,order:[...order],blend:true};
    return {kind:'album',order:Array.from({length:n},(_,i)=>i)};
  }
  async function prepare(entry,request=scope.XIFOffscreen.request){
    if(valid(entry))return entry;
    const result=await request({action:'archive-prepare',id:entry.id});
    if(!result?.ok)throw Error(result?.error||'云端 PNG 准备失败，原图仍在本机');
    const saved=await scope.XIFLibrary.read('entries',entry.id);
    if(!saved||!valid(saved))throw Error('云端 PNG 尚未准备完整，请重试');
    return saved;
  }
  scope.XIFArchivePresentation={FORMAT,signature,valid,plan,prepare};
  if(typeof module!=='undefined')module.exports=scope.XIFArchivePresentation;
})(globalThis);
