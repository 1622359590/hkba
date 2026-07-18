const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { migrate } = require('./migrate');

const ALL_MIGRATIONS = [
  '001_baseline.sql',
  '002_legacy_id_map.sql',
  '003_page_nodes.sql',
  '004_page_versions_blocks.sql',
  '005_media_assets_references.sql',
  '006_news_builder.sql',
  '007_rbac_audit_ops.sql',
  '008_audit_events_user_agent.sql',
];

const BASELINE_TABLES = [
  'admins',
  'translations',
  'banners',
  'announcements',
  'partners',
  'team_members',
  'news',
  'events',
  'pages',
  'contact_info',
  'contact_messages',
  'media',
  'milestones',
  'stats',
];

function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-migrate-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function openTempDb(t, dir, name = 'test.db') {
  const conn = new Database(path.join(dir, name));
  t.after(() => conn.close());
  return conn;
}

function tableExists(conn, table) {
  return Boolean(
    conn
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table)
  );
}

test('applies the real baseline from scratch on a fresh database', (t) => {
  const dir = makeTempDir(t);
  const conn = openTempDb(t, dir);

  const result = migrate(conn);

  assert.deepEqual(result.applied, ALL_MIGRATIONS);
  assert.equal(result.baselined, null);
  for (const table of BASELINE_TABLES) {
    assert.ok(tableExists(conn, table), `missing baseline table: ${table}`);
  }
  const recorded = conn.prepare('SELECT name, applied_at FROM schema_migrations ORDER BY name').all();
  assert.deepEqual(recorded.map((row) => row.name), ALL_MIGRATIONS);
  assert.ok(recorded.every((row) => !Number.isNaN(Date.parse(row.applied_at))), 'applied_at must be a timestamp');
});

test('records the baseline as applied without executing it on a legacy database', (t) => {
  const dir = makeTempDir(t);
  const conn = openTempDb(t, dir);

  // Simulate a pre-migration database: legacy tables exist, schema_migrations does not.
  conn.exec(`
    CREATE TABLE admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  conn.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('legacy-admin', 'hash');

  const result = migrate(conn);

  assert.equal(result.baselined, '001_baseline.sql');
  // The baseline is only recorded; every later migration still executes.
  assert.deepEqual(result.applied, ALL_MIGRATIONS.slice(1));
  const recorded = conn.prepare('SELECT name FROM schema_migrations ORDER BY name').all();
  assert.deepEqual(recorded.map((row) => row.name), ALL_MIGRATIONS);

  // The baseline file must NOT have been executed: on this legacy fixture the
  // other baseline tables do not exist and would have been created otherwise.
  assert.equal(tableExists(conn, 'banners'), false);
  assert.equal(tableExists(conn, 'news'), false);

  // Existing legacy data is untouched.
  const admin = conn.prepare('SELECT username FROM admins').get();
  assert.equal(admin.username, 'legacy-admin');
});

test('is idempotent when migrate runs repeatedly', (t) => {
  const dir = makeTempDir(t);
  const conn = openTempDb(t, dir);

  const first = migrate(conn);
  const second = migrate(conn);

  assert.deepEqual(first.applied, ALL_MIGRATIONS);
  assert.deepEqual(second.applied, []);
  assert.equal(second.baselined, null);
  assert.deepEqual(second.alreadyApplied, ALL_MIGRATIONS);
  assert.equal(conn.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, ALL_MIGRATIONS.length);
});

test('applies migrations after the baseline on a legacy database', (t) => {
  const dir = makeTempDir(t);
  const fixtures = path.join(dir, 'migrations');
  fs.mkdirSync(fixtures);
  fs.writeFileSync(
    path.join(fixtures, '001_baseline.sql'),
    'CREATE TABLE IF NOT EXISTS fixture_one (id INTEGER PRIMARY KEY);\n'
  );
  fs.writeFileSync(
    path.join(fixtures, '002_extra.sql'),
    'CREATE TABLE fixture_two (id INTEGER PRIMARY KEY);\n'
  );

  const conn = openTempDb(t, dir);
  conn.exec('CREATE TABLE admins (id INTEGER PRIMARY KEY, username TEXT)');

  const result = migrate(conn, { migrationsDir: fixtures });

  assert.equal(result.baselined, '001_baseline.sql');
  assert.deepEqual(result.applied, ['002_extra.sql']);
  assert.equal(tableExists(conn, 'fixture_one'), false, 'baseline must be skipped on legacy databases');
  assert.equal(tableExists(conn, 'fixture_two'), true, 'pending migrations must still apply');

  const rerun = migrate(conn, { migrationsDir: fixtures });
  assert.deepEqual(rerun.applied, []);
});

test('rolls back a failed migration and keeps it unrecorded', (t) => {
  const dir = makeTempDir(t);
  const fixtures = path.join(dir, 'migrations');
  fs.mkdirSync(fixtures);
  fs.writeFileSync(
    path.join(fixtures, '001_baseline.sql'),
    'CREATE TABLE fixture_ok (id INTEGER PRIMARY KEY);\n'
  );
  fs.writeFileSync(
    path.join(fixtures, '002_broken.sql'),
    'CREATE TABLE fixture_ok (id INTEGER PRIMARY KEY);\n' // duplicate table: fails
  );

  const conn = openTempDb(t, dir);

  assert.throws(() => migrate(conn, { migrationsDir: fixtures }));
  // 001 committed before 002 failed; 002 stays unrecorded and can be retried.
  const recorded = conn
    .prepare('SELECT name FROM schema_migrations ORDER BY name')
    .all()
    .map((row) => row.name);
  assert.deepEqual(recorded, ['001_baseline.sql']);
});

test('initDatabase initializes a fresh database through migrations and stays rerunnable', async (t) => {
  const dir = makeTempDir(t);
  process.env.HKBA_DB_PATH = path.join(dir, 'init.db');
  t.after(() => delete process.env.HKBA_DB_PATH);

  const init = require('./init');
  t.after(() => init.closeDatabase());

  init.initDatabase();
  init.initDatabase(); // must not throw or duplicate defaults

  const conn = init.getDb();
  assert.ok(tableExists(conn, 'schema_migrations'));
  assert.ok(tableExists(conn, 'pages'));
  assert.equal(conn.prepare('SELECT COUNT(*) AS count FROM admins').get().count, 1);
  assert.equal(conn.prepare('SELECT COUNT(*) AS count FROM pages').get().count, 2);
  assert.equal(
    conn.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE name = '001_baseline.sql'").get().count,
    1
  );
});
