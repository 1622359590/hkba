// Publish transaction helpers (spec: data-api §10, §12).
//
// recordPublish writes the publish journal row inside the publish
// transaction (§10 step 5). The prune helpers enforce the retention policy
// (§12: keep the newest 20 published versions per object) at publish time;
// pruned blocks release their media references first so delete protection
// stays accurate.

const crypto = require('crypto');
const { selectPublishedVersionsToPrune } = require('./retention');
const { clearBlockReferences } = require('./mediaReferences');

function recordPublish(conn, { objectType, objectId, versionId, revision, action, actorId, checksReport = {} }) {
  conn
    .prepare(
      `INSERT INTO publish_records (id, object_type, object_id, version_id, revision, action, actor_id, checks_report)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(crypto.randomUUID(), objectType, objectId, versionId, revision, action, actorId, JSON.stringify(checksReport));
}

// Keeps the newest 20 published/superseded page versions; prunes the rest
// together with their blocks (spec §12).
function prunePageVersions(conn, pageId, options = {}) {
  const versions = conn
    .prepare("SELECT * FROM page_versions WHERE page_id = ? AND status IN ('published', 'superseded')")
    .all(pageId);
  const pruneIds = selectPublishedVersionsToPrune(versions, options);
  for (const id of pruneIds) {
    const blocks = conn.prepare('SELECT id FROM page_blocks WHERE page_version_id = ?').all(id);
    for (const block of blocks) clearBlockReferences(conn, block.id, 'page_block');
    conn.prepare('DELETE FROM page_blocks WHERE page_version_id = ?').run(id);
    conn.prepare('DELETE FROM page_versions WHERE id = ?').run(id);
  }
  return pruneIds;
}

// Same policy for news revisions (blocks keyed by revision number).
function pruneNewsRevisions(conn, newsId, options = {}) {
  const revisions = conn
    .prepare("SELECT * FROM news_revisions WHERE news_id = ? AND status IN ('published', 'superseded')")
    .all(newsId);
  const pruneIds = selectPublishedVersionsToPrune(revisions, options);
  const byId = new Map(revisions.map((row) => [row.id, row]));
  for (const id of pruneIds) {
    const row = byId.get(id);
    const blocks = conn.prepare('SELECT id FROM news_blocks WHERE news_id = ? AND revision = ?').all(newsId, row.revision);
    for (const block of blocks) clearBlockReferences(conn, block.id, 'news_block');
    conn.prepare('DELETE FROM news_blocks WHERE news_id = ? AND revision = ?').run(newsId, row.revision);
    conn.prepare('DELETE FROM news_revisions WHERE id = ?').run(id);
  }
  return pruneIds;
}

module.exports = { recordPublish, prunePageVersions, pruneNewsRevisions };
