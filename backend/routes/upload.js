const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../middleware/requirePermission');
const { getDb } = require('../db/init');
const { getStorageSettings } = require('../lib/storageSettings');
const { putOssObject } = require('../lib/objectStorage');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

function getSafeSubdir(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value)) return 'general';
  return value;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg|ico|pdf)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('不支援的檔案格式'));
    }
  }
});

async function storeFile(file, sub) {
  const settings = getStorageSettings(getDb());
  const extension = path.extname(file.originalname).toLowerCase();
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${extension}`;
  if (settings.enabled && settings.provider === 'oss') {
    const key = `${settings.objectPrefix}/${sub}/${filename}`;
    const uploaded = await putOssObject(settings, { key, content: file.buffer, mimeType: file.mimetype });
    return { url: uploaded.url, filename, size: file.size };
  }
  const key = `${sub}/${filename}`;
  const absolute = path.join(uploadsDir, key);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, file.buffer);
  return { url: `/uploads/${key}`, filename, size: file.size };
}

router.post('/', authMiddleware, requirePermission('content.write'), upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: '未選擇檔案' });
  const sub = getSafeSubdir(req.query.dir);
  try {
    res.json(await storeFile(req.file, sub));
  } catch (error) {
    next(error);
  }
});

// 多文件上传
router.post('/multiple', authMiddleware, requirePermission('content.write'), upload.array('files', 10), async (req, res, next) => {
  if (!req.files?.length) return res.status(400).json({ error: '未選擇檔案' });
  const sub = getSafeSubdir(req.query.dir);
  try {
    res.json(await Promise.all(req.files.map((file) => storeFile(file, sub))));
  } catch (error) {
    next(error);
  }
});

router.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: '檔案大小不可超過 5MB' });
  if (err?.message === '不支援的檔案格式') return res.status(400).json({ error: err.message });
  if (getStorageSettings(getDb()).enabled) {
    console.error('legacy OSS upload failed:', err?.code || err?.name || 'unknown');
    return res.status(502).json({ error: 'OSS 上傳失敗，請檢查儲存設置' });
  }
  next(err);
});

module.exports = router;
