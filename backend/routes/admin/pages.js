// Page tree & draft & block admin API (spec: data-api §4-§5, main design §5).
//
// Mounted at /api/admin/pages. All responses use the unified envelope
// (lib/respond.js). Write endpoints require content.write, reads require
// content.read; structural mutations write audit_events. Draft mutations go
// through lib/drafts.js applyDraftMutation (expectedRevision optimistic lock
// + mutationId idempotent replay).

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/requirePermission');
const { requestContext } = require('../../lib/respond');
const { getDb } = require('../../db/init');
const { joinPath, validateMove, validateNewNode } = require('../../lib/pageTree');
const { validateBlockTree } = require('../../lib/blockTree');
const registry = require('../../components/registry');
const { applyDefaults } = require('../../components/validate');
const {
  DraftConflict,
  loadBlocks,
  getDraftVersion,
  getOrCreateDraft,
  applyDraftMutation,
} = require('../../lib/drafts');
const { recordAudit, auditEvent } = require('../../lib/audit');
const { syncBlockReferences, clearBlockReferences } = require('../../lib/mediaReferences');
const { checkPage } = require('../../lib/publishChecks');
const { createPreviewToken } = require('../../lib/previewTokens');
const { recordPublish, prunePageVersions } = require('../../lib/publish');
const {
  captureDraftState,
  summarizeDraftChange,
  createDraftSnapshot,
  loadSnapshotState,
} = require('../../lib/draftSnapshots');

router.use(requestContext);

const read = [authMiddleware, requirePermission('content.read')];
const write = [authMiddleware, requirePermission('content.write')];
const publish = [authMiddleware, requirePermission('publish')];
const rollback = [authMiddleware, requirePermission('rollback')];

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const NAVIGATION_STATUSES = ['visible', 'hidden', 'external'];
const NODE_TYPES = ['section', 'page'];

// ---------- helpers ----------

function getNode(conn, id) {
  return conn.prepare('SELECT * FROM page_nodes WHERE id = ?').get(id);
}

function slugTaken(conn, parentId, slug, excludeId = '') {
  if (parentId == null) {
    return Boolean(
      conn.prepare('SELECT 1 FROM page_nodes WHERE parent_id IS NULL AND slug = ? AND id != ?').get(slug, excludeId)
    );
  }
  return Boolean(
    conn.prepare('SELECT 1 FROM page_nodes WHERE parent_id = ? AND slug = ? AND id != ?').get(parentId, slug, excludeId)
  );
}

function pathTaken(conn, path, excludeId = '') {
  return Boolean(conn.prepare('SELECT 1 FROM page_nodes WHERE path = ? AND id != ?').get(path, excludeId));
}

// After a node's path changed, recompute every descendant's stored path.
function recomputeSubtreePaths(conn, node) {
  const children = conn.prepare('SELECT * FROM page_nodes WHERE parent_id = ?').all(node.id);
  for (const child of children) {
    const childPath = joinPath(node.path, child.slug);
    conn.prepare('UPDATE page_nodes SET path = ? WHERE id = ?').run(childPath, child.id);
    recomputeSubtreePaths(conn, { ...child, path: childPath });
  }
}

function uniqueCopySlug(conn, parentId, baseSlug) {
  let candidate = `${baseSlug}-copy`;
  let counter = 2;
  while (slugTaken(conn, parentId, candidate) || pathTaken(conn, joinPath(parentId ? getNode(conn, parentId).path : '', candidate))) {
    candidate = `${baseSlug}-copy-${counter}`;
    counter += 1;
  }
  return candidate;
}

function nodeJson(node) {
  return {
    ...node,
    has_draft: Boolean(node.draft_version_id),
    is_published: Boolean(node.published_version_id),
    missing_en: !node.title_en,
  };
}

function buildTree(nodes) {
  const byParent = new Map();
  for (const node of nodes) {
    const key = node.parent_id || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  }
  const attach = (parentKey) =>
    (byParent.get(parentKey) || []).map((node) => ({ ...nodeJson(node), children: attach(node.id) }));
  return attach('');
}

function handleDraftError(req, res, next, error) {
  if (error instanceof DraftConflict || error.code === 'REVISION_CONFLICT') {
    return res.fail('REVISION_CONFLICT', '頁面已被其他編輯更新', [
      { field: 'expectedRevision', code: 'conflict', message: `當前修訂為 ${error.currentRevision}` },
    ]);
  }
  if (error.code === 'NOT_FOUND') {
    return res.fail('NOT_FOUND', '草稿不存在');
  }
  return next(error);
}

function blockJson(block) {
  return {
    ...block,
    contentZh: JSON.parse(block.content_zh || '{}'),
    contentEn: JSON.parse(block.content_en || '{}'),
    settings: JSON.parse(block.settings || '{}'),
  };
}

// Validates a prospective block set (registry contract + tree rules).
// Returns an array of field errors ([] = valid).
function validateProspectiveBlocks(blocks) {
  const errors = [];
  for (const block of blocks) {
    const contract = registry.validateBlockConfig(block.component_type, {
      contentZh: block.contentZh,
      contentEn: block.contentEn,
      settings: block.settings,
    }, { allowMissingEn: true });
    errors.push(...contract.errors.map((error) => ({ ...error, blockId: block.id })));
  }
  const tree = validateBlockTree(
    blocks.map((block) => ({
      id: block.id,
      component_type: block.component_type,
      parent_block_id: block.parent_block_id,
    }))
  );
  errors.push(...tree.errors.map((error) => ({ field: 'parentBlockId', ...error })));
  return errors;
}

function loadDraftBlocksJson(conn, versionId) {
  return loadBlocks(conn, versionId).map(blockJson);
}

// ---------- page tree ----------

// GET /api/admin/pages/tree (spec §4)
router.get('/tree', ...read, (req, res) => {
  const conn = getDb();
  const nodes = conn
    .prepare('SELECT * FROM page_nodes WHERE deleted_at IS NULL ORDER BY sort_order, created_at')
    .all();
  res.ok({ tree: buildTree(nodes), total: nodes.length });
});

function snapshotJson(row) {
  return {
    id: row.id,
    revision: row.revision,
    sourceVersionId: row.source_version_id,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByName: row.createdByName || null,
    blockCount: Number(row.blockCount || 0),
    summary: JSON.parse(row.change_summary || '{}'),
  };
}

// GET /api/admin/pages/:id/versions — grouped history for the studio drawer.
router.get('/:id/versions', ...read, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const current = getDraftVersion(conn, node.id);
  const currentDraft = current ? {
    id: current.id,
    revision: current.revision,
    blockCount: conn.prepare('SELECT COUNT(*) AS count FROM page_blocks WHERE page_version_id = ?').get(current.id).count,
    updatedAt: conn.prepare('SELECT MAX(created_at) AS updatedAt FROM page_draft_snapshots WHERE page_id = ?').get(node.id).updatedAt || current.created_at,
  } : null;
  const snapshots = conn.prepare(
    `SELECT s.*, a.username AS createdByName,
            (SELECT COUNT(*) FROM page_draft_snapshot_blocks b WHERE b.snapshot_id = s.id) AS blockCount
     FROM page_draft_snapshots s
     LEFT JOIN admins a ON a.id = s.created_by
     WHERE s.page_id = ? ORDER BY s.revision DESC, s.created_at DESC`
  ).all(node.id).map(snapshotJson);
  const publishedVersions = conn.prepare(
    `SELECT v.id, v.revision, v.status, v.created_at AS createdAt,
            v.published_at AS publishedAt, v.source_version_id AS sourceVersionId,
            (SELECT COUNT(*) FROM page_blocks b WHERE b.page_version_id = v.id) AS blockCount
     FROM page_versions v WHERE v.page_id = ? AND v.status IN ('published', 'superseded')
     ORDER BY v.revision DESC`
  ).all(node.id);
  res.ok({ currentDraft, snapshots, publishedVersions, publishedVersionId: node.published_version_id });
});

router.get('/:id/snapshots/:snapshotId', ...read, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const row = conn.prepare(
    `SELECT s.*, a.username AS createdByName,
            (SELECT COUNT(*) FROM page_draft_snapshot_blocks b WHERE b.snapshot_id = s.id) AS blockCount
     FROM page_draft_snapshots s LEFT JOIN admins a ON a.id = s.created_by
     WHERE s.id = ? AND s.page_id = ?`
  ).get(req.params.snapshotId, node.id);
  if (!row) return res.fail('NOT_FOUND', '快照不存在');
  res.ok({ snapshot: snapshotJson(row) });
});

router.post('/:id/snapshots/:snapshotId/preview', ...read, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const snapshot = conn.prepare('SELECT * FROM page_draft_snapshots WHERE id = ? AND page_id = ?').get(req.params.snapshotId, node.id);
  if (!snapshot) return res.fail('NOT_FOUND', '快照不存在');
  const { token, expiresAt } = createPreviewToken(conn, {
    objectType: 'page_snapshot',
    objectId: snapshot.id,
    revision: snapshot.revision,
    createdBy: req.admin.id,
  });
  res.ok({ token, url: `/api/preview/${token}`, revision: snapshot.revision, expiresAt }, 201);
});

router.post('/:id/snapshots/:snapshotId/restore', ...rollback, (req, res, next) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const loaded = loadSnapshotState(conn, req.params.snapshotId);
  if (!loaded || loaded.snapshot.page_id !== node.id) return res.fail('NOT_FOUND', '快照不存在');
  const draft = getDraftVersion(conn, node.id) || getOrCreateDraft(conn, node).version;

  try {
    const result = applyDraftMutation(conn, node, {
      expectedRevision: draft.revision,
      mutationId: req.body?.mutationId || crypto.randomUUID(),
      createdBy: req.admin.id,
    }, (currentDraft) => {
      const oldBlocks = loadBlocks(conn, currentDraft.id);
      for (const block of oldBlocks) clearBlockReferences(conn, block.id, 'page_block');
      conn.prepare('DELETE FROM page_blocks WHERE page_version_id = ?').run(currentDraft.id);
      conn.prepare('UPDATE page_versions SET seo = ? WHERE id = ?')
        .run(JSON.stringify(loaded.state.seo || {}), currentDraft.id);

      const idMap = new Map(loaded.state.blocks.map((block) => [block.id, crypto.randomUUID()]));
      const insert = conn.prepare(
        `INSERT INTO page_blocks
           (id, page_version_id, component_type, component_version, sort_order,
            parent_block_id, is_visible, anchor_id, content_zh, content_en, settings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const block of loaded.state.blocks) {
        const id = idMap.get(block.id);
        insert.run(
          id, currentDraft.id, block.componentType, block.componentVersion || 1,
          block.sortOrder || 0, block.parentBlockId ? idMap.get(block.parentBlockId) : null,
          block.isVisible === false ? 0 : 1, block.anchorId || null,
          JSON.stringify(block.contentZh || {}), JSON.stringify(block.contentEn || {}),
          JSON.stringify(block.settings || {})
        );
        const definition = registry.getDefinition(block.componentType);
        if (definition) {
          syncBlockReferences(conn, {
            blockId: id,
            definition,
            config: { contentZh: block.contentZh || {}, contentEn: block.contentEn || {}, settings: block.settings || {} },
          });
        }
      }
      return { restoredFromSnapshotId: loaded.snapshot.id, restoredFromRevision: loaded.snapshot.revision };
    });

    recordAudit(conn, auditEvent(req, {
      actorId: req.admin.id,
      actorName: req.admin.username,
      action: 'page.snapshot.restore',
      objectType: 'page_draft_snapshot',
      objectId: loaded.snapshot.id,
      detail: { pageId: node.id, sourceRevision: loaded.snapshot.revision, newDraftRevision: result.revision },
    }));
    res.ok(result);
  } catch (error) {
    handleDraftError(req, res, next, error);
  }
});

router.delete('/:id/snapshots/:snapshotId', ...write, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const snapshot = conn.prepare('SELECT * FROM page_draft_snapshots WHERE id = ? AND page_id = ?').get(req.params.snapshotId, node.id);
  if (!snapshot) return res.fail('NOT_FOUND', '快照不存在');
  const draft = getDraftVersion(conn, node.id);
  if (draft && draft.revision === snapshot.revision) {
    return res.fail('REFERENCE_EXISTS', '目前草稿對應的最新快照不能刪除');
  }
  conn.prepare('DELETE FROM page_draft_snapshots WHERE id = ?').run(snapshot.id);
  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'page.snapshot.delete',
    objectType: 'page_draft_snapshot',
    objectId: snapshot.id,
    detail: { pageId: node.id, revision: snapshot.revision },
  }));
  res.ok({ deleted: true, id: snapshot.id });
});

// POST /api/admin/pages (spec §4)
router.post('/', ...write, (req, res) => {
  const conn = getDb();
  const {
    parentId = null,
    nodeType = 'page',
    slug,
    titleZh = '',
    titleEn = '',
    navigationStatus = 'visible',
    externalUrl = '',
    sortOrder = 0,
  } = req.body || {};

  const fields = [];
  if (!NODE_TYPES.includes(nodeType)) fields.push({ field: 'nodeType', code: 'enum', message: 'nodeType 必須是 section 或 page' });
  if (!slug || !SLUG_PATTERN.test(slug)) fields.push({ field: 'slug', code: 'pattern', message: 'slug 只能包含小寫字母、數字和連字符' });
  if (!NAVIGATION_STATUSES.includes(navigationStatus)) fields.push({ field: 'navigationStatus', code: 'enum', message: '無效的導航狀態' });
  if (navigationStatus === 'external' && !externalUrl) fields.push({ field: 'externalUrl', code: 'required', message: '外部跳轉必須填寫 externalUrl' });
  if (fields.length) return res.fail('VALIDATION_FAILED', '頁面參數不完整', fields);

  let parent = null;
  if (parentId != null) {
    parent = getNode(conn, parentId);
    if (!parent || parent.deleted_at) return res.fail('NOT_FOUND', '父節點不存在');
    const depth = validateNewNode(
      conn.prepare('SELECT id, parent_id FROM page_nodes WHERE deleted_at IS NULL').all(),
      parentId
    );
    if (!depth.ok) {
      return res.fail('VALIDATION_FAILED', depth.reason === 'depth' ? '欄目最多三級' : '父節點不存在', [
        { field: 'parentId', code: depth.reason, message: depth.reason === 'depth' ? '超過最大深度 3' : '父節點不存在' },
      ]);
    }
  }

  if (slugTaken(conn, parentId, slug)) {
    return res.fail('REFERENCE_EXISTS', '同一父級下 slug 已存在', [{ field: 'slug', code: 'duplicate', message: 'slug 在同級中必須唯一' }]);
  }
  const path = joinPath(parent ? parent.path : '', slug);
  if (pathTaken(conn, path)) {
    return res.fail('REFERENCE_EXISTS', '路徑已存在', [{ field: 'slug', code: 'duplicate', message: `路徑 ${path} 已被使用` }]);
  }

  const id = crypto.randomUUID();
  conn
    .prepare(
      `INSERT INTO page_nodes (id, parent_id, node_type, slug, path, title_zh, title_en, navigation_status, external_url, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, parentId, nodeType, slug, path, titleZh, titleEn, navigationStatus, externalUrl, sortOrder);

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'page.create',
    objectType: 'page_node',
    objectId: id,
    detail: { slug, path, nodeType, parentId },
  }));
  res.ok({ node: nodeJson(getNode(conn, id)) }, 201);
});

// PATCH /api/admin/pages/:id (spec §4)
router.patch('/:id', ...write, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');

  const { titleZh, titleEn, navigationStatus, externalUrl, sortOrder, slug } = req.body || {};
  const updates = {
    title_zh: titleZh ?? node.title_zh,
    title_en: titleEn ?? node.title_en,
    navigation_status: navigationStatus ?? node.navigation_status,
    external_url: externalUrl ?? node.external_url,
    sort_order: sortOrder ?? node.sort_order,
  };
  if (!NAVIGATION_STATUSES.includes(updates.navigation_status)) {
    return res.fail('VALIDATION_FAILED', '無效的導航狀態', [{ field: 'navigationStatus', code: 'enum', message: '無效的導航狀態' }]);
  }
  if (updates.navigation_status === 'external' && !updates.external_url) {
    return res.fail('VALIDATION_FAILED', '外部跳轉必須填寫 externalUrl', [{ field: 'externalUrl', code: 'required', message: '外部跳轉必須填寫 externalUrl' }]);
  }

  let newPath = node.path;
  let redirectFrom = null;
  if (slug != null && slug !== node.slug) {
    if (!SLUG_PATTERN.test(slug)) {
      return res.fail('VALIDATION_FAILED', 'slug 只能包含小寫字母、數字和連字符', [{ field: 'slug', code: 'pattern', message: 'slug 格式不正確' }]);
    }
    if (slugTaken(conn, node.parent_id, slug, node.id)) {
      return res.fail('REFERENCE_EXISTS', '同一父級下 slug 已存在', [{ field: 'slug', code: 'duplicate', message: 'slug 在同級中必須唯一' }]);
    }
    const parent = node.parent_id ? getNode(conn, node.parent_id) : null;
    newPath = joinPath(parent ? parent.path : '', slug);
    if (pathTaken(conn, newPath, node.id)) {
      return res.fail('REFERENCE_EXISTS', '路徑已存在', [{ field: 'slug', code: 'duplicate', message: `路徑 ${newPath} 已被使用` }]);
    }
    // 主设计 §5.2: changing a published path records a redirect.
    if (node.published_version_id) redirectFrom = node.path;
    updates.slug = slug;
    updates.path = newPath;
  }

  const apply = conn.transaction(() => {
    conn
      .prepare(
        `UPDATE page_nodes
         SET title_zh = ?, title_en = ?, navigation_status = ?, external_url = ?, sort_order = ?,
             slug = ?, path = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(
        updates.title_zh,
        updates.title_en,
        updates.navigation_status,
        updates.external_url,
        updates.sort_order,
        updates.slug ?? node.slug,
        newPath,
        node.id
      );
    if (updates.path && updates.path !== node.path) {
      recomputeSubtreePaths(conn, { ...node, path: newPath });
      if (redirectFrom) {
        conn
          .prepare(
            `INSERT INTO redirects (id, from_path, to_path, status_code, created_by)
             VALUES (?, ?, ?, 301, ?)
             ON CONFLICT(from_path) DO UPDATE SET to_path = excluded.to_path`
          )
          .run(crypto.randomUUID(), redirectFrom, newPath, req.admin.id);
      }
    }
  });
  apply();

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'page.update',
    objectType: 'page_node',
    objectId: node.id,
    detail: { changed: Object.keys(req.body || {}), redirectFrom },
  }));
  res.ok({ node: nodeJson(getNode(conn, node.id)) });
});

// POST /api/admin/pages/:id/move (spec §4)
router.post('/:id/move', ...write, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');

  const { parentId = null, sortOrder } = req.body || {};
  const all = conn.prepare('SELECT id, parent_id FROM page_nodes WHERE deleted_at IS NULL').all();
  const verdict = validateMove(all, node.id, parentId);
  if (!verdict.ok) {
    const messages = {
      self: '節點不能移動到自身之下',
      missing_node: '頁面不存在',
      missing_parent: '目標父節點不存在',
      cycle: '不能移動到自己的子級之下（循環層級）',
      depth: '移動後超過最大深度 3',
    };
    return res.fail('VALIDATION_FAILED', messages[verdict.reason], [{ field: 'parentId', code: verdict.reason, message: messages[verdict.reason] }]);
  }
  if (slugTaken(conn, parentId, node.slug, node.id)) {
    return res.fail('REFERENCE_EXISTS', '目標父級下已存在相同 slug', [{ field: 'slug', code: 'duplicate', message: 'slug 在同級中必須唯一' }]);
  }

  const parent = parentId ? getNode(conn, parentId) : null;
  const newPath = joinPath(parent ? parent.path : '', node.slug);
  if (pathTaken(conn, newPath, node.id)) {
    return res.fail('REFERENCE_EXISTS', `路徑 ${newPath} 已被使用`, [{ field: 'slug', code: 'duplicate', message: '路徑衝突' }]);
  }

  const apply = conn.transaction(() => {
    conn
      .prepare("UPDATE page_nodes SET parent_id = ?, path = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?")
      .run(parentId, newPath, sortOrder ?? node.sort_order, node.id);
    recomputeSubtreePaths(conn, { ...node, path: newPath });
  });
  apply();

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'page.move',
    objectType: 'page_node',
    objectId: node.id,
    detail: { fromParentId: node.parent_id, toParentId: parentId, fromPath: node.path, toPath: newPath },
  }));
  res.ok({ node: nodeJson(getNode(conn, node.id)) });
});

// POST /api/admin/pages/:id/duplicate (spec §4)
router.post('/:id/duplicate', ...write, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');

  const parent = node.parent_id ? getNode(conn, node.parent_id) : null;
  const slug = uniqueCopySlug(conn, node.parent_id, node.slug);
  const path = joinPath(parent ? parent.path : '', slug);
  const id = crypto.randomUUID();

  // Insert the node, then copy blocks from the current draft (falling back
  // to the published version) inside one transaction.
  conn.transaction(() => {
    conn
      .prepare(
        `INSERT INTO page_nodes (id, parent_id, node_type, slug, path, title_zh, title_en, navigation_status, external_url, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, node.parent_id, node.node_type, slug, path, `${node.title_zh}（副本）`, `${node.title_en} (Copy)`, 'hidden', node.external_url, node.sort_order + 1);

    const sourceVersionId = node.draft_version_id || node.published_version_id;
    if (sourceVersionId) {
      const source = conn.prepare('SELECT * FROM page_versions WHERE id = ?').get(sourceVersionId);
      if (source) {
        const draftId = crypto.randomUUID();
        conn
          .prepare("INSERT INTO page_versions (id, page_id, revision, status, source_version_id) VALUES (?, ?, ?, 'draft', ?)")
          .run(draftId, id, source.revision, sourceVersionId);
        const blocks = loadBlocks(conn, sourceVersionId);
        const idMap = new Map(blocks.map((block) => [block.id, crypto.randomUUID()]));
        const insert = conn.prepare(
          `INSERT INTO page_blocks (id, page_version_id, component_type, component_version, sort_order, parent_block_id, is_visible, anchor_id, content_zh, content_en, settings)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const block of blocks) {
          insert.run(idMap.get(block.id), draftId, block.component_type, block.component_version, block.sort_order,
            block.parent_block_id ? idMap.get(block.parent_block_id) : null, block.is_visible, block.anchor_id,
            block.content_zh, block.content_en, block.settings);
          syncBlockReferences(conn, {
            blockId: idMap.get(block.id),
            definition: registry.getDefinition(block.component_type),
            config: {
              contentZh: JSON.parse(block.content_zh || '{}'),
              contentEn: JSON.parse(block.content_en || '{}'),
              settings: JSON.parse(block.settings || '{}'),
            },
          });
        }
        conn.prepare('UPDATE page_nodes SET draft_version_id = ? WHERE id = ?').run(draftId, id);
      }
    }
  })();

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'page.duplicate',
    objectType: 'page_node',
    objectId: id,
    detail: { sourceId: node.id, slug, path },
  }));
  res.ok({ node: nodeJson(getNode(conn, id)) }, 201);
});

// DELETE /api/admin/pages/:id — recycle bin (spec §5.1: children strategy required)
router.delete('/:id', ...write, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');

  const children = conn.prepare('SELECT * FROM page_nodes WHERE parent_id = ? AND deleted_at IS NULL').all(node.id);
  const { childrenStrategy, moveToParentId } = req.body || {};
  if (children.length > 0 && !childrenStrategy) {
    return res.fail('VALIDATION_FAILED', '刪除包含子項的欄目時必須選擇子項處理方式', [
      { field: 'childrenStrategy', code: 'required', message: '必填：trash（連同子項移入回收站）或 move（移動子項）' },
    ]);
  }
  if (childrenStrategy && !['trash', 'move'].includes(childrenStrategy)) {
    return res.fail('VALIDATION_FAILED', '無效的子項處理方式', [{ field: 'childrenStrategy', code: 'enum', message: '只能是 trash 或 move' }]);
  }

  const now = new Date().toISOString();
  const apply = conn.transaction(() => {
    if (childrenStrategy === 'move') {
      const target = moveToParentId ?? node.parent_id;
      const all = conn.prepare('SELECT id, parent_id FROM page_nodes WHERE deleted_at IS NULL').all();
      for (const child of children) {
        const verdict = validateMove(all, child.id, target);
        if (!verdict.ok) {
          const error = new Error('move_invalid');
          error.reason = verdict.reason;
          error.childId = child.id;
          throw error;
        }
      }
      const targetNode = target ? getNode(conn, target) : null;
      for (const child of children) {
        const childPath = joinPath(targetNode ? targetNode.path : '', child.slug);
        conn.prepare('UPDATE page_nodes SET parent_id = ?, path = ? WHERE id = ?').run(target, childPath, child.id);
        recomputeSubtreePaths(conn, { ...child, path: childPath });
      }
      conn.prepare("UPDATE page_nodes SET deleted_at = ?, updated_at = datetime('now') WHERE id = ?").run(now, node.id);
    } else {
      // Trash the node together with its whole subtree.
      const trashSubtree = (id) => {
        conn.prepare("UPDATE page_nodes SET deleted_at = ?, updated_at = datetime('now') WHERE id = ?").run(now, id);
        for (const child of conn.prepare('SELECT id FROM page_nodes WHERE parent_id = ? AND deleted_at IS NULL').all(id)) {
          trashSubtree(child.id);
        }
      };
      trashSubtree(node.id);
    }
  });
  try {
    apply();
  } catch (error) {
    if (error.message === 'move_invalid') {
      return res.fail('VALIDATION_FAILED', `子項 ${error.childId} 無法移動（${error.reason}）`, [{ field: 'moveToParentId', code: error.reason, message: '子項移動目標無效' }]);
    }
    throw error;
  }

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'page.trash',
    objectType: 'page_node',
    objectId: node.id,
    detail: { childrenStrategy: childrenStrategy || null, childCount: children.length },
  }));
  res.ok({ deleted: true, id: node.id });
});

// POST /api/admin/pages/:id/restore (spec §4)
router.post('/:id/restore', ...write, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || !node.deleted_at) return res.fail('NOT_FOUND', '回收站中沒有該頁面');
  if (node.parent_id) {
    const parent = getNode(conn, node.parent_id);
    if (!parent || parent.deleted_at) {
      return res.fail('VALIDATION_FAILED', '請先恢復上級欄目', [{ field: 'parentId', code: 'deleted', message: '父節點仍在回收站' }]);
    }
  }

  const deletedAt = node.deleted_at;
  const apply = conn.transaction(() => {
    // Restore the node and everything trashed in the same batch.
    const restoreSubtree = (id) => {
      conn.prepare('UPDATE page_nodes SET deleted_at = NULL WHERE id = ?').run(id);
      for (const child of conn.prepare('SELECT id, deleted_at FROM page_nodes WHERE parent_id = ?').all(id)) {
        if (child.deleted_at === deletedAt) restoreSubtree(child.id);
      }
    };
    restoreSubtree(node.id);
  });
  apply();

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'page.restore',
    objectType: 'page_node',
    objectId: node.id,
  }));
  res.ok({ node: nodeJson(getNode(conn, node.id)) });
});

// ---------- draft & blocks ----------

// GET /api/admin/pages/:id/draft (spec §4)
router.get('/:id/draft', ...read, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const { version, created } = getOrCreateDraft(conn, node);
  res.ok({ version, blocks: loadDraftBlocksJson(conn, version.id), created });
});

// PATCH /api/admin/pages/:id/draft (spec §4: expectedRevision + mutationId)
router.patch('/:id/draft', ...write, (req, res, next) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const { expectedRevision, mutationId, seo } = req.body || {};
  if (seo != null && (typeof seo !== 'object' || Array.isArray(seo))) {
    return res.fail('VALIDATION_FAILED', 'seo 必須是物件', [{ field: 'seo', code: 'type', message: 'seo 必須是物件' }]);
  }
  try {
    const result = applyDraftMutation(conn, node, { expectedRevision, mutationId, createdBy: req.admin.id }, (draft) => {
      if (seo != null) {
        conn.prepare('UPDATE page_versions SET seo = ? WHERE id = ?').run(JSON.stringify(seo), draft.id);
      }
      return { version: conn.prepare('SELECT * FROM page_versions WHERE id = ?').get(draft.id) };
    });
    res.ok(result);
  } catch (error) {
    handleDraftError(req, res, next, error);
  }
});

// POST /api/admin/pages/:id/draft/blocks (spec §5)
router.post('/:id/draft/blocks', ...write, (req, res, next) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const { expectedRevision, mutationId, block } = req.body || {};
  if (!block || !block.componentType) {
    return res.fail('VALIDATION_FAILED', '缺少 block.componentType', [{ field: 'componentType', code: 'required', message: '必填' }]);
  }
  if (!registry.allowsPageType(block.componentType, 'page')) {
    return res.fail('VALIDATION_FAILED', `組件 ${block.componentType} 不允許用於頁面`, [{ field: 'componentType', code: 'enum', message: '組件類型不允許' }]);
  }

  try {
    const result = applyDraftMutation(conn, node, { expectedRevision, mutationId, createdBy: req.admin.id }, (draft) => {
      const blocks = loadDraftBlocksJson(conn, draft.id);
      const definition = registry.getDefinition(block.componentType);
      const id = crypto.randomUUID();
      const candidate = {
        id,
        component_type: block.componentType,
        parent_block_id: block.parentBlockId || null,
        contentZh: applyDefaults(definition.schema.content, block.contentZh || {}),
        contentEn: applyDefaults(definition.schema.content, block.contentEn || {}),
        settings: applyDefaults(definition.schema.settings, block.settings || {}),
      };
      const errors = validateProspectiveBlocks([...blocks, candidate]);
      if (errors.length) {
        const error = new Error('block_validation');
        error.fields = errors;
        throw error;
      }
      const maxSort = blocks.reduce((max, entry) => Math.max(max, entry.sort_order), 0);
      conn
        .prepare(
          `INSERT INTO page_blocks (id, page_version_id, component_type, component_version, sort_order, parent_block_id, is_visible, anchor_id, content_zh, content_en, settings)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          draft.id,
          block.componentType,
          definition.version,
          block.sortOrder ?? maxSort + 1,
          candidate.parent_block_id,
          block.isVisible === false ? 0 : 1,
          block.anchorId || null,
          JSON.stringify(candidate.contentZh),
          JSON.stringify(candidate.contentEn),
          JSON.stringify(candidate.settings)
        );
      syncBlockReferences(conn, { blockId: id, definition, config: candidate });
      return { block: blockJson(conn.prepare('SELECT * FROM page_blocks WHERE id = ?').get(id)) };
    });
    res.ok(result, 201);
  } catch (error) {
    if (error.message === 'block_validation') {
      return res.fail('VALIDATION_FAILED', '組件配置不完整', error.fields);
    }
    handleDraftError(req, res, next, error);
  }
});

// PATCH /api/admin/pages/:id/draft/blocks/:blockId (spec §5)
router.patch('/:id/draft/blocks/:blockId', ...write, (req, res, next) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const { expectedRevision, mutationId, patch = {} } = req.body || {};

  try {
    const result = applyDraftMutation(conn, node, { expectedRevision, mutationId, createdBy: req.admin.id }, (draft) => {
      const blocks = loadDraftBlocksJson(conn, draft.id);
      const current = blocks.find((entry) => entry.id === req.params.blockId);
      if (!current) {
        const error = new Error('block_missing');
        throw error;
      }
      const merged = {
        ...current,
        contentZh: patch.contentZh ?? current.contentZh,
        contentEn: patch.contentEn ?? current.contentEn,
        settings: patch.settings ?? current.settings,
        parent_block_id: patch.parentBlockId !== undefined ? patch.parentBlockId : current.parent_block_id,
      };
      const errors = validateProspectiveBlocks(blocks.map((entry) => (entry.id === current.id ? merged : entry)));
      if (errors.length) {
        const error = new Error('block_validation');
        error.fields = errors;
        throw error;
      }
      conn
        .prepare(
          `UPDATE page_blocks
           SET content_zh = ?, content_en = ?, settings = ?, parent_block_id = ?,
               is_visible = ?, anchor_id = ?, sort_order = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(
          JSON.stringify(merged.contentZh),
          JSON.stringify(merged.contentEn),
          JSON.stringify(merged.settings),
          merged.parent_block_id,
          patch.isVisible === undefined ? current.is_visible : patch.isVisible ? 1 : 0,
          patch.anchorId !== undefined ? patch.anchorId : current.anchor_id,
          patch.sortOrder ?? current.sort_order,
          current.id
        );
      syncBlockReferences(conn, {
        blockId: current.id,
        definition: registry.getDefinition(current.component_type),
        config: merged,
      });
      return { block: blockJson(conn.prepare('SELECT * FROM page_blocks WHERE id = ?').get(current.id)) };
    });
    res.ok(result);
  } catch (error) {
    if (error.message === 'block_missing') return res.fail('NOT_FOUND', '組件不存在');
    if (error.message === 'block_validation') return res.fail('VALIDATION_FAILED', '組件配置不完整', error.fields);
    handleDraftError(req, res, next, error);
  }
});

// DELETE /api/admin/pages/:id/draft/blocks/:blockId (spec §5)
router.delete('/:id/draft/blocks/:blockId', ...write, (req, res, next) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const body = req.body || {};
  const expectedRevision = body.expectedRevision ?? Number(req.query.expectedRevision);
  const mutationId = body.mutationId ?? req.query.mutationId;

  try {
    const result = applyDraftMutation(conn, node, { expectedRevision, mutationId, createdBy: req.admin.id }, (draft) => {
      const blocks = loadDraftBlocksJson(conn, draft.id);
      const current = blocks.find((entry) => entry.id === req.params.blockId);
      if (!current) {
        const error = new Error('block_missing');
        throw error;
      }
      const childCount = blocks.filter((entry) => entry.parent_block_id === current.id).length;
      if (childCount > 0) {
        const error = new Error('block_has_children');
        error.childCount = childCount;
        throw error;
      }
      conn.prepare('DELETE FROM page_blocks WHERE id = ?').run(current.id);
      clearBlockReferences(conn, current.id);
      return { deleted: true, blockId: current.id };
    });
    res.ok(result);
  } catch (error) {
    if (error.message === 'block_missing') return res.fail('NOT_FOUND', '組件不存在');
    if (error.message === 'block_has_children') {
      return res.fail('REFERENCE_EXISTS', '請先移動或刪除子組件', [
        { field: 'blockId', code: 'has_children', message: `該組件包含 ${error.childCount} 個子組件` },
      ]);
    }
    handleDraftError(req, res, next, error);
  }
});

// POST /api/admin/pages/:id/draft/blocks/reorder (spec §5)
router.post('/:id/draft/blocks/reorder', ...write, (req, res, next) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const { expectedRevision, mutationId, order } = req.body || {};

  try {
    const result = applyDraftMutation(conn, node, { expectedRevision, mutationId, createdBy: req.admin.id }, (draft) => {
      const blocks = loadDraftBlocksJson(conn, draft.id);
      const known = new Set(blocks.map((entry) => entry.id));
      const valid = Array.isArray(order) && order.length === known.size && order.every((id) => known.has(id));
      if (!valid) {
        const error = new Error('bad_order');
        throw error;
      }
      const update = conn.prepare('UPDATE page_blocks SET sort_order = ? WHERE id = ?');
      order.forEach((id, index) => update.run(index + 1, id));
      return { blocks: loadDraftBlocksJson(conn, draft.id) };
    });
    res.ok(result);
  } catch (error) {
    if (error.message === 'bad_order') {
      return res.fail('VALIDATION_FAILED', 'order 必須是當前草稿全部組件 ID 的排列', [
        { field: 'order', code: 'items', message: '缺少或包含未知組件 ID' },
      ]);
    }
    handleDraftError(req, res, next, error);
  }
});

// POST /api/admin/pages/:id/draft/blocks/:blockId/duplicate (spec §5)
router.post('/:id/draft/blocks/:blockId/duplicate', ...write, (req, res, next) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const { expectedRevision, mutationId } = req.body || {};

  try {
    const result = applyDraftMutation(conn, node, { expectedRevision, mutationId, createdBy: req.admin.id }, (draft) => {
      const blocks = loadBlocks(conn, draft.id);
      const source = blocks.find((entry) => entry.id === req.params.blockId);
      if (!source) {
        const error = new Error('block_missing');
        throw error;
      }
      const id = crypto.randomUUID();
      const maxSort = blocks.reduce((max, entry) => Math.max(max, entry.sort_order), 0);
      conn
        .prepare(
          `INSERT INTO page_blocks (id, page_version_id, component_type, component_version, sort_order, parent_block_id, is_visible, anchor_id, content_zh, content_en, settings)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
        )
        .run(
          id,
          draft.id,
          source.component_type,
          source.component_version,
          maxSort + 1,
          source.parent_block_id,
          source.is_visible,
          source.content_zh,
          source.content_en,
          source.settings
        );
      syncBlockReferences(conn, {
        blockId: id,
        definition: registry.getDefinition(source.component_type),
        config: {
          contentZh: JSON.parse(source.content_zh || '{}'),
          contentEn: JSON.parse(source.content_en || '{}'),
          settings: JSON.parse(source.settings || '{}'),
        },
      });
      return { block: blockJson(conn.prepare('SELECT * FROM page_blocks WHERE id = ?').get(id)) };
    });
    res.ok(result, 201);
  } catch (error) {
    if (error.message === 'block_missing') return res.fail('NOT_FOUND', '組件不存在');
    handleDraftError(req, res, next, error);
  }
});

// ---------- preview & publish (spec: data-api §9-§11) ----------

// POST /api/admin/pages/:id/preview — short-lived preview token for the draft
router.post('/:id/preview', ...read, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const draft = getDraftVersion(conn, node.id);
  if (!draft) return res.fail('NOT_FOUND', '草稿不存在');
  const { token, expiresAt } = createPreviewToken(conn, {
    objectType: 'page',
    objectId: node.id,
    revision: draft.revision,
    createdBy: req.admin.id,
  });
  res.ok({ token, url: `/api/preview/${token}`, revision: draft.revision, expiresAt }, 201);
});

// POST /api/admin/pages/:id/publish — checks then one transaction (§10)
router.post('/:id/publish', ...publish, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  const draft = getDraftVersion(conn, node.id);
  if (!draft) return res.fail('NOT_FOUND', '草稿不存在');

  const { expectedRevision } = req.body || {};
  if (!Number.isInteger(expectedRevision) || expectedRevision !== draft.revision) {
    return res.fail('REVISION_CONFLICT', '頁面已被其他編輯更新', [
      { field: 'expectedRevision', code: 'conflict', message: `當前修訂為 ${draft.revision}` },
    ]);
  }

  const blocks = loadBlocks(conn, draft.id);
  const problems = checkPage(conn, node, draft, blocks);
  if (problems.length) {
    return res.fail('PUBLISH_CHECK_FAILED', '發佈檢查未通過', problems, 422);
  }

  conn.transaction(() => {
    conn.prepare("UPDATE page_versions SET status = 'superseded' WHERE page_id = ? AND status = 'published'").run(node.id);
    conn
      .prepare("UPDATE page_versions SET status = 'published', published_by = ?, published_at = datetime('now') WHERE id = ?")
      .run(req.admin.id, draft.id);
    conn
      .prepare("UPDATE page_nodes SET published_version_id = ?, draft_version_id = NULL, updated_at = datetime('now') WHERE id = ?")
      .run(draft.id, node.id);
    recordPublish(conn, {
      objectType: 'page',
      objectId: node.id,
      versionId: draft.id,
      revision: draft.revision,
      action: 'publish',
      actorId: req.admin.id,
      checksReport: { problems: [] },
    });
    prunePageVersions(conn, node.id);
  })();
  // §10 step 7: no query-cache layer exists yet; nothing to refresh. The
  // post-commit hook lands with the frontend rendering milestone.

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'page.publish',
    objectType: 'page_node',
    objectId: node.id,
    detail: { versionId: draft.id, revision: draft.revision, path: node.path },
  }));
  res.ok({ published: true, versionId: draft.id, revision: draft.revision });
});

// POST /api/admin/pages/:id/withdraw — take the page offline (record kept)
router.post('/:id/withdraw', ...publish, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');
  if (!node.published_version_id) return res.fail('NOT_FOUND', '頁面沒有已發佈版本');

  const version = conn.prepare('SELECT * FROM page_versions WHERE id = ?').get(node.published_version_id);
  if (!version) return res.fail('NOT_FOUND', '已發佈版本記錄不存在');
  conn.transaction(() => {
    conn.prepare('UPDATE page_nodes SET published_version_id = NULL, updated_at = datetime(\'now\') WHERE id = ?').run(node.id);
    recordPublish(conn, {
      objectType: 'page',
      objectId: node.id,
      versionId: node.published_version_id,
      revision: version.revision,
      action: 'withdraw',
      actorId: req.admin.id,
    });
  })();

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'page.withdraw',
    objectType: 'page_node',
    objectId: node.id,
    detail: { versionId: node.published_version_id },
  }));
  res.ok({ withdrawn: true, id: node.id });
});

// POST /api/admin/pages/:id/rollback — new draft from a historical version (§11)
router.post('/:id/rollback', ...rollback, (req, res) => {
  const conn = getDb();
  const node = getNode(conn, req.params.id);
  if (!node || node.deleted_at) return res.fail('NOT_FOUND', '頁面不存在');

  const { revision } = req.body || {};
  if (!Number.isInteger(revision)) {
    return res.fail('VALIDATION_FAILED', '缺少要回退的修訂號', [{ field: 'revision', code: 'required', message: '必填整數' }]);
  }
  const target = conn
    .prepare("SELECT * FROM page_versions WHERE page_id = ? AND revision = ? AND status IN ('published', 'superseded')")
    .get(node.id, revision);
  if (!target) return res.fail('NOT_FOUND', `修訂 ${revision} 不存在或不是已發佈版本`);

  const result = conn.transaction(() => {
    const maxRevision = conn.prepare('SELECT MAX(revision) AS m FROM page_versions WHERE page_id = ?').get(node.id).m || 0;
    const nextRevision = maxRevision + 1;
    let draft = getDraftVersion(conn, node.id);
    const beforeState = draft ? captureDraftState(conn, draft.id) : null;
    const sourceBlocks = loadBlocks(conn, target.id);

    if (draft) {
      const oldBlocks = loadBlocks(conn, draft.id);
      for (const block of oldBlocks) clearBlockReferences(conn, block.id, 'page_block');
      conn.prepare('DELETE FROM page_blocks WHERE page_version_id = ?').run(draft.id);
      conn
        .prepare("UPDATE page_versions SET revision = ?, source_version_id = ?, seo = ? WHERE id = ?")
        .run(nextRevision, target.id, target.seo, draft.id);
    } else {
      const draftId = crypto.randomUUID();
      conn
        .prepare("INSERT INTO page_versions (id, page_id, revision, status, source_version_id, seo) VALUES (?, ?, ?, 'draft', ?, ?)")
        .run(draftId, node.id, nextRevision, target.id, target.seo);
      draft = conn.prepare('SELECT * FROM page_versions WHERE id = ?').get(draftId);
    }

    const insert = conn.prepare(
      `INSERT INTO page_blocks (id, page_version_id, component_type, component_version, sort_order, parent_block_id, is_visible, anchor_id, content_zh, content_en, settings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const idMap = new Map(sourceBlocks.map((block) => [block.id, crypto.randomUUID()]));
    for (const block of sourceBlocks) {
      const newId = idMap.get(block.id);
      insert.run(newId, draft.id, block.component_type, block.component_version, block.sort_order,
        block.parent_block_id ? idMap.get(block.parent_block_id) : null, block.is_visible, block.anchor_id,
        block.content_zh, block.content_en, block.settings);
      syncBlockReferences(conn, {
        blockId: newId,
        definition: registry.getDefinition(block.component_type),
        config: {
          contentZh: JSON.parse(block.content_zh || '{}'),
          contentEn: JSON.parse(block.content_en || '{}'),
          settings: JSON.parse(block.settings || '{}'),
        },
      });
    }
    conn.prepare('UPDATE page_nodes SET draft_version_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(draft.id, node.id);
    draft = conn.prepare('SELECT * FROM page_versions WHERE id = ?').get(draft.id);
    const afterState = captureDraftState(conn, draft.id);
    createDraftSnapshot(conn, {
      pageId: node.id,
      revision: draft.revision,
      sourceVersionId: draft.id,
      createdBy: req.admin.id,
      state: afterState,
      summary: summarizeDraftChange(beforeState, afterState),
    });
    recordPublish(conn, {
      objectType: 'page',
      objectId: node.id,
      versionId: target.id,
      revision: target.revision,
      action: 'rollback',
      actorId: req.admin.id,
    });
    return { version: draft, rolledBackFrom: revision };
  })();

  recordAudit(conn, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'page.rollback',
    objectType: 'page_node',
    objectId: node.id,
    detail: { rolledBackFrom: revision, newDraftRevision: result.version.revision },
  }));
  res.ok({ draft: result.version, rolledBackFrom: result.rolledBackFrom });
});

// Unified error shape for unexpected failures on these routes.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  console.error('admin/pages error:', err);
  res.fail('INTERNAL_ERROR', '伺服器錯誤');
});

module.exports = router;
