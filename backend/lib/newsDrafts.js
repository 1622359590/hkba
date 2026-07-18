// News draft mutation helpers (spec: data-api §6, §8).
//
// Mirrors lib/drafts.js for the news entity: one draft revision row per news
// item; body blocks carry the revision number they belong to (006 schema).
// Every mutation carries expectedRevision (optimistic lock) and may carry a
// mutationId (idempotent replay via mutation_log, generalized in 010).
//
// Flow: replay check -> revision check -> transaction {
//   fn({ draft, nextRevision }) writes metadata snapshot and rewrites blocks
//   at nextRevision; the helper then bumps the draft row and
//   news_items.current_draft_revision, and logs the mutation response.
// }

const crypto = require('crypto');
const { DraftConflict } = require('./drafts');

function getDraftRevision(conn, newsId) {
  return conn
    .prepare("SELECT * FROM news_revisions WHERE news_id = ? AND status = 'draft' ORDER BY revision DESC LIMIT 1")
    .get(newsId);
}

function loadNewsBlocks(conn, newsId, revision) {
  return conn
    .prepare('SELECT * FROM news_blocks WHERE news_id = ? AND revision = ? ORDER BY sort_order, created_at')
    .all(newsId, revision);
}

function findMutation(conn, mutationId) {
  return conn.prepare('SELECT * FROM mutation_log WHERE mutation_id = ?').get(mutationId);
}

// Executes fn inside the news draft-mutation protocol. fn receives
// { draft, nextRevision } and must return the response payload; the helper
// augments it with the new revision number.
function applyNewsMutation(conn, news, { expectedRevision, mutationId }, fn) {
  if (mutationId) {
    const replay = findMutation(conn, mutationId);
    if (replay) {
      return { replayed: true, ...JSON.parse(replay.response) };
    }
  }

  const draft = getDraftRevision(conn, news.id);
  if (!draft || news.current_draft_revision == null) {
    const error = new Error('NO_DRAFT');
    error.code = 'NOT_FOUND';
    throw error;
  }
  if (!Number.isInteger(expectedRevision) || expectedRevision !== draft.revision) {
    throw new DraftConflict(draft.revision);
  }
  const nextRevision = draft.revision + 1;

  const run = conn.transaction(() => {
    const payload = fn({ draft, nextRevision });
    conn.prepare('UPDATE news_revisions SET revision = ? WHERE id = ?').run(nextRevision, draft.id);
    conn
      .prepare("UPDATE news_items SET current_draft_revision = ?, updated_at = datetime('now') WHERE id = ?")
      .run(nextRevision, news.id);
    const response = { ...payload, revision: nextRevision };
    if (mutationId) {
      conn
        .prepare('INSERT INTO mutation_log (id, mutation_id, owner_id, revision, response) VALUES (?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), mutationId, news.id, nextRevision, JSON.stringify(response));
    }
    return response;
  });
  return run();
}

module.exports = { getDraftRevision, loadNewsBlocks, applyNewsMutation };
