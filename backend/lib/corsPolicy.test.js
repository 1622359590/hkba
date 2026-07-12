const test = require('node:test');
const assert = require('node:assert/strict');

const { isOriginAllowed } = require('./corsPolicy');

test('allows requests without an Origin header', () => {
  assert.equal(isOriginAllowed({
    origin: undefined,
    allowedOrigins: [],
    host: '127.0.0.1:37900',
    forwardedHost: '',
  }), true);
});

test('allows an explicitly configured origin', () => {
  assert.equal(isOriginAllowed({
    origin: 'https://partner.example',
    allowedOrigins: ['https://partner.example'],
    host: '127.0.0.1:37900',
    forwardedHost: '',
  }), true);
});

test('allows the public origin when it matches the forwarded host', () => {
  assert.equal(isOriginAllowed({
    origin: 'https://hkba.btcsam.com',
    allowedOrigins: [],
    host: '127.0.0.1:37900',
    forwardedHost: 'hkba.btcsam.com',
  }), true);
});

test('allows the public origin when it matches the Next.js proxy host', () => {
  assert.equal(isOriginAllowed({
    origin: 'https://hkba.btcsam.com',
    allowedOrigins: [],
    host: '127.0.0.1:37900',
    forwardedHost: '127.0.0.1:37900',
    proxyHost: 'hkba.btcsam.com',
  }), true);
});

test('allows browser-verified same-origin requests behind a host-rewriting proxy', () => {
  assert.equal(isOriginAllowed({
    origin: 'https://hkba.btcsam.com',
    allowedOrigins: [],
    host: '127.0.0.1:37900',
    forwardedHost: '127.0.0.1:37900',
    proxyHost: '127.0.0.1:3000',
    fetchSite: 'same-origin',
  }), true);
});

test('allows the public origin when it matches the direct host', () => {
  assert.equal(isOriginAllowed({
    origin: 'https://hkba.btcsam.com',
    allowedOrigins: [],
    host: 'hkba.btcsam.com',
    forwardedHost: '',
  }), true);
});

test('uses the first forwarded host supplied by a trusted proxy chain', () => {
  assert.equal(isOriginAllowed({
    origin: 'https://hkba.btcsam.com',
    allowedOrigins: [],
    host: '127.0.0.1:37900',
    forwardedHost: 'hkba.btcsam.com, internal-proxy',
  }), true);
});

test('rejects an unrelated origin', () => {
  assert.equal(isOriginAllowed({
    origin: 'https://attacker.example',
    allowedOrigins: ['https://hkba.btcsam.com'],
    host: 'hkba.btcsam.com',
    forwardedHost: '',
  }), false);
});

test('rejects a malformed origin', () => {
  assert.equal(isOriginAllowed({
    origin: 'not a URL',
    allowedOrigins: [],
    host: 'hkba.btcsam.com',
    forwardedHost: '',
  }), false);
});
