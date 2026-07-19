// Session cookie helpers (spec: data-api §13, main design §12).
//
// The session cookie carries the same JWT as the legacy Bearer flow. It is
// HttpOnly (never readable from JS), SameSite=Lax, and Secure in production.
// Zero-dependency: serialization and parsing are hand-rolled so they can be
// unit-tested without Express. JWTs are base64url, safe in cookie values.

const SESSION_COOKIE = 'hkba_admin';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // matches the 7d JWT expiry

function parseCookieHeader(header) {
  const cookies = {};
  if (!header || typeof header !== 'string') return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    cookies[name] = part.slice(index + 1).trim();
  }
  return cookies;
}

function serializeSessionCookie(token, options = {}) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

function serializeSessionClearCookie(options = {}) {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'SameSite=Lax',
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

module.exports = {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  parseCookieHeader,
  serializeSessionCookie,
  serializeSessionClearCookie,
};
