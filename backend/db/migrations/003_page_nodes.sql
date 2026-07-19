-- 003_page_nodes.sql
-- HKBA Phase 2 M1: page/section identity nodes (spec: data-api §2.1).
--
-- Page identity is separated from page versions (D2). New table uses TEXT
-- UUID primary keys (D3); the legacy `pages` table stays untouched and will
-- be bridged through legacy_id_map.
--
-- DDL-level constraints:
-- - path is unique site-wide.
-- - slug is unique per parent (COALESCE expression index also covers roots).
-- - node_type / navigation_status are CHECK-constrained.
-- App-level rules (backend/lib/pageTree.js): max depth 3, no cycles,
-- external sections cannot carry blocks.

CREATE TABLE IF NOT EXISTS page_nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES page_nodes(id),
  node_type TEXT NOT NULL CHECK (node_type IN ('section', 'page')),
  slug TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  title_zh TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  navigation_status TEXT NOT NULL DEFAULT 'visible'
    CHECK (navigation_status IN ('visible', 'hidden', 'external')),
  external_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_version_id TEXT,
  draft_version_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_page_nodes_parent ON page_nodes(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_page_nodes_slug_per_parent
  ON page_nodes(COALESCE(parent_id, ''), slug);
CREATE INDEX IF NOT EXISTS idx_page_nodes_deleted ON page_nodes(deleted_at);
