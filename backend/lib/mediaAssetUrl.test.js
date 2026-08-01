const test = require('node:test');
const assert = require('node:assert/strict');
const { mediaAssetUrl } = require('./mediaAssetUrl');

test('media assets use stored OSS URLs and preserve local upload URLs', () => {
  assert.equal(mediaAssetUrl({ storage_key: 'hkba/media/a.png', public_url: 'https://cdn.hkba.club/hkba/media/a.png' }), 'https://cdn.hkba.club/hkba/media/a.png');
  assert.equal(mediaAssetUrl({ storage_key: 'media/b.png', public_url: null }), '/uploads/media/b.png');
});
