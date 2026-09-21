const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../extension');
const shared = require('../extension/shared.js');
const video = require('../extension/video-meta.js');

test('manifest references exist and JavaScript parses', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  const files = [manifest.background.service_worker, ...manifest.content_scripts.flatMap(s => s.js), ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon), ...manifest.web_accessible_resources.flatMap(r => r.resources), 'offscreen.html', 'offscreen.js'];
  for (const file of files) assert(fs.existsSync(path.join(root, file)), file);
  for (const file of fs.readdirSync(root).filter(f => f.endsWith('.js'))) execFileSync(process.execPath, ['--check', path.join(root, file)]);
});

test('media URL rules keep original size and reject other hosts', () => {
  const url = new URL(shared.mediaURL('https://pbs.twimg.com/media/example?format=jpg&name=small'));
  assert.equal(url.searchParams.get('name'), 'orig');
  assert.throws(() => shared.mediaURL('https://example.com/media/example'));
  assert.throws(() => shared.mediaURL('https://pbs.twimg.com/profile_images/example'));
  assert.equal(shared.status('https://example.com/a/status/123'), null);
});

test('stitch geometry preserves dimensions and rejects oversized output', () => {
  const sizes = [{width:100,height:200},{width:150,height:200}];
  const horizontal = shared.geometry(sizes, 'horizontal');
  assert.equal(horizontal.width,250); assert.equal(horizontal.height,200);
  const vertical = shared.geometry(sizes, 'vertical');
  assert.equal(vertical.width,150); assert.equal(vertical.height,400);
  assert.throws(() => shared.geometry([{width:32767,height:32767},{width:32767,height:32767}], 'horizontal'));
});

test('tweet counts distinguish missing data from zero', () => {
  const records = video.extract({rest_id:'123',legacy:{favorite_count:0,bookmark_count:56}});
  assert.deepEqual(records[0].counts,{like:0,bookmark:56});
  assert.deepEqual(video.extract({rest_id:'124',legacy:{favorite_count:2}})[0].counts,{like:2});
});

test('video sources reject unknown hosts and prefer the lowest bitrate', () => {
  const sources = video.variants([{url:'https://video.twimg.com/640x360/high.mp4',bitrate:800000},{url:'https://video.twimg.com/160x90/low.mp4',bitrate:200000},{url:'https://example.com/video.mp4',bitrate:1}]);
  assert.equal(sources.length,2); assert.equal(sources[0].bitrate,200000);
});
