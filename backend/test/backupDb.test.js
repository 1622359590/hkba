// M9 tests: scripts/backup-db.js — file copy, naming, retention pruning.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { runBackup, runOnlineBackup } = require('../scripts/backup-db');

test('backup copies the database and prunes files older than keep-days', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-backup-'));
  try {
    const dbPath = path.join(tmp, 'hkba.db');
    fs.writeFileSync(dbPath, Buffer.from('SQLite format 3\0-fake-but-copyable'));
    const backupsDir = path.join(tmp, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });

    // Pre-existing backups: one ancient (pruned), one fresh (kept), one
    // unrelated file (untouched).
    const oldFile = path.join(backupsDir, 'hkba.2020-01-01T00-00-00-000Z.bak');
    const freshFile = path.join(backupsDir, `hkba.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`);
    const otherFile = path.join(backupsDir, 'notes.txt');
    fs.writeFileSync(oldFile, 'old');
    fs.writeFileSync(freshFile, 'fresh');
    fs.writeFileSync(otherFile, 'keep me');
    const ancient = new Date('2020-01-01T00:00:00Z');
    fs.utimesSync(oldFile, ancient, ancient);

    const result = runBackup({ dbPath, backupsDir, keepDays: 30 });

    assert.ok(fs.existsSync(result.backup));
    assert.match(path.basename(result.backup), /^hkba\..+\.bak$/);
    assert.equal(fs.readFileSync(result.backup, 'utf8'), fs.readFileSync(dbPath, 'utf8'));
    assert.deepEqual(result.pruned, ['hkba.2020-01-01T00-00-00-000Z.bak']);
    assert.ok(!fs.existsSync(oldFile));
    assert.ok(fs.existsSync(freshFile));
    assert.ok(fs.existsSync(otherFile));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('backup fails clearly when the database file is missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-backup-'));
  try {
    assert.throws(
      () => runBackup({ dbPath: path.join(tmp, 'nope.db'), backupsDir: path.join(tmp, 'backups') }),
      /database file not found/
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('online backup includes committed rows still present in the WAL', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-online-backup-'));
  const dbPath = path.join(tmp, 'hkba.db');
  const backupsDir = path.join(tmp, 'backups');
  const source = new Database(dbPath);

  try {
    source.pragma('journal_mode = WAL');
    source.pragma('wal_autocheckpoint = 0');
    source.exec('CREATE TABLE deployment_probe (value TEXT NOT NULL)');
    source.prepare('INSERT INTO deployment_probe (value) VALUES (?)').run('committed-in-wal');

    fs.mkdirSync(backupsDir, { recursive: true });
    const oldFile = path.join(backupsDir, 'hkba.2020-01-01T00-00-00-000Z.bak');
    fs.writeFileSync(oldFile, 'old');
    const ancient = new Date('2020-01-01T00:00:00Z');
    fs.utimesSync(oldFile, ancient, ancient);

    assert.ok(fs.existsSync(`${dbPath}-wal`));

    const result = await runOnlineBackup({ dbPath, backupsDir, keepDays: 30 });
    assert.deepEqual(result.pruned, ['hkba.2020-01-01T00-00-00-000Z.bak']);
    assert.ok(!fs.existsSync(oldFile));
    const backup = new Database(result.backup, { readonly: true });
    try {
      assert.equal(
        backup.prepare('SELECT value FROM deployment_probe').pluck().get(),
        'committed-in-wal'
      );
    } finally {
      backup.close();
    }
  } finally {
    source.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
