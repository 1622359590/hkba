const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveInitialAdminPassword } = require('./init');

function withEnvironment(values, callback) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD,
  };

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('uses the configured initial administrator password', () => {
  withEnvironment(
    { NODE_ENV: 'production', ADMIN_INITIAL_PASSWORD: 'production-password-123' },
    () => assert.equal(resolveInitialAdminPassword(), 'production-password-123')
  );
});

test('keeps the legacy password fallback outside production', () => {
  withEnvironment(
    { NODE_ENV: 'development', ADMIN_INITIAL_PASSWORD: undefined },
    () => assert.equal(resolveInitialAdminPassword(), 'hkba2024')
  );
});

test('requires an initial administrator password in production', () => {
  withEnvironment(
    { NODE_ENV: 'production', ADMIN_INITIAL_PASSWORD: undefined },
    () => assert.throws(resolveInitialAdminPassword, /at least 12 characters/)
  );
});

test('rejects a short initial administrator password in production', () => {
  withEnvironment(
    { NODE_ENV: 'production', ADMIN_INITIAL_PASSWORD: 'too-short' },
    () => assert.throws(resolveInitialAdminPassword, /at least 12 characters/)
  );
});
