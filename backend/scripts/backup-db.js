#!/usr/bin/env node
// Database backup (M9; acceptance spec §12).
//
// Copies the SQLite database file into backend/db/backups/ with an
// ISO-timestamped name and prunes backups older than --keep-days
// (default 30). Intended to be wired into crontab, e.g.:
//
//   17 3 * * * cd /path/to/hkba/backend && node scripts/backup-db.js >> /var/log/hkba-backup.log 2>&1
//
// CLI:
//   node scripts/backup-db.js [--db <path>] [--keep-days <n>] [--dir <backupsDir>]
//
// Exports runBackup({ dbPath, backupsDir, keepDays, now }) for tests.

const fs = require('fs');
const path = require('path');

function defaultDbPath() {
  return process.env.HKBA_DB_PATH || path.join(__dirname, '..', 'db', 'hkba.db');
}

function defaultBackupsDir() {
  return path.join(__dirname, '..', 'db', 'backups');
}

const BACKUP_RE = /^hkba\.(.+)\.bak$/;

function runBackup({ dbPath = defaultDbPath(), backupsDir = defaultBackupsDir(), keepDays = 30, now = new Date() } = {}) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`database file not found: ${dbPath}`);
  }
  fs.mkdirSync(backupsDir, { recursive: true });

  // SQLite files are copy-safe here because the backup runs while the app is
  // quiet (cron) or the operator has stopped the server; the migration CLI
  // uses the same approach. A live-traffic deployment should prefer
  // `sqlite3 <db> ".backup ..."` — noted in the admin manual.
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupsDir, `hkba.${stamp}.bak`);
  fs.copyFileSync(dbPath, target);
  const sizeBytes = fs.statSync(target).size;

  const cutoff = now.getTime() - keepDays * 24 * 60 * 60 * 1000;
  const pruned = [];
  for (const entry of fs.readdirSync(backupsDir)) {
    const match = BACKUP_RE.exec(entry);
    if (!match) continue;
    const full = path.join(backupsDir, entry);
    const stat = fs.statSync(full);
    if (stat.mtimeMs < cutoff) {
      fs.rmSync(full);
      pruned.push(entry);
    }
  }

  return { backup: target, sizeBytes, pruned, keepDays };
}

function main() {
  const args = process.argv.slice(2);
  const flagValue = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const dbPath = flagValue('--db') || defaultDbPath();
  const backupsDir = flagValue('--dir') || defaultBackupsDir();
  const keepDays = Number(flagValue('--keep-days') || 30);
  if (!Number.isFinite(keepDays) || keepDays <= 0) {
    console.error('✖ --keep-days must be a positive number');
    process.exit(1);
  }
  try {
    const result = runBackup({ dbPath, backupsDir, keepDays });
    console.log(`✅ backup written: ${result.backup} (${result.sizeBytes} bytes)`);
    if (result.pruned.length) {
      console.log(`🧹 pruned ${result.pruned.length} backup(s) older than ${keepDays} days:`);
      for (const name of result.pruned) console.log(`   - ${name}`);
    }
  } catch (err) {
    console.error(`✖ backup failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runBackup };
