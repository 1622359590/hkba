// M9 tests: scripts/backup-db.js — file copy, naming, retention pruning.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runBackup } = require('../scripts/backup-db');

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
