(function(scope){
  'use strict';
  class BulkPicker{
    constructor({root,groups,message,toast,copied,busy,setBusy,helper}){
      Object.assign(this,{root,groups,message,toast,copied,busy,setBusy,helper});this.selected=new Map();this.active=false;this.preparing=false;this.ready=null;this.aborting=Promise.resolve();
      this.toggle=this.button('批量复制','bulk-toggle',()=>this.enable(!this.active));this.toggle.title='勾选多条推文中的照片，一次复制为独立图片';root.querySelector('.tools').prepend(this.toggle);
      this.bar=document.createElement('div');this.bar.className='bulk-bar hidden';this.label=document.createElement('span');
      this.copy=this.button('复制所选图片','primary',()=>this.execute());this.clear=this.button('清空选择','',()=>{this.invalidate();this.selected.clear();this.render();});this.exit=this.button('退出批量','',()=>this.enable(false));
      this.bar.append(this.label,this.copy,this.clear,this.exit);root.querySelector('.tabs').after(this.bar);this.render();
    }
    button(text,cls,action){const b=document.createElement('button');b.textContent=text;b.className=cls;b.onclick=action;return b;}
    invalidate(){if(this.ready){const job=this.ready;this.ready=null;this.aborting=this.message({action:'batch-abort',jobId:job.jobId}).catch(()=>{});}}
    enable(value){if(this.preparing){this.toast('正在准备图片，请稍候');return;}this.active=value;this.root.querySelector('.panel').classList.toggle('bulk-mode',value);if(!value){this.invalidate();this.selected.clear();}this.bar.classList.toggle('hidden',!value);for(const g of this.groups())this.update(g);this.render();}
    update(g){
      if(!this.active)return;
      const photos=g.images.filter(im=>im.type!=='video'&&!scope.XIFMotion.isGIF(im)),key=photos.map(im=>im.url).join('|');
      if(g.bulkKey===key){this.paint(g.bulkRow);return;}
      g.bulkRow?.remove();g.bulkKey=key;if(!photos.length)return;
      const row=document.createElement('div');row.className='bulk-row';g.bulkRow=row;
      for(const [i,im]of photos.entries()){
        const b=this.button('', 'bulk-photo',()=>{if(this.preparing)return;this.invalidate();if(this.selected.has(im.url))this.selected.delete(im.url);else{if(this.selected.size>=20){this.toast('每批最多选择 20 张，请先复制这一批');return;}this.selected.set(im.url,{url:im.url});}this.render();});
        b.dataset.url=im.url;b.setAttribute('aria-label','选择 '+g.author+' 第 '+(g.images.indexOf(im)+1)+' 张图片');b.setAttribute('aria-pressed','false');
        const img=new Image();img.loading='lazy';img.decoding='async';img.src=scope.XIF.mediaURL(im.url,'thumb');img.alt='第 '+(g.images.indexOf(im)+1)+' 张';const check=document.createElement('span');check.textContent=String(i+1);b.append(img,check);row.append(b);
      }
      g.media.after(row);this.paint(row);
    }
    paint(row){for(const b of row?.querySelectorAll('.bulk-photo')||[]){const index=[...this.selected.keys()].indexOf(b.dataset.url);b.setAttribute('aria-pressed',String(index>=0));b.querySelector('span').textContent=index>=0?'已选 '+(index+1):'选择';b.disabled=this.preparing;}}
    render(){this.toggle.setAttribute('aria-pressed',String(this.active));this.label.textContent=this.preparing?'正在准备图片…':'已选 '+this.selected.size+' / 20 张 · 按勾选顺序复制';this.copy.textContent=this.ready?'图片已准备 · 点击复制':this.selected.size?'复制所选 '+this.selected.size+' 张':'复制所选图片';this.copy.disabled=this.preparing||!this.selected.size;this.clear.disabled=this.exit.disabled=this.preparing;for(const row of this.root.querySelectorAll('.bulk-row'))this.paint(row);}
    async execute(){
      if(this.preparing||!this.selected.size)return;if(this.busy()){this.toast('上一组还在复制，请稍候');return;}
      const urls=[...this.selected.keys()];this.preparing=true;this.setBusy(true);this.render();let job=this.ready;this.ready=null;
      try{
        await this.aborting;
        if(!document.hasFocus())throw Error('请切回 X 再点复制');
        if(!job)job=await this.message({action:'bulk-prepare',urls});
        if(!document.hasFocus()){this.ready=job;job=null;this.toast('图片已准备，切回 X 后点击复制即可');return;}
        const result=await this.message({action:'batch-commit',jobId:job.jobId});job=null;
        if(result.count!==urls.length)throw Error('复制数量未确认，请重试');
        this.copied(urls);this.toast('已复制 '+urls.length+' 张独立图片，可到 QQ 粘贴');this.selected.clear();
      }catch(e){this.toast('批量复制未完成：'+e.message);if(/助手|native|host/i.test(e.message))this.helper();}
      finally{if(job)await this.message({action:'batch-abort',jobId:job.jobId}).catch(()=>{});this.preparing=false;this.setBusy(false);this.render();}
    }
    progress(msg){if(this.preparing)this.label.textContent='正在准备 '+msg.done+' / '+msg.total+' 张…';}
  }
  scope.XIFBulkPicker=BulkPicker;
})(globalThis);
