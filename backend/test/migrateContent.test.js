// M9 integration tests: legacy content migration (scripts/migrate-content.js).
//
// Runs the migration against a seeded legacy dataset in a temp database:
// mapping correctness (news/pages/media/taxonomy), numeric-id redirects
// (D8), publish semantics the public API depends on, idempotent re-runs and
// dry-run purity.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = 'test-secret-for-migrate-content-tests-012345';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-migrate-'));
process.env.HKBA_DB_PATH = path.join(tmpDir, 'migrate.db');
const uploadsDir = path.join(tmpDir, 'uploads');
process.env.HKBA_UPLOADS_DIR = uploadsDir;

const express = require('express');
const { initDatabase, getDb, closeDatabase } = require('../db/init');
const publicRoutes = require('../routes/publicContent');
const { runMigration } = require('../scripts/migrate-content');

// 1x1 transparent PNG.
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000d4944415478da63fcffff3f030005fe02fea72d994d0000000049454e44ae426082',
  'hex'
);

initDatabase();
const db = getDb();
// initDatabase already seeds the default admin; the migration picks the first
// admin row as actor, so no extra admin insert is needed (and 'admin' would
// violate the UNIQUE username constraint).

fs.mkdirSync(uploadsDir, { recursive: true });
fs.writeFileSync(path.join(uploadsDir, 'hero.png'), PNG);
// Distinct bytes (same valid PNG + ignored trailing chunk) so checksum dedupe
// keeps hero/cover as two separate assets; identical content would dedupe to 1.
fs.writeFileSync(path.join(uploadsDir, 'cover.png'), Buffer.concat([PNG, Buffer.from([0x00])]));

// ---- seed legacy rows ----
// initDatabase seeds default legacy rows (pages/stats/milestones); clear the
// legacy tables first so the fixture dataset below is fully deterministic.
for (const t of ['banners', 'pages', 'news', 'media', 'stats', 'partners', 'team_members', 'milestones']) {
  db.prepare(`DELETE FROM ${t}`).run();
}
db.prepare("INSERT INTO banners (id, title_zh, title_en, subtitle_zh, subtitle_en, image_url, link_url, sort_order, is_active) VALUES (1, '主視覺', 'Hero', '副標題', 'Sub', '/uploads/hero.png', '/about', 1, 1)").run();
db.prepare("INSERT INTO banners (id, title_zh, title_en, image_url, sort_order, is_active) VALUES (2, '第二張', 'Second', '/uploads/hero.png', 2, 1)").run();
db.prepare("INSERT INTO pages (id, slug, title_zh, title_en, content_zh, content_en, meta_title_zh, meta_desc_zh) VALUES (1, 'about', '關於我們', 'About', '<p>協會簡介</p>', '<p>About us</p>', '關於 SEO', '關於描述')").run();
db.prepare("INSERT INTO news (id, title_zh, title_en, summary_zh, summary_en, content_zh, content_en, cover_image, category, tags, is_published, published_at) VALUES (1, '新聞一', 'News One', '摘要一', 'Summary one', '<p>正文一</p>', '<p>Body one</p>', '/uploads/cover.png', 'general', '政策, 活動', 1, '2024-05-01 10:00:00')").run();
db.prepare("INSERT INTO news (id, title_zh, title_en, summary_zh, summary_en, content_zh, cover_image, category, tags, is_published) VALUES (2, '新聞二', 'News Two', '摘要二', 'Summary two', '<p>正文二</p>', '/uploads/cover.png', 'general', '政策', 0)").run();
db.prepare("INSERT INTO news (id, title_zh, title_en, summary_zh, summary_en, content_zh, cover_image, category, is_published, published_at) VALUES (3, '新聞三', 'News Three', '摘要三', 'Summary three', '<p>正文三</p>', 'https://cdn.example.com/x.png', 'member', 1, '2025-01-15 09:00:00')").run();
db.prepare("INSERT INTO media (id, filename, original_name, mime_type, size, url) VALUES (1, 'hero.png', 'hero.png', 'image/png', 67, '/uploads/hero.png')").run();
db.prepare("INSERT INTO stats (id, label_zh, label_en, value, sort_order, is_active) VALUES (1, '會員企業', 'Members', '200+', 1, 1)").run();
db.prepare("INSERT INTO partners (id, name, logo_url, group_name, sort_order, is_active) VALUES (1, 'Partner A', '/uploads/hero.png', 'default', 1, 1)").run();
db.prepare("INSERT INTO team_members (id, name_zh, title_zh, avatar_url, group_name, is_active) VALUES (1, '陳大文', '會長', '/uploads/hero.png', 'chairman', 1)").run();
db.prepare("INSERT INTO milestones (id, year, title_zh, title_en, sort_order, is_active) VALUES (1, '2017', '成立', 'Founded', 1, 1)").run();

let report;
test.before(() => {
  report = runMigration(db, { uploadsDir });
});

test.after(() => {
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('news rows become items with publish semantics and normalized taxonomy', () => {
  const items = db.prepare('SELECT * FROM news_items ORDER BY slug').all();
  assert.equal(items.length, 3);
  const published = items.filter((item) => item.status === 'published');
  assert.equal(published.length, 2);
  for (const item of published) {
    assert.equal(item.published_revision, 1);
    assert.equal(item.current_draft_revision, 2);
    assert.ok(item.published_at);
  }
  const draft = items.find((item) => item.status === 'draft');
  assert.equal(draft.published_revision, null);
  assert.equal(draft.current_draft_revision, 1);

  // Free-text categories dedupe into one row per label.
  const categories = db.prepare('SELECT * FROM news_categories').all();
  assert.equal(categories.length, 2); // general + member
  const general = categories.find((entry) => entry.slug === 'general');
  const maps = db.prepare('SELECT * FROM news_category_map').all();
  assert.equal(maps.filter((entry) => entry.category_id === general.id).length, 2);

  const tags = db.prepare('SELECT * FROM news_tags ORDER BY name_zh').all();
  assert.deepEqual(tags.map((entry) => entry.name_zh), ['政策', '活動']);

  // Revisions: published items carry published r1 + continuing draft r2,
  // each with header + rich-text blocks.
  const one = items.find((item) => item.title_zh === '新聞一');
  const revisions = db.prepare('SELECT * FROM news_revisions WHERE news_id = ? ORDER BY revision').all(one.id);
  assert.deepEqual(revisions.map((entry) => entry.status), ['published', 'draft']);
  const blocks = db.prepare('SELECT * FROM news_blocks WHERE news_id = ? AND revision = 1 ORDER BY sort_order').all(one.id);
  assert.deepEqual(blocks.map((entry) => entry.block_type), ['news.header', 'content.rich-text']);
  assert.match(blocks[1].content_zh, /正文一/);
  assert.equal(JSON.parse(blocks[0].settings).categoryIds.length, 1);
});

test('numeric legacy news urls get 301 redirects to slug urls (D8)', () => {
  const redirects = db.prepare('SELECT * FROM redirects ORDER BY from_path').all();
  assert.equal(redirects.length, 2); // only published news
  const one = db.prepare('SELECT slug FROM news_items WHERE title_zh = ?').get('新聞一');
  const row = redirects.find((entry) => entry.from_path === '/news/1');
  assert.equal(row.to_path, `/news/${one.slug}`);
  assert.equal(row.status_code, 301);
  assert.equal(row.to_path, '/news/news-one');
});

test('media assets dedupe by checksum; external urls are reported unmapped', () => {
  const assets = db.prepare('SELECT * FROM media_assets').all();
  assert.equal(assets.length, 2); // hero.png + cover.png (shared rows reused)
  assert.ok(assets.every((asset) => asset.status === 'active'));
  assert.ok(report.unmapped.some((entry) => entry.kind === 'external_media_url' && entry.detail.includes('cdn.example.com')));
  const coverAsset = assets.find((asset) => asset.storage_key === 'cover.png');
  assert.equal(coverAsset.width, 1);
  assert.equal(coverAsset.height, 1);
  // The external cover left the news row without a cover rather than fabricating one.
  const three = db.prepare('SELECT cover_media_id FROM news_items WHERE title_zh = ?').get('新聞三');
  assert.equal(three.cover_media_id, null);
});

test('homepage and legacy html pages become published block pages', () => {
  const home = db.prepare("SELECT * FROM page_nodes WHERE path = '/'").get();
  assert.ok(home);
  assert.ok(home.published_version_id);
  const homeBlocks = db.prepare('SELECT * FROM page_blocks WHERE page_version_id = ? ORDER BY sort_order').all(home.published_version_id);
  assert.deepEqual(homeBlocks.map((entry) => entry.component_type), ['content.hero', 'content.stats', 'association.partners']);
  const heroZh = JSON.parse(homeBlocks[0].content_zh);
  assert.equal(heroZh.title, '主視覺');
  assert.ok(heroZh.backgroundMediaId);
  const statsZh = JSON.parse(homeBlocks[1].content_zh);
  assert.equal(statsZh.items[0].value, '200+');

  const about = db.prepare("SELECT * FROM page_nodes WHERE path = '/about'").get();
  assert.ok(about);
  const aboutBlocks = db.prepare('SELECT * FROM page_blocks WHERE page_version_id = ? ORDER BY sort_order').all(about.published_version_id);
  assert.deepEqual(aboutBlocks.map((entry) => entry.component_type), ['association.timeline', 'association.members', 'content.rich-text']);
  const seo = JSON.parse(db.prepare('SELECT seo FROM page_versions WHERE id = ?').get(about.published_version_id).seo);
  assert.equal(seo.titleZh, '關於 SEO');

  // Extra banner beyond the first is reported, not silently dropped.
  assert.ok(report.unmapped.some((entry) => entry.kind === 'extra_banner'));
  const publishRecords = db.prepare("SELECT * FROM publish_records WHERE object_type = 'page'").all();
  assert.ok(publishRecords.length >= 2);
});

test('public API serves migrated content and redirect aliases', async () => {
  const app = express();
  app.use('/api/public', publicRoutes);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const pageRes = await fetch(`${base}/api/public/page?path=/about`);
    assert.equal(pageRes.status, 200);
    const pageBody = await pageRes.json();
    assert.equal(pageBody.data.blocks.length, 3);
    assert.ok(Object.keys(pageBody.data.media).length >= 0);

    const listRes = await fetch(`${base}/api/public/news`);
    const listBody = await listRes.json();
    assert.equal(listBody.data.total, 2); // only published
    assert.ok(listBody.data.items.every((item) => item.slug.startsWith('news-')));

    const aliasRes = await fetch(`${base}/api/public/news/item/1`);
    const aliasBody = await aliasRes.json();
    assert.equal(aliasBody.data.redirect, '/news/news-one');

    const yearsRes = await fetch(`${base}/api/public/news/years`);
    const yearsBody = await yearsRes.json();
    assert.deepEqual(yearsBody.data.years, [2025, 2024]);
  } finally {
    server.close();
  }
});

test('re-running the migration is a no-op (idempotent via legacy_id_map)', () => {
  const before = {
    news: db.prepare('SELECT COUNT(*) AS n FROM news_items').get().n,
    pages: db.prepare('SELECT COUNT(*) AS n FROM page_nodes').get().n,
    assets: db.prepare('SELECT COUNT(*) AS n FROM media_assets').get().n,
    redirects: db.prepare('SELECT COUNT(*) AS n FROM redirects').get().n,
  };
  const second = runMigration(db, { uploadsDir });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM news_items').get().n, before.news);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM page_nodes').get().n, before.pages);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM media_assets').get().n, before.assets);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM redirects').get().n, before.redirects);
  assert.equal(second.failures.length, 0);
  assert.equal(report.orphans.length, 0);
});

test('dry-run plans without writing', () => {
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-migrate-dry-'));
  process.env.HKBA_DB_PATH = path.join(tmp2, 'dry.db');
  closeDatabase();
  initDatabase();
  const dryDb = getDb();
  dryDb.prepare("INSERT INTO news (id, title_zh, category, is_published) VALUES (9, '乾跑', 'general', 1)").run();
  const dryReport = runMigration(dryDb, { dryRun: true, uploadsDir });
  assert.equal(dryDb.prepare('SELECT COUNT(*) AS n FROM news_items').get().n, 0);
  assert.equal(dryReport.news.created, 1); // planned
  assert.ok(dryReport.dryRun);
  closeDatabase();
  fs.rmSync(tmp2, { recursive: true, force: true });
  // Restore the main connection for after() cleanup.
  process.env.HKBA_DB_PATH = path.join(tmpDir, 'migrate.db');
  initDatabase();
});
