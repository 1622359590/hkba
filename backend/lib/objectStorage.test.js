const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret-for-object-storage-0123456789';

const {
  buildOssPublicUrl,
  deleteOssObject,
  putOssObject,
  testOssConnection,
} = require('./objectStorage');

const settings = {
  region: 'oss-cn-hongkong',
  endpoint: '',
  bucket: 'hkba-media',
  accessKeyId: 'key-id',
  accessKeySecret: 'key-secret',
  customDomain: 'https://cdn.hkba.club',
};

test('OSS public URLs prefer the configured CDN domain', () => {
  assert.equal(buildOssPublicUrl(settings, 'hkba/media/a.png'), 'https://cdn.hkba.club/hkba/media/a.png');
});

test('OSS upload uses public-read and returns the configured public URL', async () => {
  let call;
  const clientFactory = () => ({
    put: async (...args) => { call = args; return { url: 'https://internal.example/a.png' }; },
  });
  const result = await putOssObject(settings, {
    key: 'hkba/media/a.png',
    content: Buffer.from('png'),
    mimeType: 'image/png',
  }, clientFactory);
  assert.equal(result.url, 'https://cdn.hkba.club/hkba/media/a.png');
  assert.equal(call[0], 'hkba/media/a.png');
  assert.equal(call[2].headers['Content-Type'], 'image/png');
  assert.equal(call[2].headers['x-oss-object-acl'], 'public-read');
});

test('OSS connection test and deletion delegate to the SDK client', async () => {
  const calls = [];
  const clientFactory = () => ({
    list: async (query) => { calls.push(['list', query]); return { objects: [] }; },
    delete: async (key) => { calls.push(['delete', key]); },
  });
  await testOssConnection(settings, clientFactory);
  await deleteOssObject(settings, 'hkba/media/a.png', clientFactory);
  assert.deepEqual(calls, [
    ['list', { 'max-keys': 1 }],
    ['delete', 'hkba/media/a.png'],
  ]);
});
