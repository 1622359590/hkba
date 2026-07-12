#!/usr/bin/env bash

set -euo pipefail

db_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
backend_dir=$(cd "$db_dir/.." && pwd)
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$tmp_dir/db"
cp "$db_dir/init.js" "$db_dir/schema.sql" "$db_dir/seed.js" "$tmp_dir/db/"

NODE_PATH="$backend_dir/node_modules" node "$tmp_dir/db/seed.js" >/dev/null

NODE_PATH="$backend_dir/node_modules" node - "$tmp_dir/db/hkba.db" <<'NODE'
const Database = require('better-sqlite3');

const db = new Database(process.argv[2], { readonly: true });
const requiredTables = ['admins', 'banners', 'team_members', 'partners', 'news'];

for (const table of requiredTables) {
  const exists = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get(table);
  if (!exists) throw new Error(`Missing table: ${table}`);
}

const bannerCount = db.prepare('SELECT COUNT(*) AS count FROM banners').get().count;
if (bannerCount === 0) throw new Error('Seed did not insert banners');

db.close();
NODE

printf 'First-deploy database seed test passed.\n'
