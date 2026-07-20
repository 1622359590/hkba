#!/usr/bin/env node

function safeUrl(value) {
  const url = new URL(value);
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.toString();
}

function endpoint(baseUrl, pathname) {
  const base = new URL(baseUrl);
  base.pathname = pathname;
  base.search = '';
  base.hash = '';
  return base.toString();
}

async function probeUrl(url, { expectHealth = false, timeoutMs = 5000, fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: expectHealth ? 'application/json' : 'text/html,*/*' },
  });

  if (response.status !== 200) {
    await response.arrayBuffer();
    throw new Error(`${safeUrl(url)} returned HTTP ${response.status}`);
  }

  if (expectHealth) {
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`${safeUrl(url)} returned an invalid health payload`);
    }
    if (!body || body.status !== 'ok') {
      throw new Error(`${safeUrl(url)} returned an unhealthy health payload`);
    }
  } else {
    await response.arrayBuffer();
  }

  return { url: safeUrl(url), status: response.status };
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runSmoke({
  frontendUrl,
  backendUrl,
  attempts = 6,
  delayMs = 2000,
  timeoutMs = 5000,
  fetchImpl = globalThis.fetch,
  logger = console,
}) {
  if (!frontendUrl || !backendUrl) {
    throw new Error('frontendUrl and backendUrl are required');
  }
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error('attempts must be a positive integer');
  }

  const checks = [
    { name: 'frontend', url: endpoint(frontendUrl, '/'), expectHealth: false },
    { name: 'backend health', url: endpoint(backendUrl, '/api/health'), expectHealth: true },
    { name: 'proxied health', url: endpoint(frontendUrl, '/api/health'), expectHealth: true },
  ];
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      for (const check of checks) {
        await probeUrl(check.url, {
          expectHealth: check.expectHealth,
          timeoutMs,
          fetchImpl,
        });
      }
      logger.info(`Deployment smoke passed on attempt ${attempt}: ${checks.map((check) => check.name).join(', ')}`);
      return { attempt, checks: checks.map((check) => check.name) };
    } catch (error) {
      lastError = error;
      logger.warn(`Deployment smoke attempt ${attempt}/${attempts} failed: ${error.message}`);
      if (attempt < attempts) await sleep(delayMs);
    }
  }

  throw new Error(`deployment smoke failed after ${attempts} attempts: ${lastError.message}`);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name || !name.startsWith('--') || value === undefined) {
      throw new Error(`invalid argument near ${name || '<end>'}`);
    }
    values[name.slice(2)] = value;
  }
  return {
    frontendUrl: values['frontend-url'],
    backendUrl: values['backend-url'],
    attempts: values.attempts === undefined ? 6 : Number(values.attempts),
    delayMs: values['delay-ms'] === undefined ? 2000 : Number(values['delay-ms']),
  };
}

async function main() {
  try {
    await runSmoke(parseArguments(process.argv.slice(2)));
  } catch (error) {
    console.error(`Deployment smoke failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { endpoint, parseArguments, probeUrl, runSmoke, safeUrl };
