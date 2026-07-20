const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { probeUrl, runSmoke, safeUrl } = require('./deploy-smoke');

async function listen(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

function healthResponse(response, status = 200, body = { status: 'ok' }) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

test('safeUrl removes credentials, query parameters, and fragments', () => {
  assert.equal(
    safeUrl('https://deploy-user:deploy-pass@example.test:8443/api/health?token=secret#result'),
    'https://example.test:8443/api/health'
  );
});

test('probeUrl validates successful health JSON', async () => {
  const target = await listen((request, response) => {
    if (request.url === '/api/health') return healthResponse(response);
    response.writeHead(404).end();
  });

  try {
    const result = await probeUrl(`${target.url}/api/health`, { expectHealth: true });
    assert.equal(result.status, 200);
  } finally {
    await target.close();
  }
});

test('probeUrl rejects a health response without status ok', async () => {
  const target = await listen((_request, response) => healthResponse(response, 200, { status: 'starting' }));

  try {
    await assert.rejects(
      probeUrl(`${target.url}/api/health`, { expectHealth: true }),
      /health payload/
    );
  } finally {
    await target.close();
  }
});

test('runSmoke retries and checks frontend, backend, and proxied health', async () => {
  let backendHealthCalls = 0;
  const backend = await listen((request, response) => {
    if (request.url !== '/api/health') return response.writeHead(404).end();
    backendHealthCalls += 1;
    if (backendHealthCalls === 1) return healthResponse(response, 503, { status: 'starting' });
    return healthResponse(response);
  });
  const frontend = await listen((request, response) => {
    if (request.url === '/api/health') return healthResponse(response);
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<!doctype html><title>HKBA</title>');
  });

  try {
    const result = await runSmoke({
      frontendUrl: frontend.url,
      backendUrl: backend.url,
      attempts: 2,
      delayMs: 1,
      logger: { info() {}, warn() {} },
    });
    assert.equal(result.attempt, 2);
    assert.equal(backendHealthCalls, 2);
  } finally {
    await frontend.close();
    await backend.close();
  }
});

test('runSmoke stops after the configured attempt count', async () => {
  let calls = 0;
  const unavailable = await listen((_request, response) => {
    calls += 1;
    healthResponse(response, 503, { status: 'unavailable' });
  });

  try {
    await assert.rejects(
      runSmoke({
        frontendUrl: unavailable.url,
        backendUrl: unavailable.url,
        attempts: 2,
        delayMs: 1,
        logger: { info() {}, warn() {} },
      }),
      /failed after 2 attempts/
    );
    assert.equal(calls, 2);
  } finally {
    await unavailable.close();
  }
});
