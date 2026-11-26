const test=require('node:test'),assert=require('node:assert/strict');
const X=require('../labs/collector/extension/shared.js'),L=require('../labs/collector/extension/library-store.js'),B=require('../labs/collector/extension/bulk-plan.js');
test('X filename URLs and query URLs have one canonical source and thumbnail identity',()=>{
 const a='https://pbs.twimg.com/media/Example_Ab-1.jpg?name=orig',b='https://pbs.twimg.com/media/Example_Ab-1?name=small&format=jpg';
 assert.equal(X.mediaURL(a),X.mediaURL(b));assert.equal(X.mediaURL(a,'small'),X.mediaURL(b,'small'));assert.equal(X.photoKey(a),X.photoKey(b));
 assert.equal(X.mediaURL('https://pbs.twimg.com/media/Example.jpeg?name=large'),X.mediaURL(b.replace('Example_Ab-1','Example')));
 assert.notEqual(X.photoKey(a),X.photoKey(a.replace('Ab-1','Ab-2')));
 assert.throws(()=>X.photoKey('https://other.example/media/Example.jpg'));
});
test('duplicate old photos merge progress and preserve the first original hash and order',()=>{
 const photos=[{url:'https://pbs.twimg.com/media/A?format=jpg&name=orig',hash:'a',copiedAt:0},{url:'https://pbs.twimg.com/media/A.jpg',hash:'b',copiedAt:100},{url:'https://pbs.twimg.com/media/B.png',hash:'c',copiedAt:20}];const unique=X.uniquePhotos(photos);
 assert.equal(unique.length,2);assert.equal(unique[0].hash,'a');assert.equal(unique[0].copiedAt,100);assert.equal(unique[1].hash,'c');assert.equal(photos[0].copiedAt,0);assert.deepEqual(X.uniquePhotos(unique),unique);
});
test('archive and clipboard validators cannot count URL spellings as two photos',()=>{
 const a='https://pbs.twimg.com/media/A.jpg',b='https://pbs.twimg.com/media/A?format=jpg',source={id:'123',href:'https://x.com/artist/status/123',images:[{url:a},{url:b}]};assert.equal(L.input(source).images.length,1);
 assert.throws(()=>B.validate([{urls:[a]},{urls:[b]}]),/重复/);assert.throws(()=>B.validate([{urls:[a,b],mode:'horizontal',blend:false,seams:[{overlap:0,shift:0}]}]),/重复/);
});
