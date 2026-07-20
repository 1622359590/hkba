const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Env must be set before requiring auth/init modules.
process.env.JWT_SECRET = 'test-secret-for-auth-session-tests-0123456789';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-auth-session-'));
process.env.HKBA_DB_PATH = path.join(tmpDir, 'auth.db');

const bcrypt = require('bcryptjs');
const express = require('express');

const { initDatabase, getDb, closeDatabase } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../middleware/requirePermission');
const authRoutes = require('../routes/auth');

initDatabase();
const db = getDb();

// Fixture users: editor (content.read+write) and publisher (no content.write).
db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('editor1', bcrypt.hashSync('editor-pass', 4));
db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('publisher1', bcrypt.hashSync('publisher-pass', 4));
const editorId = db.prepare('SELECT id FROM admins WHERE username = ?').get('editor1').id;
const publisherId = db.prepare('SELECT id FROM admins WHERE username = ?').get('publisher1').id;
db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'editor')").run(editorId);
db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'publisher')").run(publisherId);

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.get('/test/who', authMiddleware, (req, res) => {
  res.json({ method: req.authMethod, id: req.admin.id, username: req.admin.username });
});
app.post('/test/write', authMiddleware, requirePermission('content.write'), (req, res) => {
  res.json({ ok: true });
});

let server;
let base;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server?.close();
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const CSRF = { 'x-requested-with': 'XMLHttpRequest' };
const UA = { 'user-agent': 'auth-session-test' };

async function login(username, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...UA },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json();
  const setCookie = res.headers.getSetCookie().find((line) => line.startsWith('hkba_admin='));
  const cookiePair = setCookie ? setCookie.split(';')[0] : null;
  return { res, body, setCookie, cookiePair };
}

function auditRows(action) {
  return db.prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY created_at').all(action);
}

test('login returns the JWT and sets the HttpOnly session cookie', async () => {
  const { res, body, setCookie } = await login('admin', 'hkba2024');
  assert.equal(res.status, 200);
  assert.ok(body.token);
  assert.ok(setCookie);
  assert.ok(setCookie.includes('HttpOnly'));
  assert.ok(setCookie.includes('SameSite=Lax'));
  assert.ok(setCookie.includes('Max-Age=604800'));
  assert.ok(setCookie.includes('Path=/'));
  assert.ok(!setCookie.includes('Secure'), 'non-production must not set Secure');
});

test('cookie session alone authenticates (cookie mode)', async () => {
  const { cookiePair } = await login('admin', 'hkba2024');
  const res = await fetch(`${base}/test/who`, { headers: { cookie: cookiePair } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { method: 'cookie', id: 1, username: 'admin' });
});

test('bearer token alone still authenticates (bearer fallback)', async () => {
  const { body } = await login('admin', 'hkba2024');
  const res = await fetch(`${base}/test/who`, { headers: { authorization: `Bearer ${body.token}` } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).method, 'bearer');
});

test('cookie wins when both credentials are present', async () => {
  const { body, cookiePair } = await login('admin', 'hkba2024');
  const res = await fetch(`${base}/test/who`, {
    headers: { cookie: cookiePair, authorization: `Bearer ${body.token}` },
  });
  assert.equal((await res.json()).method, 'cookie');
});

test('an invalid cookie does not block a valid bearer fallback', async () => {
  const { body } = await login('admin', 'hkba2024');
  const res = await fetch(`${base}/test/who`, {
    headers: { cookie: 'hkba_admin=garbage', authorization: `Bearer ${body.token}` },
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).method, 'bearer');
});

test('missing credentials return 401', async () => {
  const res = await fetch(`${base}/test/who`);
  assert.equal(res.status, 401);
});

test('cookie write requests without the CSRF header are rejected', async () => {
  const { cookiePair } = await login('admin', 'hkba2024');
  const res = await fetch(`${base}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookiePair },
    body: JSON.stringify({ oldPassword: 'hkba2024', newPassword: 'whatever-123' }),
  });
  assert.equal(res.status, 403);
});

test('cookie write requests with the CSRF header pass, bearer writes skip the check', async () => {
  const { body, cookiePair } = await login('admin', 'hkba2024');
  const viaCookie = await fetch(`${base}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookiePair, ...CSRF },
    body: JSON.stringify({ oldPassword: 'hkba2024', newPassword: 'temporary-123' }),
  });
  assert.equal(viaCookie.status, 200);
  const viaBearer = await fetch(`${base}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: `Bearer ${body.token}` },
    body: JSON.stringify({ oldPassword: 'temporary-123', newPassword: 'hkba2024' }),
  });
  assert.equal(viaBearer.status, 200);
});

test('cookie read requests do not need the CSRF header', async () => {
  const { cookiePair } = await login('admin', 'hkba2024');
  const res = await fetch(`${base}/api/auth/verify`, { headers: { cookie: cookiePair } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.authMethod, 'cookie');
  assert.deepEqual(body.roles, ['super_admin']);
  assert.ok(body.permissions.includes('system.admin'));
});

test('logout clears the session cookie', async () => {
  const { cookiePair } = await login('admin', 'hkba2024');
  const res = await fetch(`${base}/api/auth/logout`, {
    method: 'POST',
    headers: { cookie: cookiePair, ...CSRF },
  });
  assert.equal(res.status, 200);
  const cleared = res.headers.getSetCookie().find((line) => line.startsWith('hkba_admin='));
  assert.ok(cleared);
  assert.ok(cleared.includes('Max-Age=0'));
});

test('requirePermission allows editor writes but rejects publisher writes', async () => {
  const editor = await login('editor1', 'editor-pass');
  const allowed = await fetch(`${base}/test/write`, {
    method: 'POST',
    headers: { cookie: editor.cookiePair, ...CSRF },
  });
  assert.equal(allowed.status, 200);

  const publisher = await login('publisher1', 'publisher-pass');
  const denied = await fetch(`${base}/test/write`, {
    method: 'POST',
    headers: { cookie: publisher.cookiePair, ...CSRF },
  });
  assert.equal(denied.status, 403);
});

test('audit events cover login, failed login, password change and logout', async () => {
  const baseline = {
    login: auditRows('auth.login').length,
    failed: auditRows('auth.login_failed').length,
    password: auditRows('auth.change_password').length,
    logout: auditRows('auth.logout').length,
  };

  await login('admin', 'hkba2024');
  await login('admin', 'wrong-password');
  const { cookiePair } = await login('admin', 'hkba2024');
  await fetch(`${base}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookiePair, ...CSRF },
    body: JSON.stringify({ oldPassword: 'hkba2024', newPassword: 'audit-123' }),
  });
  await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { cookie: cookiePair, ...CSRF } });

  assert.ok(auditRows('auth.login').length >= baseline.login + 2);
  assert.equal(auditRows('auth.login_failed').length, baseline.failed + 1);
  assert.equal(auditRows('auth.change_password').length, baseline.password + 1);
  assert.equal(auditRows('auth.logout').length, baseline.logout + 1);

  const failed = auditRows('auth.login_failed').find((row) => row.after_summary.includes('invalid_credentials'));
  assert.ok(failed);
  assert.equal(failed.actor_name, 'admin');
  assert.deepEqual(JSON.parse(failed.after_summary), { reason: 'invalid_credentials' });
  assert.ok(failed.ip);
  assert.equal(failed.user_agent, 'auth-session-test');
});

test('a broken audit sink never breaks the main flow', async (t) => {
  const restore = t.mock.method(console, 'error', () => {});
  db.exec('DROP TABLE audit_events');
  try {
    const { res } = await login('admin', 'audit-123');
    assert.equal(res.status, 200);
  } finally {
    restore.mock.restore();
  }
});
