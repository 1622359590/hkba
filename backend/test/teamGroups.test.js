const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = 'test-secret-for-team-groups-0123456789';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-team-groups-'));
process.env.HKBA_DB_PATH = path.join(tmpDir, 'team-groups.db');

const express = require('express');
const { initDatabase, getDb, closeDatabase } = require('../db/init');
const authRoutes = require('../routes/auth');
const teamRoutes = require('../routes/team');

initDatabase();
const db = getDb();
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/team', teamRoutes);

let server;
let base;
let cookie;
const csrf = { 'x-requested-with': 'XMLHttpRequest' };

test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'hkba2024' }),
  });
  cookie = response.headers.getSetCookie().find((value) => value.startsWith('hkba_admin=')).split(';')[0];
});

test.after(() => {
  server?.close();
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function call(method, url, body, authenticated = true) {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: {
      ...(authenticated ? { cookie, ...csrf } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, body: await response.json() };
}

test('public group endpoint preserves the ordered code-array contract', async () => {
  const result = await call('GET', '/api/team/groups', null, false);
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, ['honorary_chairman', 'chairman', 'vice_chairman', 'committee', 'advisor']);
});

test('authenticated identity CRUD normalizes labels and reports member counts', async () => {
  const created = await call('POST', '/api/team/groups', { code: 'patron', label_zh: '贊助人', label_en: '' });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.label_en, '贊助人');

  const renamed = await call('PUT', '/api/team/groups/patron', { label_zh: '榮譽贊助人', label_en: 'Patron' });
  assert.equal(renamed.response.status, 200);
  assert.equal(renamed.body.label_zh, '榮譽贊助人');

  const rows = await call('GET', '/api/team/groups/all');
  assert.equal(rows.response.status, 200);
  assert.equal(rows.body.find((row) => row.code === 'patron').member_count, 0);
});

test('reordering requires a complete permutation and updates public order', async () => {
  const all = (await call('GET', '/api/team/groups/all')).body;
  const reversed = all.map((row) => row.code).reverse();
  assert.equal((await call('PUT', '/api/team/groups/order', { codes: reversed })).response.status, 200);
  assert.deepEqual((await call('GET', '/api/team/groups', null, false)).body, reversed);
  assert.equal((await call('PUT', '/api/team/groups/order', { codes: reversed.slice(1) })).response.status, 400);
});

test('member writes reject unknown and inactive assignments but retain an unchanged inactive identity', async () => {
  const unknown = await call('POST', '/api/team', { name_zh: '未知', title_zh: '未知', avatar_url: '/x.png', group_name: 'missing' });
  assert.equal(unknown.response.status, 400);

  await call('PUT', '/api/team/groups/advisor', { label_zh: '顧問', label_en: 'Advisor', is_active: false });
  const inactive = await call('POST', '/api/team', { name_zh: '新顧問', title_zh: '顧問', avatar_url: '/a.png', group_name: 'advisor' });
  assert.equal(inactive.response.status, 400);

  const inserted = db.prepare("INSERT INTO team_members (name_zh, title_zh, avatar_url, group_name) VALUES ('舊顧問', '顧問', '/old.png', 'advisor')").run();
  const retained = await call('PUT', `/api/team/${inserted.lastInsertRowid}`, { name_zh: '舊顧問', title_zh: '資深顧問', avatar_url: '/old.png', group_name: 'advisor' });
  assert.equal(retained.response.status, 200);
});

test('deletion is blocked until every referenced member is transferred', async () => {
  const inUse = await call('DELETE', '/api/team/groups/advisor');
  assert.equal(inUse.response.status, 409);
  assert.equal(inUse.body.code, 'GROUP_IN_USE');
  assert.equal(inUse.body.details.memberCount, 1);

  db.prepare("UPDATE team_members SET group_name = 'chairman' WHERE group_name = 'advisor'").run();
  const removed = await call('DELETE', '/api/team/groups/advisor');
  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.code, 'advisor');
});
