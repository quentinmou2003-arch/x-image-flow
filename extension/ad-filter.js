/* Recognize explicit X advertising signals, never tweet keywords or authors. */
(function(scope) {
  'use strict';
  function tweetID(result) {
    for (let i = 0; result && i < 4; i++) {
      if (result.__typename === 'User') return '';
      if (result.tweet) { result = result.tweet; continue; }
      const id = String(result.legacy?.id_str || result.rest_id || result.id_str || '');
      return /^\d{1,30}$/.test(id) ? id : '';
    }
    return '';
  }
  function extract(json) {
    const ids = new Set(), stack = [{value: json, depth: 0}]; let steps = 0;
    while (stack.length && steps++ < 40000) {
      const {value, depth} = stack.pop();
      if (!value || typeof value !== 'object' || depth > 35) continue;
      // Metadata belongs to this timeline item, not its advertiser or quoted tweet.
      if (value.promotedMetadata || value.promoted_metadata) {
        const id = tweetID(value.tweet_results?.result || value.tweetResult?.result || value.tweet);
        if (id) ids.add(id);
      }
      if (/^promoted[-_]/i.test(String(value.entryId || value.entry_id || ''))) {
        const item = value.content?.itemContent || value.content?.item?.itemContent;
        const id = tweetID(item?.tweet_results?.result || item?.tweetResult?.result);
        if (id) ids.add(id);
      }
      for (const child of Object.values(value)) if (child && typeof child === 'object') stack.push({value: child, depth: depth + 1});
    }
    return [...ids];
  }
  const markers = '[data-testid="placementTracking"],[data-testid="promotedIndicator"],[data-promoted="true"]';
  const labels = new Set(['ad', 'ads', 'promoted', 'sponsored', '广告', '廣告', '推广', '推廣', '已推广', '已推廣', '赞助', '贊助']);
  const content = '[data-testid="tweetText"],[data-testid="User-Name"],[data-testid="tweetPhoto"],[data-testid="videoPlayer"],[data-testid="videoComponent"],[data-testid="quoteTweet"],[data-testid="card.wrapper"],a,[role="link"]';
  function articleIsAd(article) {
    if (article.closest(markers)) return true;
    for (const node of article.querySelectorAll(markers + ',span,[aria-label]')) {
      if (node.closest('article[data-testid="tweet"]') !== article) continue;
      // Text, author names, media and quoted/link cards may mention advertising.
      if (node.closest(content)) continue;
      if (node.matches(markers)) return true;
      if (node.querySelector(content)) continue;
      const label = (node.getAttribute('aria-label') || node.textContent || '').trim().toLowerCase();
      if (labels.has(label)) return true;
    }
    return false;
  }
  scope.XIFAds = {extract, articleIsAd};
  if (typeof module !== 'undefined') module.exports = scope.XIFAds;
})(globalThis);
