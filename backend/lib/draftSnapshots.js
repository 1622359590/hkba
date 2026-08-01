const crypto = require('crypto');

function parseJson(value, fallback = {}) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function captureDraftState(conn, versionId) {
  const version = conn.prepare('SELECT id, seo FROM page_versions WHERE id = ?').get(versionId);
  if (!version) return null;
  const blocks = conn.prepare(
    `SELECT id, component_type, component_version, sort_order, parent_block_id,
            is_visible, anchor_id, content_zh, content_en, settings
     FROM page_blocks WHERE page_version_id = ? ORDER BY sort_order, created_at`
  ).all(versionId);
  return {
    seo: parseJson(version.seo),
    blocks: blocks.map((row) => ({
      id: row.id,
      componentType: row.component_type,
      componentVersion: row.component_version,
      sortOrder: row.sort_order,
      parentBlockId: row.parent_block_id,
      isVisible: Boolean(row.is_visible),
      anchorId: row.anchor_id,
      contentZh: parseJson(row.content_zh),
      contentEn: parseJson(row.content_en),
      settings: parseJson(row.settings),
    })),
  };
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changedPaths(prefix, before, after) {
  if (sameValue(before, after)) return [];
  const beforeObject = before && typeof before === 'object' && !Array.isArray(before);
  const afterObject = after && typeof after === 'object' && !Array.isArray(after);
  if (!beforeObject || !afterObject) return [prefix];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap((key) => changedPaths(`${prefix}.${key}`, before[key], after[key]));
}

function blockLabel(block) {
  return { blockId: block.id, componentType: block.componentType };
}

function summarizeDraftChange(beforeState, afterState) {
  const before = beforeState || { seo: {}, blocks: [] };
  const after = afterState || { seo: {}, blocks: [] };
  const beforeMap = new Map(before.blocks.map((block) => [block.id, block]));
  const afterMap = new Map(after.blocks.map((block) => [block.id, block]));
  const added = after.blocks.filter((block) => !beforeMap.has(block.id)).map(blockLabel);
  const removed = before.blocks.filter((block) => !afterMap.has(block.id)).map(blockLabel);
  const moved = [];
  const changed = [];

  for (const block of after.blocks) {
    const previous = beforeMap.get(block.id);
    if (!previous) continue;
    if (previous.sortOrder !== block.sortOrder || previous.parentBlockId !== block.parentBlockId) {
      moved.push(blockLabel(block));
    }
    const fields = [
      ...changedPaths('contentZh', previous.contentZh, block.contentZh),
      ...changedPaths('contentEn', previous.contentEn, block.contentEn),
      ...changedPaths('settings', previous.settings, block.settings),
    ];
    if (previous.isVisible !== block.isVisible) fields.push('isVisible');
    if (previous.anchorId !== block.anchorId) fields.push('anchorId');
    if (previous.componentType !== block.componentType) fields.push('componentType');
    if (fields.length) changed.push({ ...blockLabel(block), fields: fields.sort() });
  }

  return {
    added,
    removed,
    moved,
    changed,
    seoFields: changedPaths('seo', before.seo, after.seo).map((field) => field.replace(/^seo\./, '')).sort(),
  };
}

function insertSnapshotBlocks(conn, snapshotId, blocks) {
  const insert = conn.prepare(
    `INSERT INTO page_draft_snapshot_blocks
       (id, snapshot_id, block_id, component_type, component_version, sort_order,
        parent_block_id, is_visible, anchor_id, content_zh, content_en, settings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const block of blocks) {
    insert.run(
      crypto.randomUUID(), snapshotId, block.id, block.componentType,
      block.componentVersion || 1, block.sortOrder || 0, block.parentBlockId || null,
      block.isVisible === false ? 0 : 1, block.anchorId || null,
      JSON.stringify(block.contentZh || {}), JSON.stringify(block.contentEn || {}),
      JSON.stringify(block.settings || {})
    );
  }
}

function pruneDraftSnapshots(conn, pageId, keep = 50) {
  const stale = conn.prepare(
    `SELECT id FROM page_draft_snapshots WHERE page_id = ?
     ORDER BY revision DESC, created_at DESC LIMIT -1 OFFSET ?`
  ).all(pageId, keep);
  const remove = conn.prepare('DELETE FROM page_draft_snapshots WHERE id = ?');
  for (const row of stale) remove.run(row.id);
  return stale.length;
}

function createDraftSnapshot(conn, {
  pageId,
  revision,
  sourceVersionId = null,
  createdBy = null,
  state,
  summary,
  keep = 50,
}) {
  const id = crypto.randomUUID();
  conn.prepare(
    `INSERT INTO page_draft_snapshots
       (id, page_id, revision, source_version_id, seo, change_summary, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, pageId, revision, sourceVersionId,
    JSON.stringify(state.seo || {}), JSON.stringify(summary || {}), createdBy
  );
  insertSnapshotBlocks(conn, id, state.blocks || []);
  pruneDraftSnapshots(conn, pageId, keep);
  return conn.prepare('SELECT * FROM page_draft_snapshots WHERE id = ?').get(id);
}

function loadSnapshotState(conn, snapshotId) {
  const snapshot = conn.prepare('SELECT * FROM page_draft_snapshots WHERE id = ?').get(snapshotId);
  if (!snapshot) return null;
  const blocks = conn.prepare(
    `SELECT block_id, component_type, component_version, sort_order, parent_block_id,
            is_visible, anchor_id, content_zh, content_en, settings
     FROM page_draft_snapshot_blocks WHERE snapshot_id = ? ORDER BY sort_order, rowid`
  ).all(snapshotId);
  return {
    snapshot,
    state: {
      seo: parseJson(snapshot.seo),
      blocks: blocks.map((row) => ({
        id: row.block_id,
        componentType: row.component_type,
        componentVersion: row.component_version,
        sortOrder: row.sort_order,
        parentBlockId: row.parent_block_id,
        isVisible: Boolean(row.is_visible),
        anchorId: row.anchor_id,
        contentZh: parseJson(row.content_zh),
        contentEn: parseJson(row.content_en),
        settings: parseJson(row.settings),
      })),
    },
  };
}

module.exports = {
  captureDraftState,
  summarizeDraftChange,
  createDraftSnapshot,
  pruneDraftSnapshots,
  loadSnapshotState,
};
