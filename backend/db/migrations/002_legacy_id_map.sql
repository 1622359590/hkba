-- 002_legacy_id_map.sql
-- HKBA Phase 2 M1: bridge table between legacy integer IDs and new TEXT UUIDs.
--
-- Approved decision D3: new tables use TEXT UUID primary keys; legacy tables
-- keep integer IDs; this map records every old -> new entity translation so
-- content migrations can re-run without duplicating inserts.

CREATE TABLE IF NOT EXISTS legacy_id_map (
  id TEXT PRIMARY KEY,
  old_table TEXT NOT NULL,
  old_id INTEGER NOT NULL,
  new_table TEXT NOT NULL,
  new_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('pending', 'done', 'failed')),
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (old_table, old_id, new_table)
);

CREATE INDEX IF NOT EXISTS idx_legacy_id_map_new ON legacy_id_map(new_table, new_id);
