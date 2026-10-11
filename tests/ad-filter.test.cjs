const test = require('node:test');
const assert = require('node:assert/strict');
const ads = require('../extension/ad-filter.js');
const video = require('../extension/video-meta.js');
function tweet(id, extra = {}) { return {__typename: 'Tweet', rest_id: id, legacy: {id_str: id, favorite_count: 0}, ...extra}; }

test('ad metadata identifies the outer post, never advertiser or quoted originals', () => {
  const json = {content: {items: [{item: {itemContent: {
    promotedMetadata: {advertiser_results: {result: {__typename: 'User', rest_id: '999'}}},
    tweet_results: {result: tweet('100', {quoted_status_result: {result: tweet('101')}})}
  }}}]}};
  assert.deepEqual(ads.extract(json), ['100']);
  const records = video.extract(json);
  assert.equal(records.find(r => r.id === '100').promoted, true);
  assert.equal(records.find(r => r.id === '101').promoted, undefined);
  assert.equal(records.some(r => r.id === '999'), false);
});

test('promoted entries, snake case metadata and visibility wrappers are supported', () => {
  const json = [
    {entryId: 'promoted-tweet-200', content: {itemContent: {tweet_results: {result: {__typename: 'TweetWithVisibilityResults', tweet: tweet('200')}}}}},
    {promoted_metadata: {}, tweet_results: {result: tweet('201')}},
    {promotedMetadata: {}, tweet_results: {result: tweet('201')}},
    {promotedMetadata: {}, tweet_results: {result: {__typename: 'User', rest_id: '300'}}},
    {promotedMetadata: {}, tweet_results: {result: {rest_id: 'not-a-tweet'}}}
  ];
  assert.deepEqual(ads.extract(json).sort(), ['200', '201']);
});

test('ordinary content mentioning ads is preserved; empty ad-only records still emit', () => {
  const ordinary = tweet('400', {full_text: 'Ad 广告 推广', core: {user_results: {result: {rest_id: '401', name: 'Sponsored'}}}});
  assert.deepEqual(ads.extract(ordinary), []);
  const records = video.extract({promotedMetadata: {}, tweet_results: {result: {__typename: 'Tweet', rest_id: '402'}}});
  assert.equal(records.length, 1);
  assert.equal(records[0].id, '402');
  assert.equal(records[0].promoted, true);
  assert.deepEqual(records[0].media, []);
});
