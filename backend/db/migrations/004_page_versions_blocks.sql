-- 004_page_versions_blocks.sql
-- HKBA Phase 2 M1: page versions and page blocks (spec: data-api §2.2-2.3).
--
-- Chinese and English content live in the same version so one publish swaps
-- both languages atomically (D9). Blocks carry schema-validated JSON configs;
-- parent_block_id nesting rules (max two levels, parents must be layout
-- components) are enforced by backend/lib/blockTree.js.

CREATE TABLE IF NOT EXISTS page_versions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES page_nodes(id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'superseded')),
  seo TEXT NOT NULL DEFAULT '{}',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_by INTEGER,
  published_at TEXT,
  source_version_id TEXT REFERENCES page_versions(id),
  UNIQUE (page_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_page_versions_page ON page_versions(page_id, status);

CREATE TABLE IF NOT EXISTS page_blocks (
  id TEXT PRIMARY KEY,
  page_version_id TEXT NOT NULL REFERENCES page_versions(id),
  component_type TEXT NOT NULL,
  component_version INTEGER NOT NULL DEFAULT 1 CHECK (component_version > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  parent_block_id TEXT REFERENCES page_blocks(id),
  is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
  anchor_id TEXT,
  content_zh TEXT NOT NULL DEFAULT '{}',
  content_en TEXT NOT NULL DEFAULT '{}',
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_page_blocks_version ON page_blocks(page_version_id, sort_order);
-- Anchors are unique inside a page version when present.
CREATE UNIQUE INDEX IF NOT EXISTS idx_page_blocks_anchor
  ON page_blocks(page_version_id, anchor_id) WHERE anchor_id IS NOT NULL;
