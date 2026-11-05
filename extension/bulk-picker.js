(function(scope){
  'use strict';
  class BulkPicker{
    constructor({root,groups,message,toast,copied,busy,setBusy,helper,stitch}){
      Object.assign(this,{root,groups,message,toast,copied,busy,setBusy,helper,stitch});this.selected=new Map();this.plans=new Map();this.active=false;this.preparing=false;this.ready=null;this.aborting=Promise.resolve();
      this.toggle=this.button('批量复制','bulk-toggle',()=>this.enable(!this.active));this.toggle.title='选择独立图片或确认拼接图，一次复制到 QQ';root.querySelector('.tools').prepend(this.toggle);
      this.bar=document.createElement('div');this.bar.className='bulk-bar hidden';this.label=document.createElement('span');
      this.copy=this.button('复制所选图片','primary',()=>this.execute());this.clear=this.button('清空选择','',()=>{this.invalidate();this.selected.clear();this.render();});this.exit=this.button('退出批量','',()=>this.enable(false));
      this.bar.append(this.label,this.copy,this.clear,this.exit);root.querySelector('.tabs').after(this.bar);this.render();
    }
    button(text,cls,action){const b=document.createElement('button');b.textContent=text;b.className=cls;b.onclick=action;return b;}
    photos(g){return g.images.filter(im=>im.type!=='video'&&!scope.XIFMotion.isGIF(im));}
    key(g){return 'stitch:'+g.id;}
    invalidate(){if(this.ready){const job=this.ready;this.ready=null;this.aborting=this.message({action:'batch-abort',jobId:job.jobId}).catch(()=>{});}}
    enable(value){if(this.preparing){this.toast('正在准备图片，请稍候');return;}this.active=value;this.root.querySelector('.panel').classList.toggle('bulk-mode',value);if(!value){this.invalidate();this.selected.clear();this.plans.clear();}this.bar.classList.toggle('hidden',!value);for(const g of this.groups())this.update(g);this.render();}
    toggleItem(key,item){if(this.preparing)return;this.invalidate();if(this.selected.has(key))this.selected.delete(key);else{if([...this.selected.values()].some(p=>p.urls.some(url=>item.urls.includes(url)))){this.toast('原片已包含在所选图片中，请先取消重复项');return;}if(this.selected.size>=20){this.toast('每批最多选择 20 张输出图片，请先复制这一批');return;}this.selected.set(key,item);}this.render();}
    independent(g){if(this.preparing)return;this.invalidate();this.selected.delete(this.key(g));this.plans.delete(g.id);this.render();}
    preview(g){
      if(this.preparing||this.busy()){this.toast('正在准备图片，请稍候');return;}
      const photos=this.photos(g);if(photos.length<2)return;
      const suggestion=scope.XIFCollection.plan(photos,g.suggestion).kind==='slice'?g.suggestion:null;
      this.stitch(photos,suggestion,{plan:this.plans.get(g.id),onConfirm:plan=>this.confirm(g,plan)});
    }
    confirm(g,plan){
      if(!this.active||this.preparing)return false;
      const sources=new Set(this.photos(g).map(p=>p.url));
      if(!plan.urls.every(url=>sources.has(url))){this.toast('图片组已变化，请重新预览');return false;}
      const key=this.key(g),keys=[...this.selected.keys()].filter(k=>k===key||sources.has(k));
      if([...this.selected].some(([k,p])=>!keys.includes(k)&&p.urls.some(url=>plan.urls.includes(url)))){this.toast('其他所选拼接图已包含相同原片，请先取消重复项');return false;}
      if(this.selected.size-keys.length>=20){this.toast('已选满 20 张，请先移除一张');return false;}
      this.invalidate();
      // Replace this group's old selection at its first queue position.
      const item={...plan,name:scope.XIF.imageName(g,1,true),urls:[...plan.urls],seams:plan.seams.map(s=>({...s}))},next=new Map();let inserted=false;
      for(const [k,value]of this.selected){if(keys.includes(k)){if(!inserted){next.set(key,item);inserted=true;}}else next.set(k,value);}
      if(!inserted)next.set(key,item);this.selected=next;this.plans.set(g.id,item);this.render();this.toast('拼接图已加入批量队列，按 1 张复制');return true;
    }
    update(g){
      if(!this.active)return;
      const photos=this.photos(g),key=photos.map(im=>im.url).join('|');
      if(g.bulkKey===key){this.paint(g.bulkRow);return;}
      g.bulkRow?.remove();g.bulkKey=key;if(!photos.length)return;
      const row=document.createElement('div');row.className='bulk-row';g.bulkRow=row;row.dataset.group=g.id;row.bulkGroup=g;
      if(photos.length>1){const modes=document.createElement('div');modes.className='bulk-modes';modes.append(this.button('独立图片','bulk-independent',()=>this.independent(g)),this.button('拼接一张','bulk-stitch',()=>this.preview(g)));row.append(modes);}
      const tiles=document.createElement('div');tiles.className='bulk-photos';
      for(const im of photos)tiles.append(this.tile(im.url,'选择 '+g.author+' 第 '+(g.images.indexOf(im)+1)+' 张图片',()=>this.toggleItem(im.url,{urls:[im.url],name:scope.XIF.imageName(g,g.images.indexOf(im)+1)})));
      row.append(tiles);
      if(photos.length>1){const result=document.createElement('div');result.className='bulk-result';result.append(this.tile(this.key(g),'选择 '+g.author+' 的拼接图',()=>{const plan=this.plans.get(g.id);if(plan)this.toggleItem(this.key(g),plan);},photos[0].url),this.button('调整拼接','bulk-edit',()=>this.preview(g)));row.append(result);}
      g.media.after(row);this.paint(row);
    }
    tile(key,label,click,thumbnail=key){const b=this.button('','bulk-photo',click);b.dataset.key=key;b.dataset.url=key;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed','false');const img=new Image();img.loading='lazy';img.decoding='async';img.src=scope.XIF.mediaURL(thumbnail,'thumb');img.alt='选择预览';b.append(img,document.createElement('span'));return b;}
    paint(row){
      if(!row)return;const g=row.bulkGroup,plan=this.plans.get(row.dataset.group),stitched=!!plan;
      row.querySelector('.bulk-photos').hidden=stitched;const result=row.querySelector('.bulk-result');if(result)result.hidden=!stitched;
      const independent=row.querySelector('.bulk-independent'),stitch=row.querySelector('.bulk-stitch');
      if(stitch){independent.setAttribute('aria-pressed',String(!stitched));stitch.setAttribute('aria-pressed',String(stitched));stitch.textContent=g?.suggestion?.suggested?'拼接一张 · 推荐':'拼接一张';independent.disabled=stitch.disabled=this.preparing;row.querySelector('.bulk-edit').disabled=this.preparing;}
      const keys=[...this.selected.keys()];for(const b of row.querySelectorAll('.bulk-photo')){const index=keys.indexOf(b.dataset.key);b.setAttribute('aria-pressed',String(index>=0));b.querySelector('span').textContent=index>=0?'已选 '+(index+1)+(b.dataset.key.startsWith('stitch:')?' · 拼接':''):stitched&&b.dataset.key.startsWith('stitch:')?'选择拼接图':'选择';b.disabled=this.preparing;}
    }
    render(){this.toggle.setAttribute('aria-pressed',String(this.active));const joined=[...this.selected.values()].filter(p=>p.urls.length>1).length;this.label.textContent=this.preparing?'正在准备图片…':'已选 '+this.selected.size+' / 20 张'+(joined?' · 含 '+joined+' 张拼接图':'')+' · 按选择顺序复制';this.copy.textContent=this.ready?'图片已准备 · 点击复制':this.selected.size?'复制所选 '+this.selected.size+' 张':'复制所选图片';this.copy.disabled=this.preparing||!this.selected.size;this.clear.disabled=this.exit.disabled=this.preparing;for(const row of this.root.querySelectorAll('.bulk-row'))this.paint(row);}
    async execute(){
      if(this.preparing||!this.selected.size)return;if(this.busy()){this.toast('上一组还在复制，请稍候');return;}
      const items=[...this.selected.values()].map(p=>({urls:[...p.urls],name:p.name,...(p.mode?{mode:p.mode,blend:p.blend,seams:p.seams.map(s=>({...s}))}:{})})),urls=items.flatMap(p=>p.urls);this.preparing=true;this.setBusy(true);this.render();let job=this.ready;this.ready=null;
      try{
        await this.aborting;if(!document.hasFocus())throw Error('请切回 X 再点复制');
        if(!job)job=await this.message({action:'bulk-prepare',items});
        if(!document.hasFocus()){this.ready=job;job=null;this.toast('图片已准备，切回 X 后点击复制即可');return;}
        const result=await this.message({action:'batch-commit',jobId:job.jobId});job=null;
        if(result.count!==items.length)throw Error('复制数量未确认，请重试');
        this.copied(urls);this.toast('已复制 '+items.length+' 张图片，可到 QQ 粘贴');this.selected.clear();
      }catch(e){this.toast('批量复制未完成：'+e.message);if(/助手|native|host/i.test(e.message))this.helper();}
      finally{if(job)await this.message({action:'batch-abort',jobId:job.jobId}).catch(()=>{});this.preparing=false;this.setBusy(false);this.render();}
    }
    progress(msg){if(this.preparing)this.label.textContent='正在准备 '+msg.done+' / '+msg.total+' 张输出图片…';}
  }
  scope.XIFBulkPicker=BulkPicker;
})(globalThis);
