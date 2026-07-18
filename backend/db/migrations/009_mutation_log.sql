-- 009_mutation_log.sql
-- HKBA Phase 2 M3: idempotency log for draft autosave mutations
-- (spec: data-api §4 — clients send mutationId; retries must not double-apply).

CREATE TABLE IF NOT EXISTS mutation_log (
  id TEXT PRIMARY KEY,
  mutation_id TEXT NOT NULL UNIQUE,
  page_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  response TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mutation_log_page ON mutation_log(page_id, created_at);
