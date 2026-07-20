-- 008_audit_events_user_agent.sql
-- HKBA Phase 2 M2: add user_agent to audit_events (spec: data-api §13 expects
-- IP/session context in the audit log; user agent complements it).
--
-- Expand-phase change: additive nullable-safe column, no data rewrite.
-- Note: SQLite has no ADD COLUMN IF NOT EXISTS; single application is
-- guaranteed by schema_migrations (unlike the pure-DDL idempotent files).

ALTER TABLE audit_events ADD COLUMN user_agent TEXT NOT NULL DEFAULT '';
