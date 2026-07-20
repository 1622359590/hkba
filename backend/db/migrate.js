// Versioned SQLite migrations for the HKBA backend.
//
// Migrations are plain `.sql` files in `migrations/`, named `NNN_description.sql`
// and applied once, in filename order. Applied migrations are recorded in the
// `schema_migrations` table (name TEXT PRIMARY KEY, applied_at TEXT).
//
// Baseline rule: `001_baseline.sql` absorbs the pre-migration schema. A
// database that already has the legacy `admins` table but an empty
// `schema_migrations` table is treated as a pre-migration (legacy) database:
// the baseline is recorded as applied WITHOUT being executed, because its
// tables already exist. All later migrations still run normally. Fresh
// databases execute every migration from the start.

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const BASELINE_MARKER_TABLE = 'admins';
const MIGRATION_FILE_PATTERN = /^\d+_.+\.sql$/;

function ensureMigrationsTable(conn) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
}

function listMigrationFiles(migrationsDir = MIGRATIONS_DIR) {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => MIGRATION_FILE_PATTERN.test(file))
    .sort();
}

function hasTable(conn, table) {
  return Boolean(
    conn
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table)
  );
}

function appliedMigrations(conn) {
  return new Set(
    conn
      .prepare('SELECT name FROM schema_migrations')
      .all()
      .map((row) => row.name)
  );
}

function recordMigration(conn, name) {
  conn
    .prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')
    .run(name, new Date().toISOString());
}

function applyMigrationFile(conn, migrationsDir, name) {
  const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8');
  const apply = conn.transaction(() => {
    conn.exec(sql);
    recordMigration(conn, name);
  });
  apply();
}

// Applies every pending migration in order.
// Returns { applied, baselined, alreadyApplied } with migration file names:
// - applied: migrations executed by this call.
// - baselined: baseline recorded without execution (legacy database), or null.
// - alreadyApplied: migrations already recorded before this call.
function migrate(conn, options = {}) {
  const migrationsDir = options.migrationsDir || MIGRATIONS_DIR;

  ensureMigrationsTable(conn);

  const files = listMigrationFiles(migrationsDir);
  const done = appliedMigrations(conn);

  let baselined = null;
  if (done.size === 0 && files.length > 0 && hasTable(conn, BASELINE_MARKER_TABLE)) {
    // Legacy database created before schema_migrations existed. The baseline
    // schema is already in place, so record it instead of re-running it.
    recordMigration(conn, files[0]);
    done.add(files[0]);
    baselined = files[0];
  }

  const alreadyApplied = files.filter((file) => done.has(file));
  const applied = [];
  for (const file of files) {
    if (done.has(file)) continue;
    applyMigrationFile(conn, migrationsDir, file);
    applied.push(file);
  }

  return { applied, baselined, alreadyApplied };
}

module.exports = {
  migrate,
  ensureMigrationsTable,
  listMigrationFiles,
  hasTable,
  MIGRATIONS_DIR,
  BASELINE_MARKER_TABLE,
};
