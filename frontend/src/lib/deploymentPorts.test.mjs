import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('active development and deployment defaults use frontend 5001 and backend 5002', async () => {
  const [packageJson, nextConfig, backendServer, deployResolver] = await Promise.all([
    readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../../next.config.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../../backend/server.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../.github/scripts/resolve-deploy-bundle.sh', import.meta.url), 'utf8'),
  ]);
  const deployWorkflow = await readFile(
    new URL('../../../.github/workflows/deploy-baota.yml', import.meta.url),
    'utf8',
  );

  const scripts = JSON.parse(packageJson).scripts;
  assert.match(scripts.dev, /-p 5001/);
  assert.match(scripts['dev:turbo'], /-p 5001/);
  assert.match(nextConfig, /http:\/\/127\.0\.0\.1:5002/);
  assert.match(backendServer, /process\.env\.PORT \|\| 5002/);
  assert.match(deployResolver, /BACKEND_PORT[^\n]*'5002'/);
  assert.match(deployResolver, /FRONTEND_PORT[^\n]*'5001'/);
  assert.match(deployWorkflow, /HKBA_API_INTERNAL="http:\/\/127\.0\.0\.1:\$BACKEND_PORT" npm run build/);
});
