const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { migrate } = require('../db/migrate');
const { seedRbac, hasPermission, permissionsOf, rolesOf, PERMISSIONS } = require('./rbac');

function makeTempDb(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-rbac-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const conn = new Database(path.join(dir, 'test.db'));
  t.after(() => conn.close());
  migrate(conn);
  return conn;
}

function seedAdmin(conn, username) {
  conn.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run(username, 'hash');
  return conn.prepare('SELECT id FROM admins WHERE username = ?').get(username).id;
}

test('seedRbac creates the three roles and all permissions idempotently', (t) => {
  const conn = makeTempDb(t);
  const adminId = seedAdmin(conn, 'admin');

  seedRbac(conn);
  seedRbac(conn); // must stay idempotent

  assert.equal(conn.prepare('SELECT COUNT(*) AS count FROM roles').get().count, 3);
  assert.equal(conn.prepare('SELECT COUNT(*) AS count FROM permissions').get().count, PERMISSIONS.length);
  assert.equal(conn.prepare('SELECT COUNT(*) AS count FROM user_roles').get().count, 1);

  // The first admin is the bootstrap super_admin.
  assert.deepEqual(rolesOf(conn, adminId), ['super_admin']);
  for (const permission of PERMISSIONS) {
    assert.ok(hasPermission(conn, adminId, permission.code), `super_admin missing ${permission.code}`);
  }
});

test('role permission maps follow spec §12 capabilities', (t) => {
  const conn = makeTempDb(t);
  seedAdmin(conn, 'admin');
  const editorId = seedAdmin(conn, 'editor1');
  const publisherId = seedAdmin(conn, 'publisher1');
  seedRbac(conn);
  conn.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, 'editor')").run(editorId);
  conn.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, 'publisher')").run(publisherId);

  assert.deepEqual(permissionsOf(conn, editorId), ['content.read', 'content.write']);
  assert.ok(hasPermission(conn, publisherId, 'publish'));
  assert.ok(hasPermission(conn, publisherId, 'rollback'));
  assert.ok(hasPermission(conn, publisherId, 'content.read'));
  assert.equal(hasPermission(conn, publisherId, 'content.write'), false);
  assert.equal(hasPermission(conn, editorId, 'publish'), false);
  assert.equal(hasPermission(conn, editorId, 'media.delete'), false);
  assert.equal(hasPermission(conn, 99999, 'content.read'), false);
});
