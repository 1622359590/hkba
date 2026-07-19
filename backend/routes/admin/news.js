// News entity admin API (spec: data-api §6, §2.4-2.5; decision D7).
//
// Mounted at /api/admin/news. Unified envelope (lib/respond.js); writes
// require content.write, reads content.read; mutations write audit_events.
// Draft mutations go through lib/newsDrafts.js applyNewsMutation
// (expectedRevision optimistic lock + mutationId idempotent replay).
// Preview/publish/withdraw arrive with the publishing milestone (M6);
// public query endpoints mount at the frontend-switch milestone (lib/newsQuery.js).

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/requirePermission');
const { requestContext } = require('../../lib/respond');
const { getDb } = require('../../db/init');
const { recordAudit, auditEvent } = require('../../lib/audit');
const { DraftConflict } = require('../../lib/drafts');
const { applyNewsMutation, getDraftRevision, loadNewsBlocks } = require('../../lib/newsDrafts');
const { validateNewsBlocks } = require('../../lib/blockTree');
const { isValidDisplayYear } = require('../../lib/newsYear');
const { syncBlockReferences, clearBlockReferences } = require('../../lib/mediaReferences');
const { checkNews } = require('../../lib/publishChecks');
const { createPreviewToken } = require('../../lib/previewTokens');
const { recordPublish, pruneNewsRevisions } = require('../../lib/publish');
const registry = require('../../components/registry');
const { applyDefaults } = require('../../components/validate');
const { EFFECTIVE_YEAR_SQL } = require('../../lib/newsQuery');

router.use(requestContext);

const read = [authMiddleware, requirePermission('content.read')];
const write = [authMiddleware, requirePermission('content.write')];
const publish = [authMiddleware, requirePermission('publish')];

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

// ---------- helpers ----------

function getNews(conn, id) {
  return conn.prepare('SELECT * FROM news_items WHERE id = ?').get(id);
}

function slugTaken(conn, slug, excludeId = '') {
  return Boolean(conn.prepare('SELECT 1 FROM news_items WHERE slug = ? AND id != ?').get(slug, excludeId));
}

function mapIds(conn, table, column, newsId) {
  return conn
    .prepare(`SELECT ${column} AS id FROM ${table} WHERE news_id = ? ORDER BY created_at`)
    .all(newsId)
    .map((row) => row.id);
}

function snapshotOf(body, categoryIds, tagIds) {
  return {
    titleZh: body.titleZh ?? '',
    titleEn: body.titleEn ?? '',
    summaryZh: body.summaryZh ?? '',
    summaryEn: body.summaryEn ?? '',
    coverMediaId: body.coverMediaId ?? null,
    displayYear: body.displayYear ?? null,
    seo: body.seo ?? {},
    categoryIds,
    tagIds,
  };
}

function validateMetadata(body, { partial = false } = {}) {
  const fields = [];
  const checkString = (name, max) => {
    if (body[name] !== undefined && body[name] !== null && typeof body[name] !== 'string') {
      fields.push({ field: name, code: 'type', message: '必須是字串' });
    } else if (typeof body[name] === 'string' && body[name].length > max) {
      fields.push({ field: name, code: 'length', message: `長度不可超過 ${max}` });
    }
  };
  checkString('titleZh', 200);
  checkString('titleEn', 200);
  checkString('summaryZh', 500);
  checkString('summaryEn', 500);
  if (!partial || body.slug !== undefined) {
    if (!body.slug || !SLUG_PATTERN.test(body.slug)) {
      fields.push({ field: 'slug', code: 'pattern', message: 'slug 只能包含小寫字母、數字和連字符' });
    }
  } else if (body.slug != null && !SLUG_PATTERN.test(body.slug)) {
    fields.push({ field: 'slug', code: 'pattern', message: 'slug 只能包含小寫字母、數字和連字符' });
  }
  if (body.displayYear !== undefined && body.displayYear !== null && !isValidDisplayYear(body.displayYear)) {
    fields.push({ field: 'displayYear', code: 'range', message: '顯示年份必須是四位年份' });
  }
  if (body.seo !== undefined && (body.seo === null || typeof body.seo !== 'object' || Array.isArray(body.seo))) {
    fields.push({ field: 'seo', code: 'type', message: 'seo 必須是物件' });
  }
  for (const name of ['categoryIds', 'tagIds']) {
    if (body[name] !== undefined && (!Array.isArray(body[name]) || body[name].some((id) => typeof id !== 'string'))) {
      fields.push({ field: name, code: 'type', message: '必須是字串陣列' });
    }
  }
  return fields;
}

function validateTaxonomyIds(conn, body) {
  const fields = [];
  if (Array.isArray(body.categoryIds) && body.categoryIds.length) {
    const found = new Set(
      conn
        .prepare(`SELECT id FROM news_categories WHERE id IN (${body.categoryIds.map(() => '?').join(',')})`)
        .all(...body.categoryIds)
        .map((row) => row.id)
    );
    for (const id of body.categoryIds) {
      if (!found.has(id)) fields.push({ field: 'categoryIds', code: 'not_found', message: `欄目 ${id} 不存在` });
    }
  }
  if (Array.isArray(body.tagIds) && body.tagIds.length) {
    const found = new Set(
      conn
        .prepare(`SELECT id FROM news_tags WHERE id IN (${body.tagIds.map(() => '?').join(',')})`)
        .all(...body.tagIds)
        .map((row) => row.id)
    );
    for (const id of body.tagIds) {
      if (!found.has(id)) fields.push({ field: 'tagIds', code: 'not_found', message: `標籤 ${id} 不存在` });
    }
  }
  if (body.coverMediaId) {
    const media = conn.prepare('SELECT id FROM media_assets WHERE id = ?').get(body.coverMediaId);
    if (!media) fields.push({ field: 'coverMediaId', code: 'not_found', message: '封面媒體不存在' });
  }
  return fields;
}

// Validates a full replacement block list for one news draft.
// Returns { errors, prepared } — prepared carries defaults applied.
function validateNewsBlockList(blocks) {
  const errors = [];
  const prepared = [];
  for (const [index, block] of blocks.entries()) {
    const id = typeof block.id === 'string' && block.id ? block.id : crypto.randomUUID();
    if (!block.blockType || !registry.allowsPageType(block.blockType, 'news')) {
      errors.push({ field: `blocks[${index}].blockType`, code: 'enum', message: `組件 ${block.blockType || '(空)'} 不允許用於新聞正文` });
      continue;
    }
    const definition = registry.getDefinition(block.blockType);
    const candidate = {
      id,
      block_type: block.blockType,
      sort_order: index + 1,
      contentZh: applyDefaults(definition.schema.content, block.contentZh || {}),
      contentEn: applyDefaults(definition.schema.content, block.contentEn || {}),
      settings: applyDefaults(definition.schema.settings, block.settings || {}),
    };
    const contract = registry.validateBlockConfig(block.blockType, candidate, { allowMissingEn: true });
    errors.push(...contract.errors.map((error) => ({ ...error, blockId: id })));
    prepared.push({ ...candidate, component_version: definition.version, definition });
  }
  const tree = validateNewsBlocks(prepared);
  errors.push(...tree.errors.map((error) => ({ field: 'blocks', ...error })));
  return { errors, prepared };
}

function replaceMaps(conn, newsId, categoryIds, tagIds) {
  if (categoryIds) {
    conn.prepare('DELETE FROM news_category_map WHERE news_id = ?').run(newsId);
    const insert = conn.prepare('INSERT OR IGNORE INTO news_category_map (news_id, category_id) VALUES (?, ?)');
    for (const id of categoryIds) insert.run(newsId, id);
  }
  if (tagIds) {
    conn.prepare('DELETE FROM news_tag_map WHERE news_id = ?').run(newsId);
    const insert = conn.prepare('INSERT OR IGNORE INTO news_tag_map (news_id, tag_id) VALUES (?, ?)');
    for (const id of tagIds) insert.run(newsId, id);
  }
}

function syncCoverReference(conn, newsId, coverMediaId) {
  conn.prepare("DELETE FROM media_references WHERE ref_type = 'news_cover' AND ref_id = ?").run(newsId);
  if (!coverMediaId) return;
  const exists = conn.prepare('SELECT id FROM media_assets WHERE id = ?').get(coverMediaId);
  if (!exists) return;
  conn
    .prepare("INSERT OR IGNORE INTO media_references (id, media_id, ref_type, ref_id) VALUES (?, ?, 'news_cover', ?)")
    .run(crypto.randomUUID(), coverMediaId, newsId);
}

function applyMetadata(conn, news, snapshot) {
  conn
    .prepare(
      `UPDATE news_items
       SET title_zh = ?, title_en = ?, summary_zh = ?, summary_en = ?, cover_media_id = ?,
           display_year = ?, seo = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      snapshot.titleZh,
      snapshot.titleEn,
      snapshot.summaryZh,
      snapshot.summaryEn,
      snapshot.coverMediaId,
      snapshot.displayYear,
      JSON.stringify(snapshot.seo || {}),
      news.id
    );
  syncCoverReference(conn, news.id, snapshot.coverMediaId);
}

function insertBlocks(conn, newsId, revision, prepared) {
  const insert = conn.prepare(
    `INSERT INTO news_blocks (id, news_id, revision, block_type, block_version, sort_order, content_zh, content_en, settings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const block of prepared) {
    insert.run(
      block.id,
      newsId,
      revision,
      block.block_type,
      block.component_version,
      block.sort_order,
      JSON.stringify(block.contentZh),
      JSON.stringify(block.contentEn),
      JSON.stringify(block.settings)
    );
    syncBlockReferences(conn, {
      blockId: block.id,
      refType: 'news_block',
      definition: block.definition,
      config: block,
    });
  }
}

function clearRevisionReferences(conn, newsId, revision) {
  const blocks = loadNewsBlocks(conn, newsId, revision);
  for (const block of blocks) clearBlockReferences(conn, block.id, 'news_block');
}

function blockJson(block) {
  return {
    ...block,
    contentZh: JSON.parse(block.content_zh || '{}'),
    contentEn: JSON.parse(block.content_en || '{}'),
    settings: JSON.parse(block.settings || '{}'),
  };
}

function newsJson(conn, news) {
  return {
    ...news,
    seo: JSON.parse(news.seo || '{}'),
    categoryIds: mapIds(conn, 'news_category_map', 'category_id', news.id),
    tagIds: mapIds(conn, 'news_tag_map', 'tag_id', news.id),
    missing_en: !news.title_en || !news.summary_en,
  };
}

function handleNewsError(req, res, next, error) {
  if (error instanceof DraftConflict || error.code === 'REVISION_CONFLICT') {
    return res.fail('REVISION_CONFLICT', '新聞已被其他編輯更新', [
      { field: 'expectedRevision', code: 'conflict', message: `當前修訂為 ${error.currentRevision}` },
    ]);
  }
  if (error.code === 'NOT_FOUND') {
    return res.fail('NOT_FOUND', '草稿不存在');
  }
  return next(error);
}

// ---------- list & read ----------

// GET /api/admin/news (spec §6: status, category, year, language completeness)
router.get('/', ...read, (req, res) => {
  const conn = getDb();
  const { status, categoryId, year, lang, q = '' } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  } else {
    where.push("status != 'trash'");
  }
  if (categoryId) {
    where.push('EXISTS (SELECT 1 FROM news_category_map cm WHERE cm.news_id = news_items.id AND cm.category_id = ?)');
    params.push(categoryId);
  }
  if (year && Number.isInteger(Number(year))) {
    where.push(`${EFFECTIVE_YEAR_SQL} = ?`);
    params.push(Number(year));
  }
  if (lang === 'missing-en') {
    where.push("(title_en = '' OR summary_en = '')");
  }
  if (q) {
    where.push('(title_zh LIKE ? OR title_en LIKE ? OR summary_zh LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = conn.prepare(`SELECT COUNT(*) AS n FROM news_items ${clause}`).get(...params).n;
  const items = conn
    .prepare(`SELECT * FROM news_items ${clause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize)
    .map((news) => newsJson(conn, news));
  res.ok({ items, total, page, pageSize });
});

// GET /api/admin/news/:id — news with the current draft revision and blocks
router.get('/:id', ...read, (req, res) => {
  const conn = getDb();
  const news = getNews(conn, req.params.id);
  if (!news || news.status === 'trash') return res.fail('NOT_FOUND', '新聞不存在');
  const draft = getDraftRevision(conn, news.id);
  const blocks = draft ? loadNewsBlocks(conn, news.id, draft.revision).map(blockJson) : [];
  res.ok({
    news: newsJson(conn, news),
    draft: draft
      ? { id: draft.id, revision: draft.revision, snapshot: JSON.parse(draft.snapshot || '{}') }
      : null,
    blocks,
  });
});

// ---------- create & update ----------

// POST /api/admin/news (spec §6: create a news draft)
router.post('/', ...write, (req, res) => {
  const conn = getDb();
  const body = req.body || {};
  const fields = [...validateMetadata(body), ...validateTaxonomyIds(conn, body)];
  if (body.slug && slugTaken(conn, body.slug)) {
    fields.push({ field: 'slug', code: 'duplicate', message: 'slug 已被使用' });
  }
  if (fields.length) return res.fail('VALIDATION_FAILED', '新聞參數不完整', fields);

  const categoryIds = body.categoryIds || [];
  const tagIds = body.tagIds || [];
  const snapshot = snapshotOf(body, categoryIds, tagIds);
  const id = crypto.randomUUID();

  conn.transaction(() => {
    conn
      .prepare(
        `INSERT INTO news_items (id, slug, title_zh, title_en, summary_zh, summary_en, cover_media_id,
                                 author_id, display_year, status, current_draft_revision, seo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?)`
      )
      .run(
        id,
        body.slug,
        snapshot.titleZh,
        snapshot.titleEn,
        snapshot.summaryZh,
        snapshot.summaryEn,
        snapshot.coverMediaId,
        req.admin.id,
        snapshot.displayYear,
        JSON.stringify(snapshot.seo)
      );
    conn
      .prepare("INSERT INTO news_revisions (id, news_id, revision, status, snapshot, created_by) VALUES (?, ?, 1, 'draft', ?, ?)")
      .run(crypto.randomUUID(), id, JSON.stringify(snapshot), req.admin.id);
    // Every news body starts with its single header block (catalog §3.1).
    const headerDefinition = registry.getDefinition('news.header');
    const header = {
      id: crypto.randomUUID(),
      block_type: 'news.header',
      sort_order: 1,
      component_version: headerDefinition.version,
      definition: headerDefinition,
      contentZh: applyDefaults(headerDefinition.schema.content, {
        title: snapshot.titleZh,
        summary: snapshot.summaryZh,
        displayYear: snapshot.displayYear ?? undefined,
        coverMediaId: snapshot.coverMediaId ?? undefined,
      }),
      contentEn: applyDefaults(headerDefinition.schema.content, {
        title: snapshot.titleEn,
        summary: snapshot.summaryEn,
      }),
      settings: applyDefaults(headerDefinition.schema.settings, { categoryIds, tagIds }),
    };
    insertBlocks(conn, id, 1, [header]);
    replaceMaps(conn, id, categoryIds, tagIds);
    syncCoverReference(conn, id, snapshot.coverMediaId);
  })();

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'news.create',
    objectType: 'news_item',
    objectId: id,
    detail: { slug: body.slug, titleZh: snapshot.titleZh },
  }));
  res.ok({ news: newsJson(conn, getNews(conn, id)), revision: 1 }, 201);
});

// PATCH /api/admin/news/:id (spec §6: metadata + body blocks, expectedRevision)
router.patch('/:id', ...write, (req, res, next) => {
  const conn = getDb();
  const news = getNews(conn, req.params.id);
  if (!news || news.status === 'trash') return res.fail('NOT_FOUND', '新聞不存在');

  const { expectedRevision, mutationId, blocks, ...metadata } = req.body || {};
  const fields = [...validateMetadata(metadata, { partial: true }), ...validateTaxonomyIds(conn, metadata)];
  if (metadata.slug && slugTaken(conn, metadata.slug, news.id)) {
    fields.push({ field: 'slug', code: 'duplicate', message: 'slug 已被使用' });
  }
  if (blocks !== undefined && !Array.isArray(blocks)) {
    fields.push({ field: 'blocks', code: 'type', message: 'blocks 必須是陣列' });
  }
  if (fields.length) return res.fail('VALIDATION_FAILED', '新聞參數不完整', fields);

  const blockCheck = Array.isArray(blocks) ? validateNewsBlockList(blocks) : null;
  if (blockCheck && blockCheck.errors.length) {
    return res.fail('VALIDATION_FAILED', '正文組件不完整', blockCheck.errors);
  }

  try {
    const result = applyNewsMutation(conn, news, { expectedRevision, mutationId }, ({ draft, nextRevision }) => {
      const draftSnapshot = JSON.parse(draft.snapshot || '{}');
      const snapshot = {
        titleZh: metadata.titleZh ?? draftSnapshot.titleZh ?? news.title_zh,
        titleEn: metadata.titleEn ?? draftSnapshot.titleEn ?? news.title_en,
        summaryZh: metadata.summaryZh ?? draftSnapshot.summaryZh ?? news.summary_zh,
        summaryEn: metadata.summaryEn ?? draftSnapshot.summaryEn ?? news.summary_en,
        coverMediaId: metadata.coverMediaId !== undefined ? metadata.coverMediaId : draftSnapshot.coverMediaId ?? news.cover_media_id,
        displayYear: metadata.displayYear !== undefined ? metadata.displayYear : draftSnapshot.displayYear ?? news.display_year,
        seo: metadata.seo ?? draftSnapshot.seo ?? JSON.parse(news.seo || '{}'),
        categoryIds: metadata.categoryIds ?? draftSnapshot.categoryIds ?? mapIds(conn, 'news_category_map', 'category_id', news.id),
        tagIds: metadata.tagIds ?? draftSnapshot.tagIds ?? mapIds(conn, 'news_tag_map', 'tag_id', news.id),
      };
      if (metadata.slug && metadata.slug !== news.slug) {
        conn.prepare('UPDATE news_items SET slug = ? WHERE id = ?').run(metadata.slug, news.id);
      }
      applyMetadata(conn, news, snapshot);
      replaceMaps(conn, news.id, snapshot.categoryIds, snapshot.tagIds);
      conn.prepare('UPDATE news_revisions SET snapshot = ? WHERE id = ?').run(JSON.stringify(snapshot), draft.id);

      if (blockCheck) {
        clearRevisionReferences(conn, news.id, draft.revision);
        conn.prepare('DELETE FROM news_blocks WHERE news_id = ? AND revision = ?').run(news.id, draft.revision);
        insertBlocks(conn, news.id, nextRevision, blockCheck.prepared);
      } else {
        // Blocks stay content-identical; re-key them to the new revision.
        const existing = loadNewsBlocks(conn, news.id, draft.revision);
        conn.prepare('DELETE FROM news_blocks WHERE news_id = ? AND revision = ?').run(news.id, draft.revision);
        insertBlocks(
          conn,
          news.id,
          nextRevision,
          existing.map((block) => ({
            id: block.id,
            block_type: block.block_type,
            component_version: block.block_version,
            sort_order: block.sort_order,
            contentZh: JSON.parse(block.content_zh || '{}'),
            contentEn: JSON.parse(block.content_en || '{}'),
            settings: JSON.parse(block.settings || '{}'),
            definition: registry.getDefinition(block.block_type),
          }))
        );
      }
      return { news: newsJson(conn, getNews(conn, news.id)) };
    });
    res.ok(result);
  } catch (error) {
    handleNewsError(req, res, next, error);
  }
});

// POST /api/admin/news/:id/restore-revision (spec §6: new draft from history)
router.post('/:id/restore-revision', ...write, (req, res, next) => {
  const conn = getDb();
  const news = getNews(conn, req.params.id);
  if (!news || news.status === 'trash') return res.fail('NOT_FOUND', '新聞不存在');

  const { expectedRevision, mutationId, revision } = req.body || {};
  if (!Number.isInteger(revision)) {
    return res.fail('VALIDATION_FAILED', '缺少要恢復的修訂號', [
      { field: 'revision', code: 'required', message: '必填整數' },
    ]);
  }
  const source = conn.prepare('SELECT * FROM news_revisions WHERE news_id = ? AND revision = ?').get(news.id, revision);
  if (!source) return res.fail('NOT_FOUND', `修訂 ${revision} 不存在`);

  try {
    const result = applyNewsMutation(conn, news, { expectedRevision, mutationId }, ({ draft, nextRevision }) => {
      const snapshot = JSON.parse(source.snapshot || '{}');
      applyMetadata(conn, news, snapshot);
      replaceMaps(conn, news.id, snapshot.categoryIds || [], snapshot.tagIds || []);
      conn.prepare('UPDATE news_revisions SET snapshot = ? WHERE id = ?').run(JSON.stringify(snapshot), draft.id);

      clearRevisionReferences(conn, news.id, draft.revision);
      conn.prepare('DELETE FROM news_blocks WHERE news_id = ? AND revision = ?').run(news.id, draft.revision);
      const sourceBlocks = loadNewsBlocks(conn, news.id, revision);
      insertBlocks(
        conn,
        news.id,
        nextRevision,
        sourceBlocks.map((block) => ({
          id: crypto.randomUUID(),
          block_type: block.block_type,
          component_version: block.block_version,
          sort_order: block.sort_order,
          contentZh: JSON.parse(block.content_zh || '{}'),
          contentEn: JSON.parse(block.content_en || '{}'),
          settings: JSON.parse(block.settings || '{}'),
          definition: registry.getDefinition(block.block_type),
        }))
      );
      return {
        news: newsJson(conn, getNews(conn, news.id)),
        restoredFrom: revision,
        blocks: loadNewsBlocks(conn, news.id, nextRevision).map(blockJson),
      };
    });
    recordAudit(conn, auditEvent(req, {
      actorId: req.admin.id,
      actorName: req.admin.username,
      action: 'news.restore_revision',
      objectType: 'news_item',
      objectId: news.id,
      detail: { restoredFrom: revision },
    }));
    res.ok(result);
  } catch (error) {
    handleNewsError(req, res, next, error);
  }
});

// DELETE /api/admin/news/:id — recycle bin; POST /:id/restore brings it back
router.delete('/:id', ...write, (req, res) => {
  const conn = getDb();
  const news = getNews(conn, req.params.id);
  if (!news || news.status === 'trash') return res.fail('NOT_FOUND', '新聞不存在');
  conn.prepare("UPDATE news_items SET status = 'trash', updated_at = datetime('now') WHERE id = ?").run(news.id);
  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'news.trash',
    objectType: 'news_item',
    objectId: news.id,
    detail: { slug: news.slug, previousStatus: news.status },
  }));
  res.ok({ deleted: true, id: news.id });
});

router.post('/:id/restore', ...write, (req, res) => {
  const conn = getDb();
  const news = getNews(conn, req.params.id);
  if (!news || news.status !== 'trash') return res.fail('NOT_FOUND', '回收站中沒有該新聞');
  conn.prepare("UPDATE news_items SET status = 'draft', updated_at = datetime('now') WHERE id = ?").run(news.id);
  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'news.restore',
    objectType: 'news_item',
    objectId: news.id,
  }));
  res.ok({ news: newsJson(conn, getNews(conn, news.id)) });
});

// ---------- preview & publish lifecycle (spec: data-api §6, §9-§11) ----------

// POST /api/admin/news/:id/preview — short-lived token bound to the draft
router.post('/:id/preview', ...read, (req, res) => {
  const conn = getDb();
  const news = getNews(conn, req.params.id);
  if (!news || news.status === 'trash') return res.fail('NOT_FOUND', '新聞不存在');
  const draft = getDraftRevision(conn, news.id);
  if (!draft) return res.fail('NOT_FOUND', '草稿不存在');
  const { token, expiresAt } = createPreviewToken(conn, {
    objectType: 'news',
    objectId: news.id,
    revision: draft.revision,
    createdBy: req.admin.id,
  });
  res.ok({ token, url: `/api/preview/${token}`, revision: draft.revision, expiresAt }, 201);
});

// POST /api/admin/news/:id/publish — checks, then one transaction (§10)
router.post('/:id/publish', ...publish, (req, res) => {
  const conn = getDb();
  const news = getNews(conn, req.params.id);
  if (!news || news.status === 'trash') return res.fail('NOT_FOUND', '新聞不存在');
  const draft = getDraftRevision(conn, news.id);
  if (!draft) return res.fail('NOT_FOUND', '草稿不存在');

  const { expectedRevision } = req.body || {};
  if (!Number.isInteger(expectedRevision) || expectedRevision !== draft.revision) {
    return res.fail('REVISION_CONFLICT', '新聞已被其他編輯更新', [
      { field: 'expectedRevision', code: 'conflict', message: `當前修訂為 ${draft.revision}` },
    ]);
  }

  const blocks = loadNewsBlocks(conn, news.id, draft.revision);
  const problems = checkNews(conn, news, draft, blocks);
  if (problems.length) {
    return res.fail('PUBLISH_CHECK_FAILED', '發佈檢查未通過', problems, 422);
  }

  const nextRevision = draft.revision + 1;
  conn.transaction(() => {
    conn.prepare("UPDATE news_revisions SET status = 'superseded' WHERE news_id = ? AND status = 'published'").run(news.id);
    conn
      .prepare("UPDATE news_revisions SET status = 'published', published_by = ?, published_at = datetime('now') WHERE id = ?")
      .run(req.admin.id, draft.id);
    conn
      .prepare(
        `UPDATE news_items
         SET status = 'published', published_revision = ?, published_at = datetime('now'),
             current_draft_revision = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(draft.revision, nextRevision, news.id);
    // The draft continues as a new revision copied from the published one.
    conn
      .prepare("INSERT INTO news_revisions (id, news_id, revision, status, snapshot, source_revision_id) VALUES (?, ?, ?, 'draft', ?, ?)")
      .run(crypto.randomUUID(), news.id, nextRevision, draft.snapshot, draft.id);
    const copied = blocks.map((block) => ({
      id: crypto.randomUUID(),
      block_type: block.block_type,
      component_version: block.block_version,
      sort_order: block.sort_order,
      contentZh: JSON.parse(block.content_zh || '{}'),
      contentEn: JSON.parse(block.content_en || '{}'),
      settings: JSON.parse(block.settings || '{}'),
      definition: registry.getDefinition(block.block_type),
    }));
    insertBlocks(conn, news.id, nextRevision, copied);
    recordPublish(conn, {
      objectType: 'news',
      objectId: news.id,
      versionId: draft.id,
      revision: draft.revision,
      action: 'publish',
      actorId: req.admin.id,
      checksReport: { problems: [] },
    });
    pruneNewsRevisions(conn, news.id);
  })();

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'news.publish',
    objectType: 'news_item',
    objectId: news.id,
    detail: { revision: draft.revision, slug: news.slug },
  }));
  res.ok({ published: true, revision: draft.revision, draftRevision: nextRevision });
});

// POST /api/admin/news/:id/withdraw (spec §6)
router.post('/:id/withdraw', ...publish, (req, res) => {
  const conn = getDb();
  const news = getNews(conn, req.params.id);
  if (!news || news.status === 'trash') return res.fail('NOT_FOUND', '新聞不存在');
  if (news.status !== 'published') return res.fail('NOT_FOUND', '新聞不在已發佈狀態');

  const publishedRow = news.published_revision != null
    ? conn.prepare('SELECT id FROM news_revisions WHERE news_id = ? AND revision = ?').get(news.id, news.published_revision)
    : null;
  conn.transaction(() => {
    conn.prepare("UPDATE news_items SET status = 'withdrawn', updated_at = datetime('now') WHERE id = ?").run(news.id);
    recordPublish(conn, {
      objectType: 'news',
      objectId: news.id,
      versionId: publishedRow ? publishedRow.id : 'missing',
      revision: news.published_revision || 1,
      action: 'withdraw',
      actorId: req.admin.id,
    });
  })();

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'news.withdraw',
    objectType: 'news_item',
    objectId: news.id,
    detail: { slug: news.slug, publishedRevision: news.published_revision },
  }));
  res.ok({ withdrawn: true, id: news.id });
});

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  console.error('admin/news error:', err);
  res.fail('INTERNAL_ERROR', '伺服器錯誤');
});

module.exports = router;
