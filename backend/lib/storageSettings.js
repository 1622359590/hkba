const crypto = require('crypto');

const SETTINGS_ID = 1;
const DEFAULTS = Object.freeze({
  enabled: false,
  provider: 'local',
  region: '',
  endpoint: '',
  bucket: '',
  customDomain: '',
  objectPrefix: 'hkba/media',
});

function encryptionKey() {
  const material = process.env.CONFIG_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!material) throw new Error('CONFIG_ENCRYPTION_KEY or JWT_SECRET is required');
  return crypto.createHash('sha256').update(`hkba-storage-settings:${material}`).digest();
}

function encryptSecret(value) {
  if (!value) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join(':');
}

function decryptSecret(value) {
  if (!value) return '';
  const [version, iv, tag, encrypted] = String(value).split(':');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Invalid encrypted setting');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

function maskSecret(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 4) return '*'.repeat(text.length);
  return `${'*'.repeat(Math.max(8, text.length - 4))}${text.slice(-4)}`;
}

function validateOssSettings(input = {}, current = {}) {
  const fields = [];
  const enabled = input.enabled === true;
  const hasCredentials = Boolean(current.hasCredentials || (input.accessKeyId && input.accessKeySecret));
  if (enabled && !String(input.region || '').trim()) fields.push({ field: 'region', code: 'required', message: '請輸入 Region' });
  if (enabled && !String(input.bucket || '').trim()) fields.push({ field: 'bucket', code: 'required', message: '請輸入 Bucket' });
  if (enabled && !hasCredentials && !String(input.accessKeyId || '').trim()) fields.push({ field: 'accessKeyId', code: 'required', message: '請輸入 AccessKey ID' });
  if (enabled && !hasCredentials && !String(input.accessKeySecret || '').trim()) fields.push({ field: 'accessKeySecret', code: 'required', message: '請輸入 AccessKey Secret' });

  const customDomain = String(input.customDomain || '').trim();
  if (customDomain && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(customDomain)) {
    fields.push({ field: 'customDomain', code: 'url', message: '自訂域名必須是 http 或 https URL' });
  }
  const prefix = String(input.objectPrefix || DEFAULTS.objectPrefix).trim().replace(/^\/+|\/+$/g, '');
  if (!prefix || prefix.includes('..')) fields.push({ field: 'objectPrefix', code: 'format', message: '儲存目錄格式不正確' });
  return { ok: fields.length === 0, fields };
}

function rowToPrivate(row) {
  if (!row) return { ...DEFAULTS, accessKeyId: '', accessKeySecret: '', hasCredentials: false };
  const accessKeyId = decryptSecret(row.access_key_id_enc);
  const accessKeySecret = decryptSecret(row.access_key_secret_enc);
  return {
    enabled: Boolean(row.enabled),
    provider: row.provider || 'local',
    region: row.region || '',
    endpoint: row.endpoint || '',
    bucket: row.bucket || '',
    accessKeyId,
    accessKeySecret,
    customDomain: row.custom_domain || '',
    objectPrefix: row.object_prefix || DEFAULTS.objectPrefix,
    hasCredentials: Boolean(accessKeyId && accessKeySecret),
  };
}

function getStorageSettings(conn) {
  return rowToPrivate(conn.prepare('SELECT * FROM storage_settings WHERE id = ?').get(SETTINGS_ID));
}

function publicStorageSettings(conn) {
  const settings = getStorageSettings(conn);
  return {
    enabled: settings.enabled,
    provider: settings.provider,
    region: settings.region,
    endpoint: settings.endpoint,
    bucket: settings.bucket,
    customDomain: settings.customDomain,
    objectPrefix: settings.objectPrefix,
    hasCredentials: settings.hasCredentials,
    accessKeyIdMasked: maskSecret(settings.accessKeyId),
    accessKeySecretMasked: settings.accessKeySecret ? '********' : '',
  };
}

function saveStorageSettings(conn, input) {
  const current = getStorageSettings(conn);
  const accessKeyId = String(input.accessKeyId || '').trim() || current.accessKeyId;
  const accessKeySecret = String(input.accessKeySecret || '').trim() || current.accessKeySecret;
  const enabled = input.enabled === true;
  const validation = validateOssSettings(input, { hasCredentials: Boolean(accessKeyId && accessKeySecret) });
  if (!validation.ok) return validation;

  conn.prepare(`
    INSERT INTO storage_settings
      (id, provider, enabled, region, endpoint, bucket, access_key_id_enc, access_key_secret_enc, custom_domain, object_prefix, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      provider = excluded.provider,
      enabled = excluded.enabled,
      region = excluded.region,
      endpoint = excluded.endpoint,
      bucket = excluded.bucket,
      access_key_id_enc = excluded.access_key_id_enc,
      access_key_secret_enc = excluded.access_key_secret_enc,
      custom_domain = excluded.custom_domain,
      object_prefix = excluded.object_prefix,
      updated_at = datetime('now')
  `).run(
    SETTINGS_ID,
    enabled ? 'oss' : 'local',
    enabled ? 1 : 0,
    String(input.region || '').trim(),
    String(input.endpoint || '').trim(),
    String(input.bucket || '').trim(),
    encryptSecret(accessKeyId),
    encryptSecret(accessKeySecret),
    String(input.customDomain || '').trim().replace(/\/+$/, ''),
    String(input.objectPrefix || DEFAULTS.objectPrefix).trim().replace(/^\/+|\/+$/g, '')
  );
  return { ok: true, settings: publicStorageSettings(conn) };
}

module.exports = {
  DEFAULTS,
  decryptSecret,
  encryptSecret,
  getStorageSettings,
  maskSecret,
  publicStorageSettings,
  saveStorageSettings,
  validateOssSettings,
};
