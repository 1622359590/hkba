// Visual-strike tests: scripts/wire-media.js — homepage hero media wiring and
// association block headings, idempotent and editor-content-preserving.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = 'test-secret-for-wire-media-tests-0123456789';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-wire-media-'));
process.env.HKBA_DB_PATH = path.join(tmpDir, 'wire.db');
process.env.HKBA_UPLOADS_DIR = path.join(tmpDir, 'uploads');

const { initDatabase, getDb, closeDatabase } = require('../db/init');
const { runWiring } = require('../scripts/wire-media');

initDatabase();
const db = getDb();

test.after(() => {
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('hero is wired to banners[0] asset; titles filled once; editor titles preserved', () => {
  // Fixture: active asset, banner pointing at it, home node with published +
  // draft versions each carrying a hero and a partners block.
  db.prepare(
    "INSERT INTO media_assets (id, storage_key, mime_type, size_bytes, status) VALUES ('asset-1', 'media/asset-1.png', 'image/png', 10, 'active')"
  ).run();
  db.prepare("INSERT INTO banners (id, title_zh, image_url, sort_order, is_active) VALUES (1, '橫幅', '/uploads/media/asset-1.png', 1, 1)").run();

  const homeId = 'home-node';
  db.prepare("INSERT INTO page_nodes (id, parent_id, node_type, slug, path, title_zh, published_version_id, draft_version_id) VALUES (?, NULL, 'page', '', '/', '首頁', 'v-pub', 'v-draft')").run(homeId);
  let revision = 0;
  for (const vid of ['v-pub', 'v-draft']) {
    revision += 1;
    db.prepare("INSERT INTO page_versions (id, page_id, revision, status, seo) VALUES (?, ?, ?, 'published', '{}')").run(vid, homeId, revision);
    db.prepare("INSERT INTO page_blocks (id, page_version_id, component_type, sort_order, content_zh, content_en, settings) VALUES (?, ?, 'content.hero', 1, '{\"title\":\"T\"}', '{}', '{}')").run(`${vid}-hero`, vid);
    db.prepare("INSERT INTO page_blocks (id, page_version_id, component_type, sort_order, content_zh, content_en, settings) VALUES (?, ?, 'association.partners', 2, '{}', '{}', '{}')").run(`${vid}-partners`, vid);
  }

  const report = runWiring(db);
  assert.equal(report.hero.length, 2);
  assert.ok(report.titles.some((entry) => entry.component === 'association.partners'));

  const hero = db.prepare("SELECT content_zh FROM page_blocks WHERE id = 'v-pub-hero'").get();
  assert.equal(JSON.parse(hero.content_zh).backgroundMediaId, 'asset-1');
  const partners = db.prepare("SELECT content_zh FROM page_blocks WHERE id = 'v-pub-partners'").get();
  assert.equal(JSON.parse(partners.content_zh).title, '合作夥伴');
  assert.ok(db.prepare("SELECT * FROM media_references WHERE ref_type = 'page_block' AND media_id = 'asset-1'").all().length >= 1);

  // Re-run: same values, no duplicate references, editor-set title untouched.
  db.prepare("UPDATE page_blocks SET content_zh = '{\"title\":\"編輯器標題\"}' WHERE id = 'v-draft-partners'").run();
  const second = runWiring(db);
  assert.equal(second.hero.length, 2);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM media_references WHERE ref_type = 'page_block' AND media_id = 'asset-1'").get().n,
    2
  );
  assert.equal(JSON.parse(db.prepare("SELECT content_zh FROM page_blocks WHERE id = 'v-draft-partners'").get().content_zh).title, '編輯器標題');
});
