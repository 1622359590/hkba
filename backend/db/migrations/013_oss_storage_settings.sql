CREATE TABLE IF NOT EXISTS storage_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  provider TEXT NOT NULL DEFAULT 'local' CHECK (provider IN ('local', 'oss')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  region TEXT NOT NULL DEFAULT '',
  endpoint TEXT NOT NULL DEFAULT '',
  bucket TEXT NOT NULL DEFAULT '',
  access_key_id_enc TEXT NOT NULL DEFAULT '',
  access_key_secret_enc TEXT NOT NULL DEFAULT '',
  custom_domain TEXT NOT NULL DEFAULT '',
  object_prefix TEXT NOT NULL DEFAULT 'hkba/media',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO storage_settings (id) VALUES (1);

ALTER TABLE media_assets ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'local';
ALTER TABLE media_assets ADD COLUMN public_url TEXT;
