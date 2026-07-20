// Media library admin API (spec: data-api §7; decisions D8, D10).
//
// Mounted at /api/admin/media. All responses use the unified envelope
// (lib/respond.js). Upload/update/trash require content.write; permanent
// deletion requires media.delete and is refused while any reference exists
// (stricter than spec §7's "formal references only": draft references break
// too, so they also block). D10 keeps storage on local disk, so upload is a
// single multipart POST; responsive variants stay an empty array until the
// image-processing milestone.

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/requirePermission');
const { requestContext } = require('../../lib/respond');
const { getDb } = require('../../db/init');
const { recordAudit, auditEvent } = require('../../lib/audit');
const {
  MediaRejected,
  storeUpload,
  removeStored,
  PDF_MAX_BYTES,
} = require('../../lib/mediaStore');

router.use(requestContext);

const read = [authMiddleware, requirePermission('content.read')];
const write = [authMiddleware, requirePermission('content.write')];
const erase = [authMiddleware, requirePermission('media.delete')];

// Largest accepted payload is a PDF (30 MB); per-kind limits are enforced by
// mediaStore after sniffing.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PDF_MAX_BYTES, files: 1 },
});

function assetJson(row) {
  return {
    id: row.id,
    url: `/uploads/${row.storage_key}`,
    storageKey: row.storage_key,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    kind: row.mime_type === 'application/pdf' ? 'pdf' : 'image',
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    checksum: row.checksum,
    status: row.status,
    altZh: row.alt_zh,
    altEn: row.alt_en,
    captionZh: row.caption_zh,
    captionEn: row.caption_en,
    variants: JSON.parse(row.variants || '[]'),
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

function getAsset(conn, id) {
  return conn.prepare('SELECT * FROM media_assets WHERE id = ?').get(id);
}

// POST /api/admin/media/uploads (spec §7 step 1-3 combined per D10)
router.post('/uploads', ...write, upload.single('file'), (req, res) => {
  const conn = getDb();
  let stored;
  try {
    stored = storeUpload({
      buffer: req.file ? req.file.buffer : null,
      originalFilename: req.file ? req.file.originalname : '',
    });
  } catch (error) {
    if (error instanceof MediaRejected) {
      return res.fail('UPLOAD_REJECTED', '檔案未通過校驗', error.fields);
    }
    throw error;
  }

  conn
    .prepare(
      `INSERT INTO media_assets
         (id, storage_key, original_filename, mime_type, size_bytes, width, height, checksum, status, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
    )
    .run(
      stored.id,
      stored.storageKey,
      stored.originalFilename,
      stored.mimeType,
      stored.sizeBytes,
      stored.width,
      stored.height,
      stored.checksum,
      req.admin.id
    );

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'media.upload',
    objectType: 'media_asset',
    objectId: stored.id,
    detail: { filename: stored.originalFilename, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes },
  }));
  res.ok({ asset: assetJson(getAsset(conn, stored.id)) }, 201);
});

// GET /api/admin/media — search, filter and unused-asset view (spec §7)
router.get('/', ...read, (req, res) => {
  const conn = getDb();
  const { q = '', kind, status, unused } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 50));

  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  } else {
    where.push("status != 'trash'");
  }
  if (kind === 'image') where.push("mime_type LIKE 'image/%'");
  if (kind === 'pdf') where.push("mime_type = 'application/pdf'");
  if (q) {
    where.push('(original_filename LIKE ? OR alt_zh LIKE ? OR alt_en LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (unused === '1' || unused === 'true') {
    where.push('NOT EXISTS (SELECT 1 FROM media_references mr WHERE mr.media_id = media_assets.id)');
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = conn.prepare(`SELECT COUNT(*) AS n FROM media_assets ${clause}`).get(...params).n;
  const items = conn
    .prepare(`SELECT * FROM media_assets ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize)
    .map(assetJson);
  res.ok({ items, total, page, pageSize });
});

// PATCH /api/admin/media/:id — alt text, caption and filename (spec §7)
router.patch('/:id', ...write, (req, res) => {
  const conn = getDb();
  const asset = getAsset(conn, req.params.id);
  if (!asset || asset.status === 'trash') return res.fail('NOT_FOUND', '媒體不存在');

  const { altZh, altEn, captionZh, captionEn, originalFilename } = req.body || {};
  const fields = [];
  for (const [name, value] of Object.entries({ altZh, altEn, captionZh, captionEn, originalFilename })) {
    if (value !== undefined && typeof value !== 'string') {
      fields.push({ field: name, code: 'type', message: '必須是字串' });
    }
  }
  if (typeof originalFilename === 'string' && originalFilename.length > 255) {
    fields.push({ field: 'originalFilename', code: 'length', message: '檔名不可超過 255 字元' });
  }
  if (fields.length) return res.fail('VALIDATION_FAILED', '媒體參數不完整', fields);

  conn
    .prepare(
      `UPDATE media_assets SET alt_zh = ?, alt_en = ?, caption_zh = ?, caption_en = ?, original_filename = ?
       WHERE id = ?`
    )
    .run(
      altZh ?? asset.alt_zh,
      altEn ?? asset.alt_en,
      captionZh ?? asset.caption_zh,
      captionEn ?? asset.caption_en,
      originalFilename ?? asset.original_filename,
      asset.id
    );

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'media.update',
    objectType: 'media_asset',
    objectId: asset.id,
    detail: { changed: Object.keys(req.body || {}) },
  }));
  res.ok({ asset: assetJson(getAsset(conn, asset.id)) });
});

// GET /api/admin/media/:id/references (spec §7)
router.get('/:id/references', ...read, (req, res) => {
  const conn = getDb();
  const asset = getAsset(conn, req.params.id);
  if (!asset) return res.fail('NOT_FOUND', '媒體不存在');
  const references = conn
    .prepare('SELECT id, ref_type AS refType, ref_id AS refId, created_at AS createdAt FROM media_references WHERE media_id = ? ORDER BY created_at')
    .all(asset.id);
  res.ok({ references, total: references.length });
});

// DELETE /api/admin/media/:id — move to the media recycle bin (spec §7)
router.delete('/:id', ...write, (req, res) => {
  const conn = getDb();
  const asset = getAsset(conn, req.params.id);
  if (!asset || asset.status === 'trash') return res.fail('NOT_FOUND', '媒體不存在');

  conn.prepare("UPDATE media_assets SET status = 'trash', deleted_at = datetime('now') WHERE id = ?").run(asset.id);
  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'media.trash',
    objectType: 'media_asset',
    objectId: asset.id,
    detail: { filename: asset.original_filename },
  }));
  res.ok({ deleted: true, id: asset.id });
});

// DELETE /api/admin/media/:id/permanent — only with media.delete and zero
// recorded references (spec §7; see header note on strictness).
router.delete('/:id/permanent', ...erase, (req, res) => {
  const conn = getDb();
  const asset = getAsset(conn, req.params.id);
  if (!asset) return res.fail('NOT_FOUND', '媒體不存在');

  const refCount = conn
    .prepare('SELECT COUNT(*) AS n FROM media_references WHERE media_id = ?')
    .get(asset.id).n;
  if (refCount > 0) {
    return res.fail('REFERENCE_EXISTS', '媒體仍被內容引用，不能永久刪除', [
      { field: 'id', code: 'referenced', message: `仍有 ${refCount} 筆引用` },
    ]);
  }

  conn.prepare('DELETE FROM media_assets WHERE id = ?').run(asset.id);
  removeStored(asset.storage_key);
  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'media.delete_permanent',
    objectType: 'media_asset',
    objectId: asset.id,
    detail: { filename: asset.original_filename, storageKey: asset.storage_key },
  }));
  res.ok({ deleted: true, id: asset.id, permanent: true });
});

// Multer and unexpected errors keep the unified envelope.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.fail('UPLOAD_REJECTED', '檔案大小不可超過 30MB', [
      { field: 'file', code: 'size', message: '檔案大小不可超過 30MB' },
    ]);
  }
  console.error('admin/media error:', err);
  res.fail('INTERNAL_ERROR', '伺服器錯誤');
});

module.exports = router;
