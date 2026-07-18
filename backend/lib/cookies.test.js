const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  parseCookieHeader,
  serializeSessionCookie,
  serializeSessionClearCookie,
} = require('./cookies');

test('parseCookieHeader parses pairs and tolerates noise', () => {
  assert.deepEqual(parseCookieHeader('a=1; hkba_admin=token.abc-123; b=2'), {
    a: '1',
    hkba_admin: 'token.abc-123',
    b: '2',
  });
  assert.deepEqual(parseCookieHeader(''), {});
  assert.deepEqual(parseCookieHeader(undefined), {});
  assert.deepEqual(parseCookieHeader('orphan; =x; ok=1'), { ok: '1' });
  // Values may themselves contain '='
  assert.equal(parseCookieHeader('jwt=ab.cd==').jwt, 'ab.cd==');
});

test('serializeSessionCookie sets the M2 flags', () => {
  const cookie = serializeSessionCookie('token123', { secure: false });
  assert.ok(cookie.startsWith(`${SESSION_COOKIE}=token123`));
  assert.ok(cookie.includes('Path=/'));
  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes(`Max-Age=${SESSION_MAX_AGE_SECONDS}`));
  assert.ok(cookie.includes('SameSite=Lax'));
  assert.ok(!cookie.includes('Secure'));
  assert.equal(SESSION_MAX_AGE_SECONDS, 7 * 24 * 60 * 60);
});

test('serializeSessionCookie adds Secure in production mode', () => {
  assert.ok(serializeSessionCookie('t', { secure: true }).includes('Secure'));
});

test('serializeSessionClearCookie expires the cookie immediately', () => {
  const cookie = serializeSessionClearCookie({ secure: true });
  assert.ok(cookie.startsWith(`${SESSION_COOKIE}=;`));
  assert.ok(cookie.includes('Max-Age=0'));
  assert.ok(cookie.includes('Secure'));
});
