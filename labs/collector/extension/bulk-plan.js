/* Validate each output separately: an independent image or a confirmed stitch. */
(function(scope){
  'use strict';
  function validate(items){
    if(!Array.isArray(items)||items.length<1||items.length>20)throw Error('每批支持 1–20 张输出图片');
    const used=new Set();
    return items.map(item=>{
      if(!item||!Array.isArray(item.urls)||item.urls.length<1||item.urls.length>8)throw Error('批量图片来源无效');
      const urls=item.urls.map(url=>scope.XIF.mediaURL(url));
      for(const url of urls){if(used.has(scope.XIF.photoKey(url)))throw Error('同一原图不能在本批重复选择');used.add(scope.XIF.photoKey(url));}
      if(item.name!==undefined&&(typeof item.name!=='string'||item.name.length>1000))throw Error('文件名无效');
      const name=item.name?scope.XIF.filenamePart(item.name):undefined;
      if(urls.length===1){if(item.mode!==undefined)throw Error('单图无需拼接');return {urls,...(name?{name}:{})};}
      if(!['horizontal','vertical','grid','grid3x2','grid2x3'].includes(item.mode)||(item.mode==='grid'&&urls.length!==4)||(['grid3x2','grid2x3'].includes(item.mode)&&urls.length!==6))throw Error('拼接布局无效');
      if(typeof item.blend!=='boolean'||!Array.isArray(item.seams)||item.seams.length!==(item.mode.startsWith('grid')?0:urls.length-1))throw Error('请先确认完整拼接预览');
      const seams=item.seams.map(s=>{if(!s||!Number.isSafeInteger(s.overlap)||!Number.isSafeInteger(s.shift)||s.overlap<0||s.overlap>32766||Math.abs(s.shift)>32767)throw Error('接缝参数无效');return {overlap:s.overlap,shift:s.shift};});
      return {urls,...(name?{name}:{}),mode:item.mode,blend:item.blend,seams};
    });
  }
  scope.XIFBulkPlan={validate};if(typeof module!=='undefined')module.exports=scope.XIFBulkPlan;
})(globalThis);
