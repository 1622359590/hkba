const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { migrate } = require('../db/migrate');
const { recordAudit, auditEvent } = require('./audit');

function makeTempDb(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-audit-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const conn = new Database(path.join(dir, 'test.db'));
  t.after(() => conn.close());
  migrate(conn);
  return conn;
}

test('recordAudit writes a complete audit_events row', (t) => {
  const conn = makeTempDb(t);
  recordAudit(conn, {
    actorId: 1,
    actorName: 'admin',
    action: 'auth.login',
    objectType: 'session',
    objectId: 1,
    detail: { via: 'cookie' },
    ip: '127.0.0.1',
    userAgent: 'node-test',
  });

  const rows = conn.prepare('SELECT * FROM audit_events').all();
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.match(row.id, /^[0-9a-f-]{36}$/);
  assert.equal(row.actor_id, 1);
  assert.equal(row.actor_name, 'admin');
  assert.equal(row.action, 'auth.login');
  assert.equal(row.object_type, 'session');
  assert.equal(row.object_id, '1');
  assert.equal(row.ip, '127.0.0.1');
  assert.equal(row.user_agent, 'node-test');
  assert.deepEqual(JSON.parse(row.after_summary), { via: 'cookie' });
  assert.ok(!Number.isNaN(Date.parse(row.created_at)));
});

test('recordAudit never throws when the audit sink is broken', (t) => {
  const conn = makeTempDb(t);
  conn.exec('DROP TABLE audit_events');
  const restore = t.mock.method(console, 'error', () => {});
  try {
    assert.doesNotThrow(() =>
      recordAudit(conn, { action: 'auth.login', actorName: 'admin' })
    );
  } finally {
    restore.mock.restore();
  }
});

test('auditEvent merges request context with caller fields', () => {
  const req = { ip: '10.0.0.1', get: (name) => (name === 'user-agent' ? 'agent-x' : undefined) };
  const event = auditEvent(req, { action: 'auth.logout', actorName: 'admin' });
  assert.deepEqual(event, {
    ip: '10.0.0.1',
    userAgent: 'agent-x',
    action: 'auth.logout',
    actorName: 'admin',
  });
});
