const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

process.env.JWT_SECRET = 'test-secret-for-admin-publish-tests-01234567';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-admin-publish-'));
process.env.HKBA_DB_PATH = path.join(tmpDir, 'admin-publish.db');
process.env.HKBA_UPLOADS_DIR = path.join(tmpDir, 'uploads');

const bcrypt = require('bcryptjs');
const express = require('express');

const { initDatabase, getDb, closeDatabase } = require('../db/init');
const authRoutes = require('../routes/auth');
const pagesRoutes = require('../routes/admin/pages');
const newsRoutes = require('../routes/admin/news');
const taxonomy = require('../routes/admin/newsTaxonomy');
const mediaRoutes = require('../routes/admin/media');
const previewRoutes = require('../routes/preview');
const { queryPublishedNews, listPublishedYears } = require('../lib/newsQuery');
const { prunePageVersions } = require('../lib/publish');

initDatabase();
const db = getDb();
for (const [name, role] of [['editor1', 'editor'], ['publisher1', 'publisher']]) {
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run(name, bcrypt.hashSync(`${name}-pass`, 4));
  const id = db.prepare('SELECT id FROM admins WHERE username = ?').get(name).id;
  db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, role);
}

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin/pages', pagesRoutes);
app.use('/api/admin/news', newsRoutes);
app.use('/api/admin/news-categories', taxonomy.categories);
app.use('/api/admin/media', mediaRoutes);
app.use('/api/preview', previewRoutes);

let server;
let base;
let adminCookie;
let editorCookie;
let publisherCookie;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
  adminCookie = (await login('admin', 'hkba2024')).cookie;
  editorCookie = (await login('editor1', 'editor1-pass')).cookie;
  publisherCookie = (await login('publisher1', 'publisher1-pass')).cookie;
});

test.after(() => {
  server?.close();
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const CSRF = { 'x-requested-with': 'XMLHttpRequest' };

async function login(username, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const setCookie = res.headers.getSetCookie().find((line) => line.startsWith('hkba_admin='));
  return { cookie: setCookie.split(';')[0] };
}

function call(method, path, { body, cookie = adminCookie } = {}) {
  const headers = { cookie, ...CSRF };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const get = (path, opts) => call('GET', path, opts);
const post = (path, body, opts) => call('POST', path, { ...opts, body });
const patch = (path, body, opts) => call('PATCH', path, { ...opts, body });

let seq = 0;
async function createPage(slug) {
  const res = await post('/api/admin/pages', { slug, titleZh: '測試頁', titleEn: 'Test Page' });
  return (await res.json()).data.node;
}

async function uploadMedia() {
  const png = Buffer.alloc(33);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(0x0d0a1a0a, 4);
  png.writeUInt32BE(13, 8);
  png.write('IHDR', 12, 'ascii');
  png.writeUInt32BE(8, 16);
  png.writeUInt32BE(8, 20);
  const form = new FormData();
  seq += 1;
  form.append('file', new Blob([png]), `share-${seq}.png`);
  const res = await fetch(`${base}/api/admin/media/uploads`, {
    method: 'POST',
    headers: { cookie: adminCookie, ...CSRF },
    body: form,
  });
  return (await res.json()).data.asset;
}

const SEO = (shareMediaId) => ({ titleZh: '標題', descriptionZh: '描述', shareMediaId });

// ---------- preview ----------

test('page preview token serves pinned draft with noindex headers; stale after edit', async () => {
  const page = await createPage(`prev-${Date.now()}`);
  const draft = (await (await get(`/api/admin/pages/${page.id}/draft`)).json()).data;
  await post(`/api/admin/pages/${page.id}/draft/blocks`, {
    expectedRevision: draft.version.revision,
    block: { componentType: 'content.rich-text', contentZh: { html: '<p>中</p>' }, contentEn: { html: '<p>en</p>' } },
  });

  const preview = await post(`/api/admin/pages/${page.id}/preview`, {});
  assert.equal(preview.status, 201);
  const { token, revision } = (await preview.json()).data;
  assert.equal(revision, 2);

  const served = await fetch(`${base}/api/preview/${token}`);
  assert.equal(served.status, 200);
  assert.match(served.headers.get('x-robots-tag'), /noindex/);
  assert.match(served.headers.get('cache-control'), /no-store/);
  const servedBody = await served.json();
  assert.equal(servedBody.data.objectType, 'page');
  assert.equal(servedBody.data.blocks.length, 1);

  const missing = await fetch(`${base}/api/preview/hkba_prev_nope`);
  assert.equal(missing.status, 404);

  // A further draft edit makes the pinned preview stale.
  await post(`/api/admin/pages/${page.id}/draft/blocks`, {
    expectedRevision: 2,
    block: { componentType: 'content.rich-text', contentZh: { html: '<p>新</p>' } },
  });
  const stale = await fetch(`${base}/api/preview/${token}`);
  assert.equal(stale.status, 410);
});

// ---------- page publish / withdraw / rollback ----------

test('page publish enforces checks, then swaps published version atomically', async () => {
  const page = await createPage(`pub-${Date.now()}`);
  const draft = (await (await get(`/api/admin/pages/${page.id}/draft`)).json()).data;

  // Block without English + missing SEO -> 422 with structured problems.
  await post(`/api/admin/pages/${page.id}/draft/blocks`, {
    expectedRevision: draft.version.revision,
    block: { componentType: 'content.rich-text', contentZh: { html: '<p>中</p>' } },
  });
  const refused = await post(`/api/admin/pages/${page.id}/publish`, { expectedRevision: 2 });
  assert.equal(refused.status, 422);
  const refusedBody = await refused.json();
  assert.equal(refusedBody.error.code, 'PUBLISH_CHECK_FAILED');
  assert.ok(refusedBody.error.fields.some((p) => p.code === 'required' && p.lang === 'en'));
  assert.ok(refusedBody.error.fields.some((p) => p.code === 'seo_incomplete'));

  // Editor role may not publish at all.
  const asEditor = await post(`/api/admin/pages/${page.id}/publish`, { expectedRevision: 2 }, { cookie: editorCookie });
  assert.equal(asEditor.status, 403);

  // Fix the English content and SEO, then publish.
  const blocksNow = (await (await get(`/api/admin/pages/${page.id}/draft`)).json()).data.blocks;
  await patch(`/api/admin/pages/${page.id}/draft/blocks/${blocksNow[0].id}`, {
    expectedRevision: 2,
    patch: { contentEn: { html: '<p>en</p>' } },
  });
  const media = await uploadMedia();
  await patch(`/api/admin/pages/${page.id}/draft`, { expectedRevision: 3, seo: SEO(media.id) });
  const published = await post(`/api/admin/pages/${page.id}/publish`, { expectedRevision: 4 });
  assert.equal(published.status, 200, JSON.stringify(await published.clone().json()));
  const publishedBody = await published.json();
  assert.equal(publishedBody.data.published, true);

  const node = db.prepare('SELECT * FROM page_nodes WHERE id = ?').get(page.id);
  assert.ok(node.published_version_id);
  assert.equal(node.draft_version_id, null);
  const record = db
    .prepare("SELECT * FROM publish_records WHERE object_type = 'page' AND object_id = ? AND action = 'publish'")
    .get(page.id);
  assert.ok(record, 'publish journal row written');
  const audit = db.prepare("SELECT * FROM audit_events WHERE action = 'page.publish' AND object_id = ?").get(page.id);
  assert.ok(audit, 'publish audited');

  // Publisher role (publish permission) may publish too. The draft continues
  // at max(revision)+1 after every publish (§11 修訂號繼續遞增).
  const draftAgain = (await (await get(`/api/admin/pages/${page.id}/draft`)).json()).data;
  assert.equal(draftAgain.created, true, 'next draft is copied from the published version');
  assert.equal(draftAgain.version.revision, 5);
  const asPublisher = await post(`/api/admin/pages/${page.id}/publish`, { expectedRevision: 5 }, { cookie: publisherCookie });
  assert.equal(asPublisher.status, 200);

  // Stale expectedRevision -> 409.
  const nextDraft = (await (await get(`/api/admin/pages/${page.id}/draft`)).json()).data;
  const stale = await post(`/api/admin/pages/${page.id}/publish`, { expectedRevision: 1 });
  assert.equal(stale.status, 409);
  assert.ok(nextDraft.version.revision >= 5);
});

test('unresolved internal links block publish until a redirect exists', async () => {
  const page = await createPage(`link-${Date.now()}`);
  const draft = (await (await get(`/api/admin/pages/${page.id}/draft`)).json()).data;
  await post(`/api/admin/pages/${page.id}/draft/blocks`, {
    expectedRevision: draft.version.revision,
    block: {
      componentType: 'content.cta',
      contentZh: { title: '行動', button: { label: '去', url: '/old-path' } },
      contentEn: { title: 'Go', button: { label: 'Go', url: '/old-path' } },
    },
  });
  const media = await uploadMedia();
  await patch(`/api/admin/pages/${page.id}/draft`, { expectedRevision: 2, seo: SEO(media.id) });

  const refused = await post(`/api/admin/pages/${page.id}/publish`, { expectedRevision: 3 });
  assert.equal(refused.status, 422);
  assert.ok((await refused.json()).error.fields.some((p) => p.code === 'link_unresolved'));

  db.prepare("INSERT INTO redirects (id, from_path, to_path) VALUES (?, '/old-path', '/new-path')").run(crypto.randomUUID());
  const accepted = await post(`/api/admin/pages/${page.id}/publish`, { expectedRevision: 3 });
  assert.equal(accepted.status, 200);
});

test('withdraw takes the page offline; rollback copies a historical version into a new draft', async () => {
  const page = await createPage(`roll-${Date.now()}`);
  const draft = (await (await get(`/api/admin/pages/${page.id}/draft`)).json()).data;
  await post(`/api/admin/pages/${page.id}/draft/blocks`, {
    expectedRevision: draft.version.revision,
    block: { componentType: 'content.rich-text', contentZh: { html: '<p>第一版</p>' }, contentEn: { html: '<p>v1</p>' } },
  });
  const media = await uploadMedia();
  await patch(`/api/admin/pages/${page.id}/draft`, { expectedRevision: 2, seo: SEO(media.id) });
  await post(`/api/admin/pages/${page.id}/publish`, { expectedRevision: 3 });

  // Second version with different content (draft continues at rev 4).
  const draft2 = (await (await get(`/api/admin/pages/${page.id}/draft`)).json()).data;
  assert.equal(draft2.version.revision, 4);
  const block2 = draft2.blocks[0];
  await patch(`/api/admin/pages/${page.id}/draft/blocks/${block2.id}`, {
    expectedRevision: 4,
    patch: { contentZh: { html: '<p>第二版</p>' }, contentEn: { html: '<p>v2</p>' } },
  });
  await post(`/api/admin/pages/${page.id}/publish`, { expectedRevision: 5 });

  const withdrawn = await post(`/api/admin/pages/${page.id}/withdraw`, {});
  assert.equal(withdrawn.status, 200);
  assert.equal(db.prepare('SELECT published_version_id FROM page_nodes WHERE id = ?').get(page.id).published_version_id, null);
  assert.ok(db.prepare("SELECT 1 FROM publish_records WHERE object_id = ? AND action = 'withdraw'").get(page.id));

  // Rollback to revision 3 (v1 content) -> new draft at max+1.
  const rolled = await post(`/api/admin/pages/${page.id}/rollback`, { revision: 3 });
  assert.equal(rolled.status, 200);
  const rolledBody = await rolled.json();
  assert.equal(rolledBody.data.rolledBackFrom, 3);
  assert.equal(rolledBody.data.draft.revision, 6);
  assert.ok(db.prepare("SELECT 1 FROM publish_records WHERE object_id = ? AND action = 'rollback'").get(page.id));

  const draftNow = (await (await get(`/api/admin/pages/${page.id}/draft`)).json()).data;
  assert.equal(draftNow.blocks[0].contentZh.html, '<p>第一版</p>');

  const missing = await post(`/api/admin/pages/${page.id}/rollback`, { revision: 99 });
  assert.equal(missing.status, 404);
});

// ---------- news publish ----------

test('news publish requires category and bilingual completeness, then continues the draft', async () => {
  const created = await post('/api/admin/news', { slug: `np-${Date.now()}`, titleZh: '發佈測試' });
  const news = (await created.json()).data.news;

  const noCategory = await post(`/api/admin/news/${news.id}/publish`, { expectedRevision: 1 });
  assert.equal(noCategory.status, 422);
  const problems = (await noCategory.json()).error.fields;
  assert.ok(problems.some((p) => p.field === 'categoryIds'));
  assert.ok(problems.some((p) => p.field === 'titleEn'));

  const cat = await post('/api/admin/news-categories', { slug: `c-${Date.now()}`, nameZh: '欄目' });
  const catId = (await cat.json()).data.item.id;
  await patch(`/api/admin/news/${news.id}`, {
    expectedRevision: 1,
    titleEn: 'Publish Test',
    summaryZh: '摘要',
    summaryEn: 'Summary',
    categoryIds: [catId],
    blocks: [
      {
        blockType: 'news.header',
        contentZh: { title: '發佈測試', summary: '摘要' },
        contentEn: { title: 'Publish Test', summary: 'Summary' },
      },
      { blockType: 'content.rich-text', contentZh: { html: '<p>正文</p>' }, contentEn: { html: '<p>Body</p>' } },
    ],
  });
  const published = await post(`/api/admin/news/${news.id}/publish`, { expectedRevision: 2 });
  assert.equal(published.status, 200, JSON.stringify(await published.clone().json()));
  const publishedBody = await published.json();
  assert.equal(publishedBody.data.revision, 2);
  assert.equal(publishedBody.data.draftRevision, 3);

  const row = db.prepare('SELECT * FROM news_items WHERE id = ?').get(news.id);
  assert.equal(row.status, 'published');
  assert.equal(row.published_revision, 2);
  assert.equal(row.current_draft_revision, 3);
  assert.ok(row.published_at);
  assert.ok(db.prepare("SELECT 1 FROM news_revisions WHERE news_id = ? AND revision = 3 AND status = 'draft'").get(news.id));
  const draftBlocks = db.prepare('SELECT * FROM news_blocks WHERE news_id = ? AND revision = 3').all(news.id);
  assert.equal(draftBlocks.length, 2, 'draft continues with copied blocks');

  // Public query lib sees it immediately (year from published_at).
  const currentYear = new Date().getUTCFullYear();
  const found = queryPublishedNews(db, { year: currentYear });
  assert.ok(found.items.some((item) => item.slug === row.slug));
  assert.ok(listPublishedYears(db).includes(currentYear));

  // Withdraw hides it again.
  const withdrawn = await post(`/api/admin/news/${news.id}/withdraw`, {});
  assert.equal(withdrawn.status, 200);
  assert.equal(db.prepare('SELECT status FROM news_items WHERE id = ?').get(news.id).status, 'withdrawn');
  assert.ok(!queryPublishedNews(db, {}).items.some((item) => item.slug === row.slug));
  assert.ok(db.prepare("SELECT 1 FROM publish_records WHERE object_id = ? AND action = 'withdraw'").get(news.id));
});

test('news preview serves pinned revision content', async () => {
  const created = await post('/api/admin/news', { slug: `nprev-${Date.now()}`, titleZh: '預覽' });
  const news = (await created.json()).data.news;
  const preview = await post(`/api/admin/news/${news.id}/preview`, {});
  assert.equal(preview.status, 201);
  const { token } = (await preview.json()).data;
  const served = await fetch(`${base}/api/preview/${token}`);
  assert.equal(served.status, 200);
  const body = await served.json();
  assert.equal(body.data.objectType, 'news');
  assert.equal(body.data.blocks[0].block_type, 'news.header');
});

// ---------- retention at publish ----------

test('publish prunes superseded versions beyond the newest 20 (spec §12)', () => {
  const conn = db;
  const pageId = crypto.randomUUID();
  conn.prepare("INSERT INTO page_nodes (id, node_type, slug, path, title_zh) VALUES (?, 'page', ?, ?, '保留')").run(pageId, `ret-${Date.now()}`, `/ret-${Date.now()}`);
  for (let revision = 1; revision <= 25; revision += 1) {
    const versionId = crypto.randomUUID();
    conn
      .prepare("INSERT INTO page_versions (id, page_id, revision, status, published_at) VALUES (?, ?, ?, 'superseded', ?)")
      .run(versionId, pageId, revision, `2026-01-01 00:00:${String(revision).padStart(2, '0')}`);
    conn
      .prepare("INSERT INTO page_blocks (id, page_version_id, component_type) VALUES (?, ?, 'content.rich-text')")
      .run(crypto.randomUUID(), versionId);
  }
  const pruned = prunePageVersions(conn, pageId);
  assert.equal(pruned.length, 5);
  const remaining = conn.prepare('SELECT COUNT(*) AS n FROM page_versions WHERE page_id = ?').get(pageId).n;
  assert.equal(remaining, 20);
  const blocks = conn.prepare('SELECT COUNT(*) AS n FROM page_blocks WHERE page_version_id IN (SELECT id FROM page_versions WHERE page_id = ?)').get(pageId).n;
  assert.ok(blocks > 0);
  const orphanBlocks = conn
    .prepare('SELECT COUNT(*) AS n FROM page_blocks WHERE page_version_id NOT IN (SELECT id FROM page_versions)')
    .get().n;
  assert.equal(orphanBlocks, 0, 'pruned versions take their blocks along');
});
