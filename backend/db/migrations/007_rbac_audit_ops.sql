-- 007_rbac_audit_ops.sql
-- HKBA Phase 2 M1: roles & permissions, audit log, and operational tables
-- (spec: data-api §2.8, §10-12; main design §12; acceptance §10).
--
-- Admin accounts stay in the legacy `admins` table (integer IDs) for now;
-- user_roles.user_id, audit_events.actor_id and created_by columns reference
-- those integer IDs and bridge through legacy_id_map when a dedicated
-- AdminUser table arrives in a later milestone.
--
-- preview_tokens store a hash of the preview token, never the raw token.
-- publish_records is the per-object publish/withdraw/rollback journal written
-- inside the publish transaction (data-api §10 step 5).
-- cleanup_tasks records retention/cleanup runs with auditable results
-- (data-api §12).

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id),
  permission_id TEXT NOT NULL REFERENCES permissions(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id INTEGER,
  actor_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL DEFAULT '',
  request_id TEXT NOT NULL DEFAULT '',
  before_summary TEXT NOT NULL DEFAULT '',
  after_summary TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_events_object ON audit_events(object_type, object_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at);

CREATE TABLE IF NOT EXISTS preview_tokens (
  id TEXT PRIMARY KEY,
  object_type TEXT NOT NULL CHECK (object_type IN ('page', 'news')),
  object_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  token_hash TEXT NOT NULL UNIQUE,
  created_by INTEGER,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_preview_tokens_object ON preview_tokens(object_type, object_id);

CREATE TABLE IF NOT EXISTS redirects (
  id TEXT PRIMARY KEY,
  from_path TEXT NOT NULL UNIQUE,
  to_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302)),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS publish_records (
  id TEXT PRIMARY KEY,
  object_type TEXT NOT NULL CHECK (object_type IN ('page', 'news')),
  object_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  action TEXT NOT NULL CHECK (action IN ('publish', 'withdraw', 'rollback')),
  actor_id INTEGER,
  checks_report TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_publish_records_object ON publish_records(object_type, object_id, created_at);

CREATE TABLE IF NOT EXISTS cleanup_tasks (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'failed')),
  summary TEXT NOT NULL DEFAULT '{}',
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cleanup_tasks_status ON cleanup_tasks(status, created_at);
