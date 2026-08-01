const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = 'test-secret-for-admin-storage-settings-0123456789';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-storage-settings-'));
process.env.HKBA_DB_PATH = path.join(tmpDir, 'storage-settings.db');

const bcrypt = require('bcryptjs');
const express = require('express');
const { initDatabase, getDb, closeDatabase } = require('../db/init');
const authRoutes = require('../routes/auth');
const storageSettingsRoutes = require('../routes/admin/storageSettings');

initDatabase();
const db = getDb();
db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('editor1', bcrypt.hashSync('editor-pass', 4));
const editorId = db.prepare('SELECT id FROM admins WHERE username = ?').get('editor1').id;
db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'editor')").run(editorId);

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin/storage-settings', storageSettingsRoutes);

let server;
let base;
let adminCookie;
let editorCookie;
const CSRF = { 'x-requested-with': 'XMLHttpRequest' };

test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  adminCookie = await login('admin', 'hkba2024');
  editorCookie = await login('editor1', 'editor-pass');
});

test.after(() => {
  server?.close();
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function login(username, password) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return response.headers.getSetCookie().find((line) => line.startsWith('hkba_admin=')).split(';')[0];
}

function call(method, body, cookie = adminCookie) {
  return fetch(`${base}/api/admin/storage-settings`, {
    method,
    headers: { cookie, ...CSRF, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test('system admin can save OSS settings without exposing credentials', async () => {
  const response = await call('PATCH', {
    enabled: true,
    region: 'oss-cn-hongkong',
    endpoint: '',
    bucket: 'hkba-media',
    accessKeyId: 'LTAI-admin-test',
    accessKeySecret: 'secret-admin-test',
    customDomain: 'https://cdn.hkba.club',
    objectPrefix: 'hkba/media',
  });
  assert.equal(response.status, 200);
  const settings = (await response.json()).data.settings;
  assert.equal(settings.enabled, true);
  assert.equal(settings.hasCredentials, true);
  assert.ok(!JSON.stringify(settings).includes('secret-admin-test'));

  const row = db.prepare('SELECT * FROM storage_settings WHERE id = 1').get();
  assert.ok(!row.access_key_id_enc.includes('LTAI-admin-test'));
  assert.ok(!row.access_key_secret_enc.includes('secret-admin-test'));
});

test('blank credential fields preserve the existing encrypted credentials', async () => {
  const response = await call('PATCH', {
    enabled: true,
    region: 'oss-cn-hongkong',
    bucket: 'hkba-media-2',
    accessKeyId: '',
    accessKeySecret: '',
    customDomain: '',
    objectPrefix: 'hkba/media',
  });
  assert.equal(response.status, 200);
  const settings = (await response.json()).data.settings;
  assert.equal(settings.bucket, 'hkba-media-2');
  assert.equal(settings.hasCredentials, true);
});

test('editors cannot read or update storage credentials', async () => {
  assert.equal((await call('GET', null, editorCookie)).status, 403);
  assert.equal((await call('PATCH', { enabled: false }, editorCookie)).status, 403);
});
