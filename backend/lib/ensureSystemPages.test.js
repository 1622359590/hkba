const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { migrate } = require('../db/migrate');
const { ensureSystemPages } = require('./ensureSystemPages');

function createDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function addLegacyMembership(db) {
  db.prepare(
    `INSERT INTO page_nodes
      (id, node_type, slug, path, title_zh, title_en, navigation_status, published_version_id)
     VALUES ('membership-page', 'page', 'membership', '/membership', '會員服務', 'Membership', 'visible', 'membership-v1')`
  ).run();
  db.prepare(
    `INSERT INTO page_versions (id, page_id, revision, status, seo)
     VALUES ('membership-v1', 'membership-page', 1, 'published', '{}')`
  ).run();
  db.prepare(
    `INSERT INTO page_blocks
      (id, page_version_id, component_type, sort_order, content_zh, content_en, settings)
     VALUES ('membership-block', 'membership-v1', 'content.rich-text', 1,
       '{"html":"<p>加入協會</p>"}', '{"html":"<p>Join HKBA</p>"}', '{}')`
  ).run();
}

function addOldDefaultNewsPage(db, { custom = false } = {}) {
  db.prepare(
    `INSERT INTO page_nodes
      (id, node_type, slug, path, title_zh, title_en, navigation_status, published_version_id)
     VALUES ('old-news', 'page', 'news', '/news', '新聞動態', 'News', 'visible', 'old-news-v1')`
  ).run();
  db.prepare(
    `INSERT INTO page_versions (id, page_id, revision, status, seo)
     VALUES ('old-news-v1', 'old-news', 1, 'published', '{}')`
  ).run();
  const insert = db.prepare(
    `INSERT INTO page_blocks
      (id, page_version_id, component_type, sort_order, content_zh, content_en, settings)
     VALUES (?, 'old-news-v1', ?, ?, ?, ?, ?)`
  );
  insert.run('old-news-hero', 'content.hero', 1,
    JSON.stringify({ title: '新聞動態', subtitle: '掌握香港區塊鏈協會最新消息' }),
    JSON.stringify({ title: 'News', subtitle: 'Latest updates from HKBA' }),
    JSON.stringify({ variant: 'left', overlay: 35 }));
  insert.run('old-news-list', 'news.list', 2,
    JSON.stringify({ title: '最新新聞', description: '' }),
    JSON.stringify({ title: 'Latest News', description: '' }),
    JSON.stringify({ yearMode: 'all', limit: 12, sort: 'newest', showYearFilter: true, showSummary: true, showDate: true }));
  if (custom) {
    insert.run('old-news-custom', 'content.rich-text', 3,
      JSON.stringify({ html: '<p>自訂</p>' }), JSON.stringify({ html: '<p>Custom</p>' }), '{}');
  }
}

test('provisions the eight canonical pages as drafts and converts legacy membership safely', () => {
  const db = createDb();
  addLegacyMembership(db);

  const first = ensureSystemPages(db);
  const nodes = db.prepare('SELECT * FROM page_nodes WHERE deleted_at IS NULL ORDER BY path').all();

  assert.deepEqual(nodes.map((node) => node.path), ['/', '/about', '/contact', '/events', '/join', '/members', '/news', '/team']);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM page_nodes WHERE path = '/membership' AND deleted_at IS NULL").get().count, 0);

  const members = nodes.find((node) => node.path === '/members');
  assert.equal(members.id, 'membership-page');
  assert.equal(members.published_version_id, null);
  assert.ok(members.draft_version_id);
  assert.match(
    db.prepare('SELECT content_zh FROM page_blocks WHERE page_version_id = ? ORDER BY sort_order LIMIT 1').get(members.draft_version_id).content_zh,
    /加入協會/
  );

  const expectedBlocks = {
    '/news': ['content.hero', 'news.featured', 'news.category-tabs', 'news.list'],
    '/events': ['content.hero', 'association.events'],
    '/members': ['content.rich-text'],
    '/team': ['content.hero', 'association.board'],
    '/contact': ['content.hero', 'association.contact'],
    '/join': ['content.hero', 'content.membership-plans', 'content.cta'],
  };
  for (const [pagePath, types] of Object.entries(expectedBlocks)) {
    const node = nodes.find((entry) => entry.path === pagePath);
    const blocks = db.prepare('SELECT component_type FROM page_blocks WHERE page_version_id = ? ORDER BY sort_order').all(node.draft_version_id);
    assert.deepEqual(blocks.map((block) => block.component_type), types, pagePath);
  }

  const news = nodes.find((node) => node.path === '/news');
  const newsBlocks = db.prepare('SELECT component_type, settings FROM page_blocks WHERE page_version_id = ? ORDER BY sort_order').all(news.draft_version_id);
  assert.equal(JSON.parse(newsBlocks[0].settings).variant, 'network-news');
  assert.equal(JSON.parse(newsBlocks[1].settings).variant, 'flagship');
  assert.equal(JSON.parse(newsBlocks[2].settings).variant, 'technology');
  assert.equal(JSON.parse(newsBlocks[3].settings).variant, 'editorial');

  const redirect = db.prepare("SELECT to_path, status_code FROM redirects WHERE from_path = '/membership'").get();
  assert.deepEqual(redirect, { to_path: '/members', status_code: 301 });
  assert.ok(first.converted.includes('/membership -> /members'));

  const countsBefore = {
    nodes: db.prepare('SELECT COUNT(*) AS count FROM page_nodes').get().count,
    versions: db.prepare('SELECT COUNT(*) AS count FROM page_versions').get().count,
    blocks: db.prepare('SELECT COUNT(*) AS count FROM page_blocks').get().count,
  };
  const second = ensureSystemPages(db);
  assert.deepEqual(second, { created: [], converted: [], upgraded: [] });
  assert.deepEqual(
    {
      nodes: db.prepare('SELECT COUNT(*) AS count FROM page_nodes').get().count,
      versions: db.prepare('SELECT COUNT(*) AS count FROM page_versions').get().count,
      blocks: db.prepare('SELECT COUNT(*) AS count FROM page_blocks').get().count,
    },
    countsBefore
  );

  db.close();
});

test('upgrades only the exact old default news page into an idempotent draft', () => {
  const db = createDb();
  addOldDefaultNewsPage(db);

  const first = ensureSystemPages(db);
  const node = db.prepare("SELECT * FROM page_nodes WHERE path = '/news'").get();
  assert.deepEqual(first.upgraded, ['/news']);
  assert.equal(node.published_version_id, 'old-news-v1');
  assert.ok(node.draft_version_id);
  const blocks = db.prepare('SELECT component_type FROM page_blocks WHERE page_version_id = ? ORDER BY sort_order').all(node.draft_version_id);
  assert.deepEqual(blocks.map((block) => block.component_type), ['content.hero', 'news.featured', 'news.category-tabs', 'news.list']);

  const counts = {
    versions: db.prepare('SELECT COUNT(*) AS count FROM page_versions').get().count,
    blocks: db.prepare('SELECT COUNT(*) AS count FROM page_blocks').get().count,
  };
  assert.deepEqual(ensureSystemPages(db).upgraded, []);
  assert.deepEqual({
    versions: db.prepare('SELECT COUNT(*) AS count FROM page_versions').get().count,
    blocks: db.prepare('SELECT COUNT(*) AS count FROM page_blocks').get().count,
  }, counts);
  db.close();
});

test('does not upgrade a customized news page', () => {
  const db = createDb();
  addOldDefaultNewsPage(db, { custom: true });
  const report = ensureSystemPages(db);
  const node = db.prepare("SELECT * FROM page_nodes WHERE path = '/news'").get();
  assert.deepEqual(report.upgraded, []);
  assert.equal(node.draft_version_id, null);
  db.close();
});
