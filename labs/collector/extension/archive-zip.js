(function(scope){
  'use strict';
  const table=Array.from({length:256},(_,v)=>{for(let i=0;i<8;i++)v=v&1?0xedb88320^(v>>>1):v>>>1;return v>>>0;});
  function crc32(bytes){let crc=0xffffffff;for(const v of bytes)crc=table[(crc^v)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
  async function zip(files){
    if(files.length>60000)throw Error('导出文件太多');
    const chunks=[],central=[];let offset=0;
    for(const file of files){
      if(!/^[a-zA-Z0-9_./-]+$/.test(file.name)||file.name.includes('..')||file.name.startsWith('/'))throw Error('导出文件名无效');
      const name=new TextEncoder().encode(file.name),blob=file.blob;
      if(offset+blob.size>512*1024*1024)throw Error('收藏超过 512 MB，请先分批导出图片');
      const crc=crc32(new Uint8Array(await blob.arrayBuffer())),header=new Uint8Array(30+name.length),view=new DataView(header.buffer);
      view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(12,33,true);view.setUint32(14,crc,true);view.setUint32(18,blob.size,true);view.setUint32(22,blob.size,true);view.setUint16(26,name.length,true);header.set(name,30);
      chunks.push(header,blob);
      const record=new Uint8Array(46+name.length),v=new DataView(record.buffer);
      v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(14,33,true);v.setUint32(16,crc,true);v.setUint32(20,blob.size,true);v.setUint32(24,blob.size,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);record.set(name,46);central.push(record);offset+=header.length+blob.size;
    }
    const size=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
    v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);
    return new Blob([...chunks,...central,end],{type:'application/zip'});
  }
  scope.XIFZip={crc32,zip};if(typeof module!=='undefined')module.exports=scope.XIFZip;
})(globalThis);
