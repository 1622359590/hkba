// Media reference extraction & sync (spec: data-api §2.6; decision D8).
//
// Components reference media by stable asset ID inside their config JSON.
// The registry marks those schema fields with `media: true`; this module
// walks a block's content/settings against its definition to extract the
// referenced IDs and keeps media_references in sync with the owning block.
// media_references powers the delete-protection rule (referenced assets
// cannot be permanently deleted) and the "where is this asset used" view.

const crypto = require('crypto');

function collect(fields, config, out) {
  if (!fields || config == null || typeof config !== 'object') return;
  for (const [name, spec] of Object.entries(fields)) {
    const value = config[name];
    if (value == null) continue;
    if (spec.media && typeof value === 'string' && value) {
      out.add(value);
    } else if (spec.type === 'object' && spec.fields) {
      collect(spec.fields, value, out);
    } else if (spec.type === 'array' && spec.item && Array.isArray(value)) {
      if (spec.item.media) {
        for (const entry of value) {
          if (typeof entry === 'string' && entry) out.add(entry);
        }
      } else if (spec.item.type === 'object' && spec.item.fields) {
        for (const entry of value) collect(spec.item.fields, entry, out);
      }
    }
  }
}

// Extracts every media asset ID referenced by a block config. Returns a
// deduplicated array (order-stable: contentZh, contentEn, then settings).
function extractMediaIds(definition, { contentZh = {}, contentEn = {}, settings = {} }) {
  const out = new Set();
  const contentFields = definition?.schema?.content?.fields;
  const settingsFields = definition?.schema?.settings?.fields;
  collect(contentFields, contentZh, out);
  collect(contentFields, contentEn, out);
  collect(settingsFields, settings, out);
  return [...out];
}

// Replaces the reference rows owned by one block with the IDs found in its
// config. Runs inside the caller's transaction (block mutations in
// routes/admin/pages.js). Unknown asset IDs are still recorded: the
// uniqueness is on (media_id, ref_type, ref_id) and delete protection
// applies to whatever the config points at, but dangling IDs are skipped to
// keep the FK intact.
function syncBlockReferences(conn, { blockId, refType = 'page_block', definition, config }) {
  conn.prepare('DELETE FROM media_references WHERE ref_type = ? AND ref_id = ?').run(refType, blockId);
  const ids = extractMediaIds(definition, config);
  if (!ids.length) return [];
  const existing = new Set(
    conn
      .prepare(`SELECT id FROM media_assets WHERE id IN (${ids.map(() => '?').join(',')})`)
      .all(...ids)
      .map((row) => row.id)
  );
  const insert = conn.prepare(
    'INSERT OR IGNORE INTO media_references (id, media_id, ref_type, ref_id) VALUES (?, ?, ?, ?)'
  );
  const kept = [];
  for (const mediaId of ids) {
    if (!existing.has(mediaId)) continue;
    insert.run(crypto.randomUUID(), mediaId, refType, blockId);
    kept.push(mediaId);
  }
  return kept;
}

function clearBlockReferences(conn, blockId, refType = 'page_block') {
  conn.prepare('DELETE FROM media_references WHERE ref_type = ? AND ref_id = ?').run(refType, blockId);
}

module.exports = { extractMediaIds, syncBlockReferences, clearBlockReferences };
