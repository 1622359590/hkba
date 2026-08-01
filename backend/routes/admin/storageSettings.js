const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/requirePermission');
const { getDb } = require('../../db/init');
const { requestContext } = require('../../lib/respond');
const { auditEvent, recordAudit } = require('../../lib/audit');
const {
  getStorageSettings,
  publicStorageSettings,
  saveStorageSettings,
  validateOssSettings,
} = require('../../lib/storageSettings');
const { testOssConnection } = require('../../lib/objectStorage');

const router = express.Router();
router.use(requestContext);
router.use(authMiddleware, requirePermission('system.admin'));

router.get('/', (req, res) => {
  res.ok({ settings: publicStorageSettings(getDb()) });
});

router.patch('/', (req, res) => {
  const conn = getDb();
  const result = saveStorageSettings(conn, req.body || {});
  if (!result.ok) return res.fail('VALIDATION_FAILED', 'OSS 配置不完整', result.fields);

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'storage.settings.update',
    objectType: 'storage_settings',
    objectId: '1',
    detail: {
      enabled: result.settings.enabled,
      region: result.settings.region,
      bucket: result.settings.bucket,
      customDomain: result.settings.customDomain,
      credentialsChanged: Boolean(req.body?.accessKeyId || req.body?.accessKeySecret),
    },
  }));
  res.ok({ settings: result.settings });
});

router.post('/test', async (req, res) => {
  const conn = getDb();
  const saved = getStorageSettings(conn);
  const candidate = {
    ...saved,
    ...req.body,
    accessKeyId: String(req.body?.accessKeyId || '').trim() || saved.accessKeyId,
    accessKeySecret: String(req.body?.accessKeySecret || '').trim() || saved.accessKeySecret,
  };
  const validation = validateOssSettings({ ...candidate, enabled: true }, { hasCredentials: Boolean(candidate.accessKeyId && candidate.accessKeySecret) });
  if (!validation.ok) return res.fail('VALIDATION_FAILED', '請先補齊 OSS 配置', validation.fields);

  try {
    await testOssConnection(candidate);
    res.ok({ connected: true, message: 'OSS 連接成功' });
  } catch (error) {
    console.error('OSS connection test failed:', error?.code || error?.name || 'unknown');
    res.fail('OSS_CONNECTION_FAILED', '無法連接 OSS，請檢查 Region、Bucket、Endpoint 與 AccessKey 權限');
  }
});

module.exports = router;
