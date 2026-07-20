#!/usr/bin/env node
// Database backup (M9; acceptance spec §12).
//
// Uses SQLite's online backup API to write backend/db/backups/ with an
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
const Database = require('better-sqlite3');

function defaultDbPath() {
  return process.env.HKBA_DB_PATH || path.join(__dirname, '..', 'db', 'hkba.db');
}

function defaultBackupsDir() {
  return path.join(__dirname, '..', 'db', 'backups');
}

const BACKUP_RE = /^hkba\.(.+)\.bak$/;

function prepareBackup({ dbPath, backupsDir, now }) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`database file not found: ${dbPath}`);
  }
  fs.mkdirSync(backupsDir, { recursive: true });

  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return path.join(backupsDir, `hkba.${stamp}.bak`);
}

function pruneBackups({ backupsDir, keepDays, now, currentBackup }) {
  const cutoff = now.getTime() - keepDays * 24 * 60 * 60 * 1000;
  const pruned = [];
  for (const entry of fs.readdirSync(backupsDir)) {
    const match = BACKUP_RE.exec(entry);
    if (!match) continue;
    const full = path.join(backupsDir, entry);
    if (full === currentBackup) continue;
    const stat = fs.statSync(full);
    if (stat.mtimeMs < cutoff) {
      fs.rmSync(full);
      pruned.push(entry);
    }
  }
  return pruned;
}

function backupResult({ target, backupsDir, keepDays, now }) {
  return {
    backup: target,
    sizeBytes: fs.statSync(target).size,
    pruned: pruneBackups({ backupsDir, keepDays, now, currentBackup: target }),
    keepDays,
  };
}

function runBackup({ dbPath = defaultDbPath(), backupsDir = defaultBackupsDir(), keepDays = 30, now = new Date() } = {}) {
  const target = prepareBackup({ dbPath, backupsDir, now });

  // SQLite files are copy-safe here because the backup runs while the app is
  // stopped. Migration helpers retain this synchronous path, while deployment
  // and cron use runOnlineBackup so committed WAL data is included.
  fs.copyFileSync(dbPath, target);
  return backupResult({ target, backupsDir, keepDays, now });
}

async function runOnlineBackup({ dbPath = defaultDbPath(), backupsDir = defaultBackupsDir(), keepDays = 30, now = new Date() } = {}) {
  const target = prepareBackup({ dbPath, backupsDir, now });
  const source = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(target);
    return backupResult({ target, backupsDir, keepDays, now });
  } catch (error) {
    if (fs.existsSync(target)) {
      fs.rmSync(target);
    }
    throw error;
  } finally {
    source.close();
  }
}

async function main() {
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
    const result = await runOnlineBackup({ dbPath, backupsDir, keepDays });
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

module.exports = { runBackup, runOnlineBackup };
