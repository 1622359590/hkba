-- 010_mutation_owner.sql
-- HKBA Phase 2 M5: generalize mutation_log to any draft owner (spec: data-api
-- §8 — the same idempotency protocol guards news draft mutations, not only
-- page drafts). 009 predates production deployment, so a column rename is the
-- honest shape; SQLite rewrites dependent indexes automatically.

ALTER TABLE mutation_log RENAME COLUMN page_id TO owner_id;
