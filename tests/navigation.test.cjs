const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
for(const folder of ['extension','labs/collector/extension']){
 const nav=require(path.join(__dirname,'..',folder,'navigation.js'));
 test(folder+': author pages expose the correct homepage and explicit return label',()=>{
  for(const [suffix,label] of [['','返回 @hakanai_yuma'],['/media','返回媒体页'],['/with_replies','返回回复页'],['/likes','返回喜欢页'],['/followers','返回关注者页']]){
   const view=nav.describe('https://x.com/hakanai_yuma'+suffix+'/?foo=1#photos','https://x.com');
   assert.equal(view.label,label);assert.equal(view.handle,'hakanai_yuma');assert.equal(view.profileURL,'https://x.com/hakanai_yuma');
  }
  assert.equal(nav.describe('https://twitter.com/artist/media','https://twitter.com').profileURL,'https://twitter.com/artist');
 });
 test(folder+': X routes and malformed author paths never become profile links',()=>{
  for(const route of ['/home','/explore','/search','/settings','/i/bookmarks','/notifications','/messages','/intent','/artist/status/123','/artist/not_a_tab','/username_is_too_long','/HOME','/a%2Fb/media'])assert.equal(nav.describe('https://x.com'+route,'https://x.com').profileURL,null,route);
  assert.equal(nav.describe('https://x.com/home','https://x.com').label,'返回 X 首页');
  assert.equal(nav.describe('https://x.com/i/bookmarks','https://x.com').label,'返回书签页');
  assert.equal(nav.describe('https://x.com/search?q=cats','https://x.com').label,'返回搜索页');
 });
 test(folder+': return destinations preserve the original route and safe scroll position within this site',()=>{
  const target={href:'https://x.com/artist/media?filter=photos#latest',x:2.8,y:450.9};
  assert.deepEqual(nav.restore(target,'https://x.com'),{href:target.href,x:2,y:450});
  assert.deepEqual(nav.restore({href:target.href,x:Infinity,y:-1},'https://x.com'),{href:target.href,x:0,y:0});
  for(const href of ['https://evil.example/artist','https://x.com.evil.example/artist','javascript:alert(1)','/artist','https://user:secret@x.com/artist','https://twitter.com/artist'])assert.equal(nav.restore({href},'https://x.com'),null,href);
  assert.equal(nav.restore(null,'https://x.com'),null);assert.equal(nav.restore({href:'https://evil.example/artist'},'https://evil.example'),null);
 });
}
