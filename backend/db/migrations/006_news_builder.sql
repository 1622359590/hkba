-- 006_news_builder.sql
-- HKBA Phase 2 M1: componentized news entity, revisions, body blocks and
-- taxonomy (spec: data-api §2.4-2.5).
--
-- News is a single content entity (D7): pages store query conditions, never
-- copied article bodies. The legacy `news` table stays untouched (D5) and
-- bridges through legacy_id_map during content migration. Body blocks carry
-- the same revision number as the metadata revision they publish with.
--
-- DDL-level constraints:
-- - slug unique; status enum; display_year must be a four-digit year.
-- - one `news.header` block per news per revision (partial unique index).
-- App-level rules (backend/lib/newsYear.js, blockTree.js): displayYear
-- fallback to year(publishedAt), header presence validation.

CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_zh TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  summary_zh TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  cover_media_id TEXT REFERENCES media_assets(id),
  author_id INTEGER,
  published_at TEXT,
  display_year INTEGER CHECK (display_year IS NULL OR display_year BETWEEN 1000 AND 9999),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'published', 'withdrawn', 'trash')),
  current_draft_revision INTEGER,
  published_revision INTEGER,
  seo TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_news_items_status ON news_items(status, published_at);
CREATE INDEX IF NOT EXISTS idx_news_items_display_year ON news_items(display_year);

CREATE TABLE IF NOT EXISTS news_revisions (
  id TEXT PRIMARY KEY,
  news_id TEXT NOT NULL REFERENCES news_items(id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'superseded')),
  snapshot TEXT NOT NULL DEFAULT '{}',
  source_revision_id TEXT REFERENCES news_revisions(id),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_by INTEGER,
  published_at TEXT,
  UNIQUE (news_id, revision)
);

CREATE TABLE IF NOT EXISTS news_blocks (
  id TEXT PRIMARY KEY,
  news_id TEXT NOT NULL REFERENCES news_items(id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  block_type TEXT NOT NULL,
  block_version INTEGER NOT NULL DEFAULT 1 CHECK (block_version > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  content_zh TEXT NOT NULL DEFAULT '{}',
  content_en TEXT NOT NULL DEFAULT '{}',
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_news_blocks_news ON news_blocks(news_id, revision, sort_order);
-- Exactly one header block per news per revision (spec: component-catalog §3.1).
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_blocks_single_header
  ON news_blocks(news_id, revision) WHERE block_type = 'news.header';

CREATE TABLE IF NOT EXISTS news_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  parent_id TEXT REFERENCES news_categories(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS news_tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Categories and tags use association tables, never free-text arrays (§2.4).
CREATE TABLE IF NOT EXISTS news_category_map (
  news_id TEXT NOT NULL REFERENCES news_items(id),
  category_id TEXT NOT NULL REFERENCES news_categories(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (news_id, category_id)
);

CREATE TABLE IF NOT EXISTS news_tag_map (
  news_id TEXT NOT NULL REFERENCES news_items(id),
  tag_id TEXT NOT NULL REFERENCES news_tags(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (news_id, tag_id)
);
