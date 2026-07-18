// Draft version helpers (spec: data-api §4, §8).
//
// Optimistic locking: every draft mutation carries expectedRevision; a
// mismatch returns REVISION_CONFLICT with the current revision so the client
// can refresh or re-apply. Idempotency: mutations may carry a mutationId;
// replays return the stored response without re-applying (mutation_log).

const crypto = require('crypto');

class DraftConflict extends Error {
  constructor(currentRevision) {
    super('REVISION_CONFLICT');
    this.code = 'REVISION_CONFLICT';
    this.currentRevision = currentRevision;
  }
}

function loadBlocks(conn, versionId) {
  return conn
    .prepare('SELECT * FROM page_blocks WHERE page_version_id = ? ORDER BY sort_order, created_at')
    .all(versionId);
}

function getDraftVersion(conn, pageId) {
  return conn
    .prepare("SELECT * FROM page_versions WHERE page_id = ? AND status = 'draft' ORDER BY revision DESC LIMIT 1")
    .get(pageId);
}

// Returns the node's current draft version, creating one when missing:
// blocks are copied from the published version, or an empty draft is created
// for never-published pages (spec §4 GET draft).
function getOrCreateDraft(conn, node) {
  const existing = getDraftVersion(conn, node.id);
  if (existing) return { version: existing, created: false };

  let revision = 1;
  let sourceVersionId = null;
  if (node.published_version_id) {
    const published = conn
      .prepare('SELECT * FROM page_versions WHERE id = ?')
      .get(node.published_version_id);
    if (published) {
      revision = published.revision;
      sourceVersionId = published.id;
    }
  }

  const id = crypto.randomUUID();
  conn
    .prepare(
      `INSERT INTO page_versions (id, page_id, revision, status, source_version_id)
       VALUES (?, ?, ?, 'draft', ?)`
    )
    .run(id, node.id, revision, sourceVersionId);

  if (sourceVersionId) {
    const sourceBlocks = loadBlocks(conn, sourceVersionId);
    const idMap = new Map(sourceBlocks.map((block) => [block.id, crypto.randomUUID()]));
    const insert = conn.prepare(
      `INSERT INTO page_blocks (
        id, page_version_id, component_type, component_version, sort_order,
        parent_block_id, is_visible, anchor_id, content_zh, content_en, settings
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const block of sourceBlocks) {
      insert.run(
        idMap.get(block.id),
        id,
        block.component_type,
        block.component_version,
        block.sort_order,
        block.parent_block_id ? idMap.get(block.parent_block_id) : null,
        block.is_visible,
        block.anchor_id,
        block.content_zh,
        block.content_en,
        block.settings
      );
    }
  }

  conn.prepare('UPDATE page_nodes SET draft_version_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(id, node.id);
  return { version: conn.prepare('SELECT * FROM page_versions WHERE id = ?').get(id), created: true };
}

function findMutation(conn, mutationId) {
  return conn
    .prepare('SELECT * FROM mutation_log WHERE mutation_id = ?')
    .get(mutationId);
}

function recordMutation(conn, { mutationId, pageId, revision, response }) {
  conn
    .prepare(
      'INSERT INTO mutation_log (id, mutation_id, page_id, revision, response) VALUES (?, ?, ?, ?, ?)'
    )
    .run(crypto.randomUUID(), mutationId, pageId, revision, JSON.stringify(response));
}

// Executes fn inside the draft-mutation protocol:
//   replay check -> revision check -> transaction(fn, bump revision, log).
// fn receives the draft version row and must return the response payload;
// the helper augments it with the new revision.
function applyDraftMutation(conn, node, { expectedRevision, mutationId }, fn) {
  if (mutationId) {
    const replay = findMutation(conn, mutationId);
    if (replay) {
      return { replayed: true, ...JSON.parse(replay.response) };
    }
  }

  const draft = getDraftVersion(conn, node.id);
  if (!draft) {
    const error = new Error('NO_DRAFT');
    error.code = 'NOT_FOUND';
    throw error;
  }
  if (!Number.isInteger(expectedRevision) || expectedRevision !== draft.revision) {
    throw new DraftConflict(draft.revision);
  }

  const run = conn.transaction(() => {
    const payload = fn(draft);
    const nextRevision = draft.revision + 1;
    conn
      .prepare("UPDATE page_versions SET revision = ? WHERE id = ?")
      .run(nextRevision, draft.id);
    const response = { ...payload, revision: nextRevision };
    if (mutationId) {
      recordMutation(conn, { mutationId, pageId: node.id, revision: nextRevision, response });
    }
    return response;
  });
  return run();
}

module.exports = { DraftConflict, loadBlocks, getDraftVersion, getOrCreateDraft, applyDraftMutation };
