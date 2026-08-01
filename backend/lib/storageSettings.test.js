const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-secret-for-storage-settings-0123456789';

const {
  decryptSecret,
  encryptSecret,
  maskSecret,
  validateOssSettings,
} = require('./storageSettings');

test('OSS credentials are encrypted at rest and decrypt to the original value', () => {
  const encrypted = encryptSecret('LTAI-secret-value');
  assert.ok(!encrypted.includes('LTAI-secret-value'));
  assert.equal(decryptSecret(encrypted), 'LTAI-secret-value');
});

test('secret masks reveal only the final four characters', () => {
  assert.equal(maskSecret('LTAI12345678'), '********5678');
  assert.equal(maskSecret('abc'), '***');
});

test('enabled OSS settings require connection and credential fields', () => {
  const result = validateOssSettings({ enabled: true, bucket: '', region: '' }, { hasCredentials: false });
  assert.equal(result.ok, false);
  assert.deepEqual(result.fields.map((item) => item.field).sort(), [
    'accessKeyId',
    'accessKeySecret',
    'bucket',
    'region',
  ]);
});

test('existing credentials can be preserved when updating non-secret OSS fields', () => {
  const result = validateOssSettings(
    { enabled: true, bucket: 'hkba-media', region: 'oss-cn-hongkong', accessKeyId: '', accessKeySecret: '' },
    { hasCredentials: true }
  );
  assert.equal(result.ok, true);
});
