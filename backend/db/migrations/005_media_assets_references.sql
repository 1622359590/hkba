-- 005_media_assets_references.sql
-- HKBA Phase 2 M1: media assets and reference tracking (spec: data-api §2.6).
--
-- Components reference media by stable asset ID, never by transient upload
-- URL (D8). The legacy `media` table stays untouched; imported assets bridge
-- through legacy_id_map. `checksum` supports deduplication on import;
-- media_references powers the delete-protection rule (assets referenced by a
-- published version cannot be permanently deleted).

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  width INTEGER CHECK (width IS NULL OR width >= 0),
  height INTEGER CHECK (height IS NULL OR height >= 0),
  checksum TEXT,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'active', 'failed', 'trash')),
  alt_zh TEXT NOT NULL DEFAULT '',
  alt_en TEXT NOT NULL DEFAULT '',
  caption_zh TEXT NOT NULL DEFAULT '',
  caption_en TEXT NOT NULL DEFAULT '',
  variants TEXT NOT NULL DEFAULT '[]',
  uploaded_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_media_assets_checksum ON media_assets(checksum);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON media_assets(status);

CREATE TABLE IF NOT EXISTS media_references (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL REFERENCES media_assets(id),
  ref_type TEXT NOT NULL CHECK (ref_type IN (
    'page_version',
    'page_block',
    'news_revision',
    'news_block',
    'news_cover',
    'site_setting'
  )),
  ref_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (media_id, ref_type, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_media_references_media ON media_references(media_id);
