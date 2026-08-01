-- Immutable automatic snapshots for page drafts. These records are separate
-- from page_versions so they never participate in publish pointers.
CREATE TABLE IF NOT EXISTS page_draft_snapshots (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES page_nodes(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  source_version_id TEXT,
  seo TEXT NOT NULL DEFAULT '{}',
  change_summary TEXT NOT NULL DEFAULT '{}',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (page_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_page_draft_snapshots_page
  ON page_draft_snapshots(page_id, revision DESC);

CREATE TABLE IF NOT EXISTS page_draft_snapshot_blocks (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES page_draft_snapshots(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL,
  component_type TEXT NOT NULL,
  component_version INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  parent_block_id TEXT,
  is_visible INTEGER NOT NULL DEFAULT 1,
  anchor_id TEXT,
  content_zh TEXT NOT NULL DEFAULT '{}',
  content_en TEXT NOT NULL DEFAULT '{}',
  settings TEXT NOT NULL DEFAULT '{}',
  UNIQUE (snapshot_id, block_id)
);

CREATE INDEX IF NOT EXISTS idx_page_draft_snapshot_blocks_snapshot
  ON page_draft_snapshot_blocks(snapshot_id, sort_order);
