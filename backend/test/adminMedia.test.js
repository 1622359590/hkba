const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = 'test-secret-for-admin-media-tests-0123456789';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-admin-media-'));
process.env.HKBA_DB_PATH = path.join(tmpDir, 'admin-media.db');
process.env.HKBA_UPLOADS_DIR = path.join(tmpDir, 'uploads');

const bcrypt = require('bcryptjs');
const express = require('express');

const { initDatabase, getDb, closeDatabase } = require('../db/init');
const authRoutes = require('../routes/auth');
const pagesRoutes = require('../routes/admin/pages');
const mediaRoutes = require('../routes/admin/media');

initDatabase();
const db = getDb();
db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('editor1', bcrypt.hashSync('editor-pass', 4));
const editorId = db.prepare('SELECT id FROM admins WHERE username = ?').get('editor1').id;
db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'editor')").run(editorId);

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin/pages', pagesRoutes);
app.use('/api/admin/media', mediaRoutes);

let server;
let base;
let adminCookie;
let editorCookie;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
  adminCookie = (await login('admin', 'hkba2024')).cookie;
  editorCookie = (await login('editor1', 'editor-pass')).cookie;
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

function pngBuffer(width, height) {
  const buffer = Buffer.alloc(33);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.writeUInt32BE(0x0d0a1a0a, 4);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

async function uploadFile(buffer, filename, { cookie = adminCookie, type = 'application/octet-stream' } = {}) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type }), filename);
  const res = await fetch(`${base}/api/admin/media/uploads`, {
    method: 'POST',
    headers: { cookie, ...CSRF },
    body: form,
  });
  return { res, body: await res.json() };
}

async function uploadPng(filename = 'photo.png', width = 120, height = 80) {
  const { res, body } = await uploadFile(pngBuffer(width, height), filename);
  assert.equal(res.status, 201, JSON.stringify(body));
  return body.data.asset;
}

// ---------- upload ----------

test('upload stores the file, extracts metadata and audits', async () => {
  const asset = await uploadPng('cover.png', 320, 200);
  assert.equal(asset.mimeType, 'image/png');
  assert.equal(asset.kind, 'image');
  assert.deepEqual({ width: asset.width, height: asset.height }, { width: 320, height: 200 });
  assert.match(asset.checksum, /^[a-f0-9]{64}$/);
  assert.equal(asset.status, 'active');
  assert.ok(asset.url.startsWith('/uploads/media/'));
  assert.ok(fs.existsSync(path.join(process.env.HKBA_UPLOADS_DIR, asset.storageKey)));

  const audit = db
    .prepare("SELECT * FROM audit_events WHERE action = 'media.upload' AND object_id = ?")
    .get(asset.id);
  assert.ok(audit, 'upload writes an audit row');
});

test('upload rejects a missing file and disallowed types with the unified envelope', async () => {
  const noFile = await fetch(`${base}/api/admin/media/uploads`, {
    method: 'POST',
    headers: { cookie: adminCookie, ...CSRF },
    body: new FormData(),
  });
  assert.equal(noFile.status, 400);
  assert.equal((await noFile.json()).error.code, 'UPLOAD_REJECTED');

  const { res, body } = await uploadFile(Buffer.from('MZ executable'), 'virus.exe');
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'UPLOAD_REJECTED');
  assert.equal(body.error.fields[0].code, 'type');
});

test('svg uploads are sanitized before storage', async () => {
  const dirty = '<svg onload="alert(1)"><script>alert(2)</script><rect width="4" height="4"/></svg>';
  const { res, body } = await uploadFile(Buffer.from(dirty), 'icon.svg');
  assert.equal(res.status, 201);
  const asset = body.data.asset;
  assert.equal(asset.mimeType, 'image/svg+xml');
  const saved = fs.readFileSync(path.join(process.env.HKBA_UPLOADS_DIR, asset.storageKey), 'utf8');
  assert.ok(!/script|onload/i.test(saved));
});

// ---------- list & patch ----------

test('list supports q, kind and unused filters', async () => {
  const a = await uploadPng('annual-report-banner.png');
  const b = await uploadPng('sponsor-logo.png');
  const pdf = Buffer.from('%PDF-1.4 fake');
  const { body: pdfBody } = await uploadFile(pdf, 'minutes.pdf');
  assert.equal(pdfBody.data.asset.kind, 'pdf');

  const byQuery = await (await get('/api/admin/media?q=sponsor')).json();
  assert.ok(byQuery.data.items.some((item) => item.id === b.id));
  assert.ok(!byQuery.data.items.some((item) => item.id === a.id));

  const images = await (await get('/api/admin/media?kind=image&pageSize=100')).json();
  assert.ok(images.data.items.every((item) => item.kind === 'image'));
  const pdfs = await (await get('/api/admin/media?kind=pdf')).json();
  assert.ok(pdfs.data.items.length >= 1);

  const unused = await (await get('/api/admin/media?unused=1&pageSize=100')).json();
  assert.ok(unused.data.items.some((item) => item.id === a.id));
});

test('patch updates alt text and validates types', async () => {
  const asset = await uploadPng('team.png');
  const bad = await patch(`/api/admin/media/${asset.id}`, { altZh: 42 });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, 'VALIDATION_FAILED');

  const ok = await patch(`/api/admin/media/${asset.id}`, { altZh: '團隊合照', captionEn: 'Team' });
  assert.equal(ok.status, 200);
  const updated = (await ok.json()).data.asset;
  assert.equal(updated.altZh, '團隊合照');
  assert.equal(updated.captionEn, 'Team');

  const missing = await patch('/api/admin/media/does-not-exist', { altZh: 'x' });
  assert.equal(missing.status, 404);
});

// ---------- references & delete protection ----------

async function setupPageWithImageBlock(mediaId) {
  const pageRes = await post('/api/admin/pages', { slug: `media-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, titleZh: '媒體測試' });
  const page = (await pageRes.json()).data.node;
  const draftRes = await get(`/api/admin/pages/${page.id}/draft`);
  const draft = (await draftRes.json()).data;
  const blockRes = await post(`/api/admin/pages/${page.id}/draft/blocks`, {
    expectedRevision: draft.version.revision,
    block: { componentType: 'media.image', contentZh: { mediaId } },
  });
  assert.equal(blockRes.status, 201, JSON.stringify(await blockRes.clone().json()));
  const blockBody = await blockRes.json();
  return { page, block: blockBody.data.block, revision: blockBody.data.revision };
}

test('block configs create references that block permanent deletion until removed', async () => {
  const asset = await uploadPng('referenced.png');
  const { page, block, revision } = await setupPageWithImageBlock(asset.id);

  const refs = await (await get(`/api/admin/media/${asset.id}/references`)).json();
  assert.equal(refs.data.total, 1);
  assert.deepEqual(
    refs.data.references.map((ref) => ({ refType: ref.refType, refId: ref.refId })),
    [{ refType: 'page_block', refId: block.id }]
  );

  const unused = await (await get('/api/admin/media?unused=1&pageSize=100')).json();
  assert.ok(!unused.data.items.some((item) => item.id === asset.id));

  const refused = await del(`/api/admin/media/${asset.id}/permanent`);
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).error.code, 'REFERENCE_EXISTS');

  // Removing the reference from the block config frees the asset.
  const cleared = await patch(`/api/admin/pages/${page.id}/draft/blocks/${block.id}`, {
    expectedRevision: revision,
    patch: { contentZh: { mediaId: '' } },
  });
  assert.equal(cleared.status, 200);
  const afterRefs = await (await get(`/api/admin/media/${asset.id}/references`)).json();
  assert.equal(afterRefs.data.total, 0);

  const gone = await del(`/api/admin/media/${asset.id}/permanent`);
  assert.equal(gone.status, 200);
  assert.ok(!fs.existsSync(path.join(process.env.HKBA_UPLOADS_DIR, asset.storageKey)));
});

test('duplicating and deleting blocks mirrors their references', async () => {
  const asset = await uploadPng('mirror.png');
  const { page, block, revision } = await setupPageWithImageBlock(asset.id);

  const dupRes = await post(`/api/admin/pages/${page.id}/draft/blocks/${block.id}/duplicate`, { expectedRevision: revision });
  assert.equal(dupRes.status, 201);
  const dupBody = await dupRes.json();
  const refsAfterDup = await (await get(`/api/admin/media/${asset.id}/references`)).json();
  assert.equal(refsAfterDup.data.total, 2);

  const delRes = await del(`/api/admin/pages/${page.id}/draft/blocks/${block.id}?expectedRevision=${dupBody.data.revision}`);
  assert.equal(delRes.status, 200);
  const refsAfterDelete = await (await get(`/api/admin/media/${asset.id}/references`)).json();
  assert.equal(refsAfterDelete.data.total, 1);
  assert.equal(refsAfterDelete.data.references[0].refId, dupBody.data.block.id);
});

test('dangling media ids in configs are not recorded as references', async () => {
  const { block } = await setupPageWithImageBlock('no-such-asset-id');
  const rows = db.prepare('SELECT * FROM media_references WHERE ref_id = ?').all(block.id);
  assert.equal(rows.length, 0);
});

// ---------- trash & permanent ----------

test('trash hides assets from the default list; permanent removes file and row', async () => {
  const asset = await uploadPng('trash-me.png');
  const trashed = await del(`/api/admin/media/${asset.id}`);
  assert.equal(trashed.status, 200);

  const list = await (await get('/api/admin/media?pageSize=100')).json();
  assert.ok(!list.data.items.some((item) => item.id === asset.id));
  const trashList = await (await get('/api/admin/media?status=trash')).json();
  assert.ok(trashList.data.items.some((item) => item.id === asset.id));

  const again = await del(`/api/admin/media/${asset.id}`);
  assert.equal(again.status, 404);

  const fileBefore = path.join(process.env.HKBA_UPLOADS_DIR, asset.storageKey);
  assert.ok(fs.existsSync(fileBefore), 'trash keeps the file on disk');
  const gone = await del(`/api/admin/media/${asset.id}/permanent`);
  assert.equal(gone.status, 200);
  assert.ok(!fs.existsSync(fileBefore));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM media_assets WHERE id = ?').get(asset.id).n, 0);
});

test('permanent deletion requires media.delete permission', async () => {
  const asset = await uploadPng('guarded.png');
  const asEditor = await del(`/api/admin/media/${asset.id}/permanent`, { cookie: editorCookie });
  assert.equal(asEditor.status, 403);
  const asAdmin = await del(`/api/admin/media/${asset.id}/permanent`);
  assert.equal(asAdmin.status, 200);
  const audit = db
    .prepare("SELECT * FROM audit_events WHERE action = 'media.delete_permanent' AND object_id = ?")
    .get(asset.id);
  assert.ok(audit, 'permanent deletion writes an audit row');
});

test('editor (content.write) may upload; anonymous is rejected', async () => {
  const asEditor = await uploadPng('editor-upload.png', 10, 10);
  assert.ok(asEditor.id);

  const noAuth = await get('/api/admin/media', { cookie: '' });
  assert.equal(noAuth.status, 401);
});
