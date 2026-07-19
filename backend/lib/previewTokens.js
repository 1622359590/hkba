// Preview tokens (spec: data-api §11).
//
// Tokens bind object + revision + creator + expiry (default 30 minutes).
// The database stores only a sha256 hash; the raw token is returned once at
// creation. Resolution is constant-time-ish: hash lookup, then expiry check.

const crypto = require('crypto');

const DEFAULT_TTL_MINUTES = 30;

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// createPreviewToken(conn, { objectType, objectId, revision, createdBy, ttlMinutes })
// Returns { token, expiresAt }.
function createPreviewToken(conn, { objectType, objectId, revision, createdBy, ttlMinutes = DEFAULT_TTL_MINUTES }) {
  const raw = `hkba_prev_${crypto.randomUUID()}${crypto.randomBytes(12).toString('hex')}`;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
  conn
    .prepare(
      'INSERT INTO preview_tokens (id, object_type, object_id, revision, token_hash, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(crypto.randomUUID(), objectType, objectId, revision, hashToken(raw), createdBy, expiresAt);
  return { token: raw, expiresAt };
}

// resolvePreviewToken(conn, raw) — the token row when valid and unexpired,
// else null.
function resolvePreviewToken(conn, raw) {
  if (typeof raw !== 'string' || !raw.startsWith('hkba_prev_')) return null;
  const row = conn.prepare('SELECT * FROM preview_tokens WHERE token_hash = ?').get(hashToken(raw));
  if (!row) return null;
  // expires_at is stored as naive UTC; parse it as UTC explicitly.
  let text = String(row.expires_at).trim().replace(' ', 'T');
  if (text.length > 10 && !/([zZ]|[+-]\d{2}:?\d{2})$/.test(text)) text += 'Z';
  const expires = Date.parse(text);
  if (Number.isNaN(expires) || expires <= Date.now()) return null;
  return row;
}

module.exports = { DEFAULT_TTL_MINUTES, createPreviewToken, resolvePreviewToken, hashToken };
