const test = require('node:test'), assert = require('node:assert/strict');
const {plan} = require('../extension/collection-flow.js');
const images = Array.from({length: 4}, (_, i) => ({url: 'image-' + i}));
test('copy planning preserves independent albums and handles mixed videos', () => {
  assert.equal(plan([{type:'video'}]).kind, 'video');
  assert.deepEqual(plan([images[0], {type:'video'}]), {kind:'single', urls:['image-0']});
  assert.deepEqual(plan(images.slice(0,3)), {kind:'album', urls:['image-0','image-1','image-2']});
  assert.equal(plan(images, {suggested:false,mode:'grid',order:[0,1,2,3]}).kind, 'album');
});
test('only complete valid slice orders may merge; no duplicate or omitted image', () => {
  assert.deepEqual(plan(images, {suggested:true,mode:'grid',order:[3,1,0,2]}), {kind:'slice',urls:['image-3','image-1','image-0','image-2'],mode:'grid',blend:true});
  for (const order of [[0,0,1,2],[0,1,2],[0,1,2,4],[-1,1,2,3]]) assert.equal(plan(images,{suggested:true,mode:'grid',order}).kind,'album');
  assert.equal(plan(images.slice(0,3),{suggested:true,mode:'grid',order:[0,1,2]}).kind,'album');
});
