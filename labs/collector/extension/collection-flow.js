(function(scope) {
  'use strict';
  function plan(images, suggestion) {
    const photos = images.filter(im => im.type !== 'video').slice(0, 4);
    if (!photos.length) return {kind: 'video', urls: []};
    if (photos.length === 1) return {kind: 'single', urls: photos.map(im => im.url)};
    const order = suggestion?.order;
    const valid = suggestion?.suggested === true && Array.isArray(order) && order.length === photos.length && new Set(order).size === photos.length && order.every(i => Number.isInteger(i) && i >= 0 && i < photos.length) && ['horizontal', 'vertical', 'grid'].includes(suggestion.mode) && (suggestion.mode !== 'grid' || photos.length === 4);
    return valid ? {kind: 'slice', urls: order.map(i => photos[i].url), mode: suggestion.mode, blend: true} : {kind: 'album', urls: photos.map(im => im.url)};
  }
  scope.XIFCollection = {plan};
  if (typeof module !== 'undefined') module.exports = scope.XIFCollection;
})(globalThis);
