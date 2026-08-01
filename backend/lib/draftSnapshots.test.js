const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { summarizeDraftChange } = require('./draftSnapshots');
const { migrate } = require('../db/migrate');
const { getOrCreateDraft, applyDraftMutation } = require('./drafts');

function block(id, overrides = {}) {
  return {
    id,
    componentType: 'content.hero',
    sortOrder: 0,
    parentBlockId: null,
    isVisible: true,
    anchorId: null,
    contentZh: { title: '原標題' },
    contentEn: { title: 'Original title' },
    settings: { tone: 'dark' },
    ...overrides,
  };
}

test('summarizes added and removed blocks', () => {
  const summary = summarizeDraftChange(
    { seo: {}, blocks: [block('old')] },
    { seo: {}, blocks: [block('new')] }
  );

  assert.deepEqual(summary.added.map((item) => item.blockId), ['new']);
  assert.deepEqual(summary.removed.map((item) => item.blockId), ['old']);
});

test('summarizes order, language, settings and visibility changes', () => {
  const before = { seo: {}, blocks: [block('hero')] };
  const after = {
    seo: {},
    blocks: [block('hero', {
      sortOrder: 3,
      parentBlockId: 'layout',
      isVisible: false,
      contentZh: { title: '新標題' },
      contentEn: { title: 'New title' },
      settings: { tone: 'light', spacing: 'wide' },
    })],
  };

  const summary = summarizeDraftChange(before, after);
  assert.deepEqual(summary.moved.map((item) => item.blockId), ['hero']);
  assert.deepEqual(summary.changed[0].fields, [
    'contentEn.title',
    'contentZh.title',
    'isVisible',
    'settings.spacing',
    'settings.tone',
  ]);
});

test('summarizes SEO fields without storing their raw values', () => {
  const summary = summarizeDraftChange(
    { seo: { titleZh: '舊', descriptionEn: 'Old' }, blocks: [] },
    { seo: { titleZh: '新', descriptionEn: 'New' }, blocks: [] }
  );

  assert.deepEqual(summary.seoFields, ['descriptionEn', 'titleZh']);
  assert.equal(JSON.stringify(summary).includes('New'), false);
});

test('draft creation and successful mutations capture snapshots without duplicating replays', () => {
  const conn = new Database(':memory:');
  conn.pragma('foreign_keys = ON');
  migrate(conn);
  conn.prepare("INSERT INTO page_nodes (id, node_type, slug, path) VALUES ('page', 'page', 'page', '/page')").run();
  const node = conn.prepare("SELECT * FROM page_nodes WHERE id = 'page'").get();
  const { version } = getOrCreateDraft(conn, node);
  assert.equal(conn.prepare("SELECT COUNT(*) AS count FROM page_draft_snapshots WHERE page_id = 'page'").get().count, 1);

  const options = { expectedRevision: version.revision, mutationId: 'direct-snapshot-mutation' };
  const mutate = (draft) => {
    conn.prepare(
      "INSERT INTO page_blocks (id, page_version_id, component_type, content_zh) VALUES ('hero', ?, 'content.hero', ?)"
    ).run(draft.id, JSON.stringify({ title: 'HKBA' }));
    return { changed: true };
  };
  const first = applyDraftMutation(conn, node, options, mutate);
  const replay = applyDraftMutation(conn, node, options, mutate);

  assert.equal(first.revision, 2);
  assert.equal(replay.replayed, true);
  assert.equal(conn.prepare("SELECT COUNT(*) AS count FROM page_draft_snapshots WHERE page_id = 'page'").get().count, 2);
  conn.close();
});
