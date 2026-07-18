#!/usr/bin/env node
// Read-only inventory of the HKBA SQLite database.
//
// Prints a JSON summary of every table (row counts, columns, small samples)
// plus high-level rollups used by the Phase 2 data audit (pages, news, media,
// admins, partners, team_members, banners, ...). NEVER writes to the database:
// the file is opened with better-sqlite3 `readonly + fileMustExist`.
//
// Usage:
//   node backend/scripts/inventory.js                 # default db path
//   HKBA_DB_PATH=/path/to/hkba.db node backend/scripts/inventory.js
//   node backend/scripts/inventory.js --db /path/to/snapshot.db
//
// If the database file does not exist the script prints a JSON notice and
// exits 0 instead of crashing.

const fs = require('fs');
const Database = require('better-sqlite3');
const { resolveDbPath } = require('../db/init');

const MAX_SAMPLE_ROWS = 5;
const MAX_TEXT_LENGTH = 120;
const SENSITIVE_COLUMNS = new Set(['password', 'token', 'secret', 'api_key', 'apikey']);
const SYSTEM_TABLES = new Set(['schema_migrations']);

function parseArgs(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--db' && argv[i + 1]) return argv[i + 1];
    if (argv[i].startsWith('--db=')) return argv[i].slice('--db='.length);
  }
  return null;
}

function sanitizeValue(column, value) {
  if (SENSITIVE_COLUMNS.has(column.toLowerCase())) return '[redacted]';
  if (typeof value === 'string' && value.length > MAX_TEXT_LENGTH) {
    return `${value.slice(0, MAX_TEXT_LENGTH)}…[truncated ${value.length - MAX_TEXT_LENGTH} chars]`;
  }
  return value;
}

function sanitizeRow(row) {
  const clean = {};
  for (const [key, value] of Object.entries(row)) {
    clean[key] = sanitizeValue(key, value);
  }
  return clean;
}

function tableExists(conn, table) {
  return Boolean(
    conn
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table)
  );
}

function columnNames(conn, table) {
  return conn
    .prepare(`PRAGMA table_info(${JSON.stringify(table)})`)
    .all()
    .map((col) => col.name);
}

function summarizeTable(conn, table) {
  const columns = conn.prepare(`PRAGMA table_info(${JSON.stringify(table)})`).all();
  const rowCount = conn.prepare(`SELECT COUNT(*) AS count FROM ${JSON.stringify(table)}`).get().count;
  const sample = conn
    .prepare(`SELECT * FROM ${JSON.stringify(table)} LIMIT ?`)
    .all(MAX_SAMPLE_ROWS)
    .map(sanitizeRow);
  return {
    rowCount,
    columns: columns.map((col) => `${col.name} ${col.type || 'TEXT'}`.trim()),
    sample,
  };
}

// Defensive rollups for the Phase 2 audit: each one checks that the table and
// columns exist first, so partial/legacy databases degrade gracefully.
function buildHighlights(conn) {
  const highlights = {};
  const has = (table) => tableExists(conn, table);
  const hasCols = (table, cols) => {
    if (!has(table)) return false;
    const names = new Set(columnNames(conn, table));
    return cols.every((col) => names.has(col));
  };

  if (hasCols('pages', ['slug'])) {
    highlights.pages = conn
      .prepare('SELECT id, slug, title_zh, title_en FROM pages ORDER BY id')
      .all();
  }

  if (hasCols('news', ['is_published'])) {
    highlights.newsByPublishState = conn
      .prepare('SELECT is_published, COUNT(*) AS count FROM news GROUP BY is_published')
      .all();
    if (hasCols('news', ['published_at'])) {
      highlights.newsByYear = conn
        .prepare(
          "SELECT COALESCE(strftime('%Y', published_at), 'undated') AS year, COUNT(*) AS count " +
            'FROM news GROUP BY year ORDER BY year DESC'
        )
        .all();
    }
    if (hasCols('news', ['category'])) {
      highlights.newsByCategory = conn
        .prepare("SELECT COALESCE(NULLIF(category, ''), 'uncategorized') AS category, COUNT(*) AS count FROM news GROUP BY category ORDER BY count DESC")
        .all();
    }
  }

  if (hasCols('media', ['mime_type', 'size'])) {
    highlights.mediaByType = conn
      .prepare('SELECT mime_type, COUNT(*) AS count, SUM(size) AS totalBytes FROM media GROUP BY mime_type ORDER BY count DESC')
      .all();
  }

  if (has('admins')) {
    highlights.adminCount = conn.prepare('SELECT COUNT(*) AS count FROM admins').get().count;
  }

  if (hasCols('contact_messages', ['is_read'])) {
    highlights.unreadContactMessages = conn
      .prepare('SELECT COUNT(*) AS count FROM contact_messages WHERE is_read = 0')
      .get().count;
  }

  for (const table of ['banners', 'announcements', 'partners', 'team_members', 'milestones', 'stats', 'events']) {
    if (hasCols(table, ['is_active'])) {
      const row = conn
        .prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active FROM ${JSON.stringify(table)}`)
        .get();
      highlights[`${table}Active`] = { total: row.total, active: row.active || 0 };
    }
  }

  return highlights;
}

function main() {
  const dbPath = parseArgs(process.argv.slice(2)) || resolveDbPath();

  if (!fs.existsSync(dbPath)) {
    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          status: 'no_database',
          dbPath,
          message:
            'Database file not found. Nothing to inventory yet — start the backend once or point HKBA_DB_PATH / --db at an existing database.',
        },
        null,
        2
      ) + '\n'
    );
    return;
  }

  let conn;
  try {
    conn = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch (error) {
    process.stdout.write(
      JSON.stringify({ ok: false, status: 'open_failed', dbPath, error: error.message }, null, 2) + '\n'
    );
    process.exitCode = 1;
    return;
  }

  try {
    const tables = conn
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => row.name);

    const contentTables = tables.filter((name) => !SYSTEM_TABLES.has(name));
    const inventory = {
      ok: true,
      status: 'ok',
      dbPath,
      generatedAt: new Date().toISOString(),
      tableCount: contentTables.length,
      tables: {},
      migrations: tables.includes('schema_migrations')
        ? conn.prepare('SELECT name, applied_at FROM schema_migrations ORDER BY name').all()
        : null,
      highlights: buildHighlights(conn),
    };

    for (const table of contentTables) {
      inventory.tables[table] = summarizeTable(conn, table);
    }

    process.stdout.write(JSON.stringify(inventory, null, 2) + '\n');
  } finally {
    conn.close();
  }
}

main();
