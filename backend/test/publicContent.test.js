// M8 integration tests: public content API (routes/publicContent.js).
//
// Covers the frontend-switch surface: published page rendering payload,
// published news list/years/categories/slug detail, slug-alias redirects,
// the redirects table feed and sitemap data. Unpublished content must 404
// so the frontend can fall back to the legacy data sources.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = 'test-secret-for-public-content-tests-0123456';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-public-content-'));
process.env.HKBA_DB_PATH = path.join(tmpDir, 'public-content.db');
process.env.HKBA_UPLOADS_DIR = path.join(tmpDir, 'uploads');

const bcrypt = require('bcryptjs');
const express = require('express');

const { initDatabase, getDb, closeDatabase } = require('../db/init');
const authRoutes = require('../routes/auth');
const pagesRoutes = require('../routes/admin/pages');
const newsRoutes = require('../routes/admin/news');
const taxonomy = require('../routes/admin/newsTaxonomy');
const publicRoutes = require('../routes/publicContent');

initDatabase();
const db = getDb();
for (const [name, role] of [['editor1', 'editor'], ['publisher1', 'publisher']]) {
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run(name, bcrypt.hashSync(`${name}-pass`, 4));
  const id = db.prepare('SELECT id FROM admins WHERE username = ?').get(name).id;
  db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, role);
}
const publisherId = db.prepare('SELECT id FROM admins WHERE username = ?').get('publisher1').id;

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin/pages', pagesRoutes);
app.use('/api/admin/news', newsRoutes);
app.use('/api/admin/news-categories', taxonomy.categories);
app.use('/api/public', publicRoutes);

let server;
let base;
let editorCookie;
let publisherCookie;
const CSRF = { 'x-requested-with': 'XMLHttpRequest' };

async function login(username, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...CSRF },
    body: JSON.stringify({ username, password }),
  });
  return res.headers.get('set-cookie').split(';')[0];
}

test.before(async () => {
  await new Promise((resolve) => server = app.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  editorCookie = await login('editor1', 'editor1-pass');
  publisherCookie = await login('publisher1', 'publisher1-pass');
});

test.after(() => {
  server?.close();
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function api(method, url, body, as = 'editor') {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: as === 'publisher' ? publisherCookie : editorCookie, ...CSRF },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function publicGet(url) {
  const res = await fetch(`${base}/api/public${url}`);
  return { status: res.status, body: await res.json(), cacheControl: res.headers.get('cache-control') };
}

// Seed one active media asset directly (upload pipeline covered elsewhere).
function seedMedia(id = 'media-1') {
  db.prepare(
    `INSERT OR IGNORE INTO media_assets (id, storage_key, original_filename, mime_type, size_bytes, checksum, status, uploaded_by)
     VALUES (?, ?, ?, 'image/png', 10, ?, 'active', ?)`
  ).run(id, `${id}.png`, `${id}.png`, `checksum-${id}`, publisherId);
  return id;
}

async function createPublishedPage() {
  const mediaId = seedMedia();
  const created = await api('POST', '/api/admin/pages', { slug: 'm8-test', titleZh: 'M8 測試頁', titleEn: 'M8 Test' });
  assert.equal(created.status, 201);
  const pageId = created.body.data.node.id;

  let draft = await api('GET', `/api/admin/pages/${pageId}/draft`);
  let revision = draft.body.data.version.revision;

  const added = await api('POST', `/api/admin/pages/${pageId}/draft/blocks`, {
    expectedRevision: revision,
    mutationId: 'm8-add-hero',
    block: {
      componentType: 'content.hero',
      contentZh: { title: '中文標題', subtitle: '副標題', backgroundMediaId: mediaId },
      contentEn: { title: 'English title', subtitle: 'Subtitle' },
    },
  });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  revision = added.body.data.revision;

  const seoSaved = await api('PATCH', `/api/admin/pages/${pageId}/draft`, {
    expectedRevision: revision,
    mutationId: 'm8-seo',
    seo: { titleZh: 'SEO 標題', descriptionZh: 'SEO 描述', shareMediaId: mediaId },
  });
  assert.equal(seoSaved.status, 200);
  revision = seoSaved.body.data.revision;

  const published = await api('POST', `/api/admin/pages/${pageId}/publish`, { expectedRevision: revision }, 'publisher');
  assert.equal(published.status, 200, JSON.stringify(published.body));
  return { pageId, mediaId };
}

async function createPublishedNews() {
  const mediaId = seedMedia('media-cover');
  const category = await api('POST', '/api/admin/news-categories', { slug: 'm8-cat', nameZh: 'M8 欄目' });
  assert.equal(category.status, 201);
  const categoryId = category.body.data.item.id;

  const created = await api('POST', '/api/admin/news', {
    slug: 'm8-news-slug',
    titleZh: 'M8 新聞',
    titleEn: 'M8 News',
    summaryZh: '中文摘要',
    summaryEn: 'English summary',
    coverMediaId: mediaId,
    displayYear: 2026,
    categoryIds: [categoryId],
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const newsId = created.body.data.news.id;

  const detail = await api('GET', `/api/admin/news/${newsId}`);
  const published = await api('POST', `/api/admin/news/${newsId}/publish`, { expectedRevision: detail.body.data.draft.revision }, 'publisher');
  assert.equal(published.status, 200, JSON.stringify(published.body));
  return { newsId, categoryId, mediaId };
}

test('public page endpoint serves the published block tree with media map', async () => {
  const { mediaId } = await createPublishedPage();
  const res = await publicGet('/page?path=/m8-test');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.cacheControl, 'no-store');
  const data = res.body.data;
  assert.equal(data.titleZh, 'M8 測試頁');
  assert.equal(data.seo.titleZh, 'SEO 標題');
  assert.equal(data.blocks.length, 1);
  assert.equal(data.blocks[0].component_type, 'content.hero');
  assert.equal(data.blocks[0].contentEn.title, 'English title');
  assert.equal(data.media[mediaId].url, `/uploads/${mediaId}.png`);
});

test('public page endpoint 404s for unpublished or unknown paths', async () => {
  const created = await api('POST', '/api/admin/pages', { slug: 'm8-draft-only', titleZh: '未發佈' });
  assert.equal(created.status, 201);
  const unpublished = await publicGet('/page?path=/m8-draft-only');
  assert.equal(unpublished.status, 404);
  assert.equal(unpublished.body.error.code, 'NOT_PUBLISHED');
  const missing = await publicGet('/page?path=/no-such-page');
  assert.equal(missing.status, 404);
});

test('public news list filters by year and category; years and categories endpoints agree', async () => {
  const { categoryId } = await createPublishedNews();

  const all = await publicGet('/news');
  assert.equal(all.status, 200);
  assert.ok(all.body.data.items.some((item) => item.slug === 'm8-news-slug'));
  const row = all.body.data.items.find((item) => item.slug === 'm8-news-slug');
  assert.equal(row.year, 2026);
  assert.equal(row.cover.url, '/uploads/media-cover.png');
  assert.deepEqual(row.categories.map((entry) => entry.slug), ['m8-cat']);

  const byYear = await publicGet('/news?year=2026');
  assert.ok(byYear.body.data.items.some((item) => item.slug === 'm8-news-slug'));
  const wrongYear = await publicGet('/news?year=1999');
  assert.ok(!wrongYear.body.data.items.some((item) => item.slug === 'm8-news-slug'));

  const byCategory = await publicGet(`/news?categoryId=${categoryId}`);
  assert.ok(byCategory.body.data.items.some((item) => item.slug === 'm8-news-slug'));

  const years = await publicGet('/news/years');
  assert.ok(years.body.data.years.includes(2026));

  const categories = await publicGet('/news/categories');
  const cat = categories.body.data.items.find((entry) => entry.slug === 'm8-cat');
  assert.ok(cat);
  assert.ok(cat.publishedCount >= 1);
});

test('public pinned-news lookup preserves request order and excludes unpublished rows', async () => {
  const published = db.prepare("SELECT id FROM news_items WHERE slug = 'm8-news-slug'").get();
  db.prepare(
    `INSERT INTO news_items
      (id, slug, title_zh, title_en, summary_zh, summary_en, status)
     VALUES ('draft-pin', 'draft-pin', '草稿', 'Draft', '草稿摘要', 'Draft summary', 'draft')`
  ).run();

  const res = await publicGet(`/news/by-ids?ids=draft-pin,${published.id},${published.id}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.items.map((item) => item.id), [published.id]);
});

test('public news detail returns blocks with component_type and media map', async () => {
  const res = await publicGet('/news/item/m8-news-slug');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { item, blocks, media } = res.body.data;
  assert.equal(item.titleZh, 'M8 新聞');
  assert.equal(item.cover.url, '/uploads/media-cover.png');
  assert.ok(Array.isArray(blocks));
  assert.equal(blocks[0].component_type, 'news.header');
  assert.ok(blocks[0].contentZh.title);
  assert.ok(media['media-cover']);
  // Header fallback: the item cover fills an empty header coverMediaId.
  assert.equal(blocks[0].contentZh.coverMediaId, 'media-cover');
});

test('unpublished news slug 404s; redirect aliases answer with a redirect payload', async () => {
  const missing = await publicGet('/news/item/no-such-slug');
  assert.equal(missing.status, 404);

  db.prepare('INSERT INTO redirects (id, from_path, to_path, status_code) VALUES (?, ?, ?, 301)').run(
    'redir-1',
    '/news/123',
    '/news/m8-news-slug'
  );
  const alias = await publicGet('/news/item/123');
  assert.equal(alias.status, 200);
  assert.equal(alias.body.data.redirect, '/news/m8-news-slug');

  const redirects = await publicGet('/redirects');
  assert.equal(redirects.status, 200);
  assert.ok(redirects.body.data.items.some((entry) => entry.from === '/news/123' && entry.to === '/news/m8-news-slug' && entry.statusCode === 301));
});

test('sitemap-data lists published pages and news only', async () => {
  const res = await publicGet('/sitemap-data');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.pages.some((entry) => entry.path === '/m8-test'));
  assert.ok(!res.body.data.pages.some((entry) => entry.path === '/m8-draft-only'));
  assert.ok(res.body.data.news.some((entry) => entry.slug === 'm8-news-slug'));
});

test('association endpoint serves structured partners, people, milestones, events and contact', async () => {
  // Seed one of each (init defaults already insert milestones/contact rows).
  db.prepare("INSERT INTO partners (name, logo_url, website_url, group_name, sort_order, is_active) VALUES ('Assoc Partner', '/uploads/p.png', 'https://example.com', 'default', 99, 1)").run();
  db.prepare("INSERT INTO partners (name, logo_url, group_name, sort_order, is_active) VALUES ('Inactive Partner', '/uploads/x.png', 'default', 100, 0)").run();
  db.prepare("INSERT INTO team_members (name_zh, name_en, title_zh, avatar_url, group_name, sort_order, is_active) VALUES ('測試人', 'Test Person', '會長', '/uploads/a.png', 'chairman', 99, 1)").run();
  db.prepare("INSERT INTO events (title_zh, title_en, description_zh, event_date, location_zh, registration_url, is_published) VALUES ('公開活動', 'Public Event', '活動摘要', '2026-09-12', '香港', 'https://example.com/register', 1)").run();
  db.prepare("INSERT INTO events (title_zh, event_date, is_published) VALUES ('未公開活動', '2026-10-01', 0)").run();

  const res = await publicGet('/association');
  assert.equal(res.status, 200);
  const { partners, people, groups, milestones, events, contact, resources } = res.body.data;

  const partner = partners.find((entry) => entry.name === 'Assoc Partner');
  assert.ok(partner);
  assert.equal(partner.logoUrl, '/uploads/p.png');
  assert.equal(partner.websiteUrl, 'https://example.com');
  assert.equal(partner.group, 'default');
  assert.ok(!partners.some((entry) => entry.name === 'Inactive Partner'), 'inactive rows filtered');

  const person = people.find((entry) => entry.nameEn === 'Test Person');
  assert.ok(person);
  assert.equal(person.nameZh, '測試人');
  assert.equal(person.titleZh, '會長');
  assert.equal(person.avatarUrl, '/uploads/a.png');
  assert.equal(person.group, 'chairman');
  assert.equal(person.sortOrder, 99);

  assert.deepEqual(groups.slice(0, 5).map((entry) => entry.code), ['honorary_chairman', 'chairman', 'vice_chairman', 'committee', 'advisor']);
  assert.deepEqual(groups.find((entry) => entry.code === 'chairman'), {
    code: 'chairman', labelZh: '會長', labelEn: 'Chairman', sortOrder: 20, memberCount: 1,
  });

  assert.ok(milestones.length >= 1);
  assert.ok(milestones.every((entry) => entry.year && entry.titleZh !== undefined));
  assert.ok(events.some((entry) => entry.titleEn === 'Public Event' && entry.locationZh === '香港'));
  assert.ok(!events.some((entry) => entry.titleZh === '未公開活動'));
  assert.equal(contact.email, 'info@hkba.club');
  assert.ok(Array.isArray(resources));
});
