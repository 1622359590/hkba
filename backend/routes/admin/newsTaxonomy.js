// News taxonomy admin API (spec: data-api §2.4; main design §6).
//
// Mounted at /api/admin/news-categories and /api/admin/news-tags (exported
// as two routers). Categories form a shallow tree (parent_id, cycles and
// self-parenting refused); tags are flat. Deletion is refused while news
// mappings or children exist (REFERENCE_EXISTS) — no silent cascades.

const express = require('express');
const crypto = require('crypto');
const { authMiddleware } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/requirePermission');
const { requestContext } = require('../../lib/respond');
const { getDb } = require('../../db/init');
const { recordAudit, auditEvent } = require('../../lib/audit');

const read = [authMiddleware, requirePermission('content.read')];
const write = [authMiddleware, requirePermission('content.write')];

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function makeRouter({ kind, table, mapTable, mapColumn, hasParent }) {
  const router = express.Router();
  router.use(requestContext);

  const getRow = (conn, id) => conn.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  const slugTaken = (conn, slug, excludeId = '') =>
    Boolean(conn.prepare(`SELECT 1 FROM ${table} WHERE slug = ? AND id != ?`).get(slug, excludeId));

  function validate(body, { partial = false } = {}) {
    const fields = [];
    if (!partial || body.slug !== undefined) {
      if (!body.slug || !SLUG_PATTERN.test(body.slug)) {
        fields.push({ field: 'slug', code: 'pattern', message: 'slug 只能包含小寫字母、數字和連字符' });
      }
    }
    if (!partial || body.nameZh !== undefined) {
      if (typeof body.nameZh !== 'string' || !body.nameZh.trim()) {
        fields.push({ field: 'nameZh', code: 'required', message: '中文名稱必填' });
      }
    }
    for (const name of ['nameZh', 'nameEn']) {
      if (typeof body[name] === 'string' && body[name].length > 80) {
        fields.push({ field: name, code: 'length', message: '名稱不可超過 80 字元' });
      }
    }
    return fields;
  }

  function createsCycle(conn, id, parentId) {
    let current = parentId;
    const seen = new Set([id]);
    while (current) {
      if (seen.has(current)) return true;
      seen.add(current);
      const parent = getRow(conn, current);
      current = parent ? parent.parent_id : null;
    }
    return false;
  }

  // GET / — list with usage counts
  router.get('/', ...read, (req, res) => {
    const conn = getDb();
    const items = conn
      .prepare(
        `SELECT t.*, (SELECT COUNT(*) FROM ${mapTable} m WHERE m.${mapColumn} = t.id) AS news_count
         FROM ${table} t ORDER BY ${hasParent ? 't.sort_order, t.created_at' : 't.created_at'}`
      )
      .all()
      .map((row) => ({
        ...row,
        ...(row.is_active === undefined ? {} : { is_active: Boolean(row.is_active) }),
        news_count: row.news_count,
      }));
    res.ok({ items, total: items.length });
  });

  // POST /
  router.post('/', ...write, (req, res) => {
    const conn = getDb();
    const body = req.body || {};
    const fields = validate(body);
    if (body.slug && slugTaken(conn, body.slug)) {
      fields.push({ field: 'slug', code: 'duplicate', message: 'slug 已被使用' });
    }
    if (hasParent && body.parentId && !getRow(conn, body.parentId)) {
      fields.push({ field: 'parentId', code: 'not_found', message: '父欄目不存在' });
    }
    if (fields.length) return res.fail('VALIDATION_FAILED', '參數不完整', fields);

    const id = crypto.randomUUID();
    conn
      .prepare(`INSERT INTO ${table} (id, slug, name_zh, name_en${hasParent ? ', parent_id, sort_order' : ''}) VALUES (?, ?, ?, ?${hasParent ? ', ?, ?' : ''})`)
      .run(
        ...(hasParent
          ? [id, body.slug, body.nameZh.trim(), body.nameEn || '', body.parentId || null, body.sortOrder ?? 0]
          : [id, body.slug, body.nameZh.trim(), body.nameEn || ''])
      );
    recordAudit(conn, auditEvent(req, {
      actorId: req.admin.id,
      actorName: req.admin.username,
      action: `${kind}.create`,
      objectType: table,
      objectId: id,
      detail: { slug: body.slug },
    }));
    res.ok({ item: getRow(conn, id) }, 201);
  });

  // PATCH /:id
  router.patch('/:id', ...write, (req, res) => {
    const conn = getDb();
    const row = getRow(conn, req.params.id);
    if (!row) return res.fail('NOT_FOUND', '項目不存在');
    const body = req.body || {};
    const fields = validate(body, { partial: true });
    if (body.slug && slugTaken(conn, body.slug, row.id)) {
      fields.push({ field: 'slug', code: 'duplicate', message: 'slug 已被使用' });
    }
    if (hasParent && body.parentId !== undefined && body.parentId !== null) {
      if (!getRow(conn, body.parentId)) {
        fields.push({ field: 'parentId', code: 'not_found', message: '父欄目不存在' });
      } else if (createsCycle(conn, row.id, body.parentId)) {
        fields.push({ field: 'parentId', code: 'cycle', message: '不能移動到自己或子級之下' });
      }
    }
    if (fields.length) return res.fail('VALIDATION_FAILED', '參數不完整', fields);

    conn
      .prepare(
        `UPDATE ${table} SET slug = ?, name_zh = ?, name_en = ?${hasParent ? ', parent_id = ?, sort_order = ?, is_active = ?' : ''} WHERE id = ?`
      )
      .run(
        ...(hasParent
          ? [
              body.slug ?? row.slug,
              body.nameZh ?? row.name_zh,
              body.nameEn ?? row.name_en,
              body.parentId !== undefined ? body.parentId : row.parent_id,
              body.sortOrder ?? row.sort_order,
              body.isActive === undefined ? row.is_active : body.isActive ? 1 : 0,
              row.id,
            ]
          : [body.slug ?? row.slug, body.nameZh ?? row.name_zh, body.nameEn ?? row.name_en, row.id])
      );
    recordAudit(conn, auditEvent(req, {
      actorId: req.admin.id,
      actorName: req.admin.username,
      action: `${kind}.update`,
      objectType: table,
      objectId: row.id,
      detail: { changed: Object.keys(body) },
    }));
    res.ok({ item: getRow(conn, row.id) });
  });

  // DELETE /:id — refused while mapped to news or (categories) has children
  router.delete('/:id', ...write, (req, res) => {
    const conn = getDb();
    const row = getRow(conn, req.params.id);
    if (!row) return res.fail('NOT_FOUND', '項目不存在');

    const mapped = conn.prepare(`SELECT COUNT(*) AS n FROM ${mapTable} WHERE ${mapColumn} = ?`).get(row.id).n;
    if (mapped > 0) {
      return res.fail('REFERENCE_EXISTS', '仍有新聞使用此項目，不能刪除', [
        { field: 'id', code: 'referenced', message: `仍有 ${mapped} 篇新聞引用` },
      ]);
    }
    if (hasParent) {
      const children = conn.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE parent_id = ?`).get(row.id).n;
      if (children > 0) {
        return res.fail('REFERENCE_EXISTS', '請先移動或刪除子欄目', [
          { field: 'id', code: 'has_children', message: `包含 ${children} 個子欄目` },
        ]);
      }
    }
    conn.prepare(`DELETE FROM ${table} WHERE id = ?`).run(row.id);
    recordAudit(conn, auditEvent(req, {
      actorId: req.admin.id,
      actorName: req.admin.username,
      action: `${kind}.delete`,
      objectType: table,
      objectId: row.id,
      detail: { slug: row.slug },
    }));
    res.ok({ deleted: true, id: row.id });
  });

  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    console.error(`admin/${table} error:`, err);
    res.fail('INTERNAL_ERROR', '伺服器錯誤');
  });

  return router;
}

const categories = makeRouter({
  kind: 'news_category',
  table: 'news_categories',
  mapTable: 'news_category_map',
  mapColumn: 'category_id',
  hasParent: true,
});

const tags = makeRouter({
  kind: 'news_tag',
  table: 'news_tags',
  mapTable: 'news_tag_map',
  mapColumn: 'tag_id',
  hasParent: false,
});

module.exports = { categories, tags };
