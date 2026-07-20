const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = 'test-secret-for-admin-news-tests-0123456789';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-admin-news-'));
process.env.HKBA_DB_PATH = path.join(tmpDir, 'admin-news.db');
process.env.HKBA_UPLOADS_DIR = path.join(tmpDir, 'uploads');

const express = require('express');

const { initDatabase, getDb, closeDatabase } = require('../db/init');
const authRoutes = require('../routes/auth');
const newsRoutes = require('../routes/admin/news');
const taxonomy = require('../routes/admin/newsTaxonomy');
const mediaRoutes = require('../routes/admin/media');
const { queryPublishedNews, listPublishedYears } = require('../lib/newsQuery');

initDatabase();
const db = getDb();

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin/news', newsRoutes);
app.use('/api/admin/news-categories', taxonomy.categories);
app.use('/api/admin/news-tags', taxonomy.tags);
app.use('/api/admin/media', mediaRoutes);

let server;
let base;
let adminCookie;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
  adminCookie = (await login('admin', 'hkba2024')).cookie;
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
const del = (path, opts) => call('DELETE', path, opts);

let seq = 0;
async function createNews(payload = {}) {
  seq += 1;
  const res = await post('/api/admin/news', {
    slug: `news-${Date.now()}-${seq}`,
    titleZh: `測試新聞 ${seq}`,
    ...payload,
  });
  const body = await res.json();
  return { res, body };
}

// ---------- taxonomy ----------

test('categories and tags CRUD with reference protection', async () => {
  const cat = await post('/api/admin/news-categories', { slug: 'events', nameZh: '活動' });
  assert.equal(cat.status, 201);
  const catId = (await cat.json()).data.item.id;

  const dup = await post('/api/admin/news-categories', { slug: 'events', nameZh: '重複' });
  assert.equal(dup.status, 400);

  const child = await post('/api/admin/news-categories', { slug: 'events-2026', nameZh: '2026 活動', parentId: catId });
  assert.equal(child.status, 201);
  const childId = (await child.json()).data.item.id;

  const cycle = await patch(`/api/admin/news-categories/${catId}`, { parentId: childId });
  assert.equal(cycle.status, 400);
  assert.equal((await cycle.json()).error.fields[0].code, 'cycle');

  const tag = await post('/api/admin/news-tags', { slug: 'announcement', nameZh: '公告' });
  assert.equal(tag.status, 201);
  const tagId = (await tag.json()).data.item.id;

  const news = await createNews({ categoryIds: [catId], tagIds: [tagId] });
  assert.equal(news.res.status, 201);

  const blockedCat = await del(`/api/admin/news-categories/${catId}`);
  assert.equal(blockedCat.status, 409);
  assert.equal((await blockedCat.json()).error.code, 'REFERENCE_EXISTS');
  const blockedTag = await del(`/api/admin/news-tags/${tagId}`);
  assert.equal(blockedTag.status, 409);

  // Unknown taxonomy ids are rejected on the news side.
  const badRef = await createNews({ categoryIds: ['no-such-category'] });
  assert.equal(badRef.res.status, 400);
  assert.equal(badRef.body.error.fields[0].code, 'not_found');

  const list = await get('/api/admin/news-categories');
  const listBody = await list.json();
  assert.ok(listBody.data.items.find((item) => item.id === catId).news_count >= 1);
});

// ---------- create & read ----------

test('create builds revision 1 with a header block and maps', async () => {
  const { res, body } = await createNews({ titleEn: 'Test News', summaryZh: '摘要' });
  assert.equal(res.status, 201);
  const news = body.data.news;
  assert.equal(news.status, 'draft');
  assert.equal(news.current_draft_revision, 1);

  const detail = await (await get(`/api/admin/news/${news.id}`)).json();
  assert.equal(detail.data.draft.revision, 1);
  assert.equal(detail.data.blocks.length, 1);
  assert.equal(detail.data.blocks[0].block_type, 'news.header');
  assert.equal(detail.data.blocks[0].contentZh.title, news.title_zh);
  assert.equal(detail.data.news.missing_en, true);

  const bad = await createNews({ slug: 'Bad Slug!' });
  assert.equal(bad.res.status, 400);
  const dupe = await createNews({ slug: news.slug });
  assert.equal(dupe.res.status, 400);
  assert.equal(dupe.body.error.fields[0].code, 'duplicate');
});

// ---------- patch & conflict ----------

test('patch updates metadata and blocks with optimistic lock and idempotent replay', async () => {
  const { body } = await createNews();
  const news = body.data.news;

  const updated = await patch(`/api/admin/news/${news.id}`, {
    expectedRevision: 1,
    titleEn: 'English Title',
    displayYear: 2025,
    blocks: [
      { blockType: 'news.header', contentZh: { title: '新標題', summary: '摘要' }, contentEn: { title: 'New Title' } },
      { blockType: 'content.rich-text', contentZh: { html: '<p>正文</p>' } },
    ],
  });
  assert.equal(updated.status, 200);
  const updatedBody = await updated.json();
  assert.equal(updatedBody.data.revision, 2);
  assert.equal(updatedBody.data.news.title_en, 'English Title');
  assert.equal(updatedBody.data.news.display_year, 2025);

  const detail = await (await get(`/api/admin/news/${news.id}`)).json();
  assert.equal(detail.data.blocks.length, 2);
  assert.equal(detail.data.blocks[0].block_type, 'news.header');
  assert.equal(detail.data.blocks[1].block_type, 'content.rich-text');

  // Stale expectedRevision -> 409 with the current revision.
  const stale = await patch(`/api/admin/news/${news.id}`, { expectedRevision: 1, titleZh: '過期寫入' });
  assert.equal(stale.status, 409);
  const staleBody = await stale.json();
  assert.equal(staleBody.error.code, 'REVISION_CONFLICT');
  assert.match(staleBody.error.fields[0].message, /2/);

  // Replay: same mutationId returns the stored response, revision unchanged.
  const first = await patch(`/api/admin/news/${news.id}`, {
    expectedRevision: 2,
    mutationId: 'mut-news-1',
    summaryZh: '第一次',
  });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).data.revision, 3);
  const replay = await patch(`/api/admin/news/${news.id}`, {
    expectedRevision: 2,
    mutationId: 'mut-news-1',
    summaryZh: '第一次',
  });
  const replayBody = await replay.json();
  assert.equal(replayBody.data.replayed, true);
  assert.equal(replayBody.data.revision, 3);
  const afterReplay = await (await get(`/api/admin/news/${news.id}`)).json();
  assert.equal(afterReplay.data.draft.revision, 3);
});

test('block validation enforces header rules and news-only components', async () => {
  const { body } = await createNews();
  const news = body.data.news;

  const noHeader = await patch(`/api/admin/news/${news.id}`, {
    expectedRevision: 1,
    blocks: [{ blockType: 'content.rich-text', contentZh: { html: '<p>x</p>' } }],
  });
  assert.equal(noHeader.status, 400);
  assert.ok((await noHeader.json()).error.fields.some((f) => f.code === 'missing_header'));

  const headerNotFirst = await patch(`/api/admin/news/${news.id}`, {
    expectedRevision: 1,
    blocks: [
      { blockType: 'content.rich-text', contentZh: { html: '<p>x</p>' } },
      { blockType: 'news.header', contentZh: { title: 't' } },
    ],
  });
  assert.equal(headerNotFirst.status, 400);
  assert.ok((await headerNotFirst.json()).error.fields.some((f) => f.code === 'header_position'));

  const pageOnly = await patch(`/api/admin/news/${news.id}`, {
    expectedRevision: 1,
    blocks: [
      { blockType: 'news.header', contentZh: { title: 't' } },
      { blockType: 'news.grid', contentZh: {} },
    ],
  });
  assert.equal(pageOnly.status, 400);

  // Draft-stage Chinese-only header is allowed (missing English is a publish check).
  const chineseOnly = await patch(`/api/admin/news/${news.id}`, {
    expectedRevision: 1,
    blocks: [{ blockType: 'news.header', contentZh: { title: '只有中文' } }],
  });
  assert.equal(chineseOnly.status, 200);
});

// ---------- list filters ----------

test('list filters by status, category, year, completeness and q', async () => {
  const cat = await post('/api/admin/news-categories', { slug: `f-${Date.now()}`, nameZh: '篩選' });
  const catId = (await cat.json()).data.item.id;

  await createNews({ titleZh: '二零二四活動', displayYear: 2024, categoryIds: [catId], titleEn: 'Event 2024' });
  const untranslated = await createNews({ titleZh: '未翻譯新聞' });

  const byYear = await (await get('/api/admin/news?year=2024')).json();
  assert.ok(byYear.data.items.some((item) => item.title_zh === '二零二四活動'));
  assert.ok(!byYear.data.items.some((item) => item.title_zh === '未翻譯新聞'));

  const byCat = await (await get(`/api/admin/news?categoryId=${catId}`)).json();
  assert.ok(byCat.data.items.every((item) => item.categoryIds.includes(catId)));

  const missingEn = await (await get('/api/admin/news?lang=missing-en')).json();
  assert.ok(missingEn.data.items.some((item) => item.id === untranslated.body.data.news.id));

  const byQuery = await (await get('/api/admin/news?q=二零二四')).json();
  assert.ok(byQuery.data.items.some((item) => item.title_zh === '二零二四活動'));

  const trashed = await del(`/api/admin/news/${untranslated.body.data.news.id}`);
  assert.equal(trashed.status, 200);
  const afterTrash = await (await get('/api/admin/news?lang=missing-en')).json();
  assert.ok(!afterTrash.data.items.some((item) => item.id === untranslated.body.data.news.id));
  const restored = await post(`/api/admin/news/${untranslated.body.data.news.id}/restore`, {});
  assert.equal(restored.status, 200);
});

// ---------- media references ----------

test('cover and block media create news_cover / news_block references', async () => {
  const form = new FormData();
  const png = Buffer.alloc(33);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(0x0d0a1a0a, 4);
  png.writeUInt32BE(13, 8);
  png.write('IHDR', 12, 'ascii');
  png.writeUInt32BE(10, 16);
  png.writeUInt32BE(10, 20);
  form.append('file', new Blob([png]), 'cover.png');
  const uploadRes = await fetch(`${base}/api/admin/media/uploads`, {
    method: 'POST',
    headers: { cookie: adminCookie, ...CSRF },
    body: form,
  });
  const mediaId = (await uploadRes.json()).data.asset.id;

  const { body } = await createNews({ coverMediaId: mediaId });
  const news = body.data.news;
  let refs = await (await get(`/api/admin/media/${mediaId}/references`)).json();
  assert.ok(refs.data.references.some((ref) => ref.refType === 'news_cover' && ref.refId === news.id));

  const withImage = await patch(`/api/admin/news/${news.id}`, {
    expectedRevision: 1,
    blocks: [
      { blockType: 'news.header', contentZh: { title: 't', coverMediaId: mediaId } },
      { blockType: 'media.image', contentZh: { mediaId } },
    ],
  });
  assert.equal(withImage.status, 200);
  refs = await (await get(`/api/admin/media/${mediaId}/references`)).json();
  assert.ok(refs.data.references.filter((ref) => ref.refType === 'news_block').length >= 2);

  const refused = await del(`/api/admin/media/${mediaId}/permanent`);
  assert.equal(refused.status, 409);

  // Clearing the cover frees the cover reference.
  await patch(`/api/admin/news/${news.id}`, { expectedRevision: 2, coverMediaId: null });
  refs = await (await get(`/api/admin/media/${mediaId}/references`)).json();
  assert.ok(!refs.data.references.some((ref) => ref.refType === 'news_cover'));
});

// ---------- restore-revision ----------

test('restore-revision copies a historical revision into a new draft', async () => {
  const { body } = await createNews({ titleZh: '第一版' });
  const news = body.data.news;
  await patch(`/api/admin/news/${news.id}`, { expectedRevision: 1, titleZh: '第二版' });
  // Simulate a published snapshot at revision 2 for restore source variety.
  db.prepare("UPDATE news_revisions SET status = 'published' WHERE news_id = ? AND revision = 2").run(news.id);
  db.prepare('UPDATE news_items SET published_revision = 2, current_draft_revision = 2 WHERE id = ?').run(news.id);
  db.prepare("INSERT INTO news_revisions (id, news_id, revision, status, snapshot) VALUES (?, ?, 3, 'draft', '{}')").run(cryptoId(), news.id);
  await patch(`/api/admin/news/${news.id}`, { expectedRevision: 3, titleZh: '第三版' });

  const restored = await post(`/api/admin/news/${news.id}/restore-revision`, {
    expectedRevision: 4,
    revision: 2,
  });
  assert.equal(restored.status, 200);
  const restoredBody = await restored.json();
  assert.equal(restoredBody.data.restoredFrom, 2);
  assert.equal(restoredBody.data.news.title_zh, '第二版');
  assert.equal(restoredBody.data.revision, 5);
  assert.equal(restoredBody.data.blocks[0].block_type, 'news.header');

  const missing = await post(`/api/admin/news/${news.id}/restore-revision`, { expectedRevision: 5, revision: 99 });
  assert.equal(missing.status, 404);
});

function cryptoId() {
  return require('crypto').randomUUID();
}

// ---------- public query lib ----------

test('public query lib returns only published items with displayYear fallback', () => {
  const conn = db;
  const insert = conn.prepare(
    `INSERT INTO news_items (id, slug, title_zh, status, published_at, display_year, published_revision)
     VALUES (?, ?, ?, 'published', ?, ?, 1)`
  );
  insert.run('pq-1', 'pq-a', '有顯示年份', '2020-05-01 10:00:00', 2019);
  insert.run('pq-2', 'pq-b', '回退發佈年', '2021-03-01 10:00:00', null);
  insert.run('pq-3', 'pq-c', '同最新年', '2021-06-01 10:00:00', null);
  conn.prepare("INSERT INTO news_items (id, slug, title_zh, status) VALUES ('pq-4', 'pq-d', '草稿', 'draft')").run();

  assert.deepEqual(listPublishedYears(conn), [2021, 2019]);

  const y2021 = queryPublishedNews(conn, { year: 2021 });
  assert.equal(y2021.total, 2);
  const y2019 = queryPublishedNews(conn, { year: 2019 });
  assert.equal(y2019.total, 1);
  assert.equal(y2019.items[0].slug, 'pq-a');
  const all = queryPublishedNews(conn, {});
  assert.ok(all.items.every((item) => item.slug !== 'pq-d'));
});
