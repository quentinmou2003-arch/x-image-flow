/* Move the original controls, retaining their handlers and saved preferences. */
(function(scope){
  'use strict';
  class SettingsUI{
    constructor({root,open,close,cloud}){
      const drawer=document.createElement('section');drawer.className='settings hidden';drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-label','拾图设置');
      const sheet=document.createElement('div');sheet.className='settings-sheet';
      const head=document.createElement('div');head.className='modalhead';const title=document.createElement('b');title.textContent='设置';const dismiss=document.createElement('button');dismiss.className='dismiss';dismiss.textContent='完成';dismiss.onclick=()=>close('.settings');head.append(title,dismiss);
      const body=document.createElement('div');body.className='settings-body';sheet.append(head,body);drawer.append(sheet);root.append(drawer);
      const button=document.createElement('button');button.className='settings-button';button.textContent='设置';button.onclick=()=>{open('.settings');refreshStatus();};root.querySelector('.tools .close').before(button);
      const section=(name)=>{const el=document.createElement('section'),h=document.createElement('h3');h.textContent=name;el.append(h);body.append(el);return el;};
      const move=(parent,selector,label,note)=>{const control=root.querySelector(selector);if(!control)return;const row=document.createElement('div');row.className='settings-row';const text=document.createElement('div'),name=document.createElement('b');name.textContent=label;text.append(name);if(note){const small=document.createElement('small');small.textContent=note;text.append(small);}row.append(text,control);parent.append(row);};
      const browse=section('浏览');move(browse,'.gallery-order','排列方式','顺序收图或瀑布流');move(browse,'.density','图片大小','调整每屏的信息密度');move(browse,'.speed','提前加载','关闭后仍会自动向下续载');move(browse,'.ad-filter','广告过滤','跳过 X 标记的推广内容');
      const collect=section('点赞与收藏');move(collect,'.auto-copy','点赞后复制','点赞成功后准备图片，仍需手动粘贴发送');move(collect,'.auto-archive','点赞后收下','将整组原图与出处保存到本地库；云端需另行授权');
      if(root.querySelector('.library-button')){const sync=section('云端'),row=document.createElement('div');row.className='settings-row';const label=document.createElement('div');label.innerHTML='<b>Google Drive</b><small>首次配置、登录授权与同步状态</small>';const connect=document.createElement('button');connect.className='drive-settings';connect.textContent='连接与设置';connect.onclick=()=>{close('.settings');cloud();};row.append(label,connect);sync.append(row);}
      const tools=section('工具与帮助');move(tools,'.hidden-manager-button','已隐藏的推文','管理本机隐藏记录');move(tools,'.helper-settings','Windows 小助手','安装、查看扩展 ID 和检查连接');move(tools,'.helpbtn','复制到 QQ','查看复制与发送说明');
      const help=root.querySelector('.help');if(help){body.append(help);for(const selector of ['.helper-settings','.helpbtn']){const control=root.querySelector(selector),original=control?.onclick;if(original)control.onclick=()=>{original();help.scrollIntoView({block:'nearest'});};}}
      async function refreshStatus(){
        const helperNote=root.querySelector('.helper-settings')?.closest('.settings-row')?.querySelector('small');
        if(helperNote)helperNote.textContent='正在自动检测连接…';
        try{const result=await chrome.runtime.sendMessage({target:'worker',action:'helper-check'});if(helperNote)helperNote.textContent=result?.ok?'已连接 · 助手 '+(result.version||''):'首次运行安装小助手，之后自动检测连接';}catch{if(helperNote)helperNote.textContent='首次运行安装小助手，之后自动检测连接';}
        const row=root.querySelector('.auto-copy')?.closest('section');if(row&&!row.querySelector('.social-status')){const hint=document.createElement('p');hint.className='social-status';hint.style.cssText='color:#71767b;font-size:11px;line-height:1.7';row.append(hint);}
        try{const saved=await chrome.storage.local.get('xif-social-templates-v1'),count=Object.keys(saved['xif-social-templates-v1']||{}).length;const hint=row?.querySelector('.social-status');if(hint)hint.textContent=count?'已记住 '+count+' 项 X 网页操作；接口变化时会提示重新学习':'X 接口会在正常点赞、书签时自动学习；首次需要在 X 操作一次。';}catch{}
      }
      // Keep secondary dialogs focused and avoid leaving an inert settings sheet beneath them.
      const hidden=root.querySelector('.hidden-manager-button');if(hidden){const original=hidden.onclick;hidden.onclick=()=>{close('.settings');original();};}
      drawer.addEventListener('click',event=>{if(event.target===drawer)close('.settings');});
    }
  }
  scope.XIFSettingsUI=SettingsUI;
})(globalThis);
