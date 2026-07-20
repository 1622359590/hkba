#!/usr/bin/env node
// Smoke E2E (M9; acceptance spec §14) — lightweight HTTP level, no Playwright
// (task allows substituting a lighter check; recorded as a deviation in the
// M9 plan notes).
//
// Boots the production backend (temp DB) and the production frontend
// (`next start`, requires a prior `npm run build` in frontend/), then walks
// the six core flows end to end:
//
//   1. admin login                       POST   /api/auth/login
//   2. create page                       POST   /api/admin/pages
//   3. save draft (block + SEO + share)  POST   /api/admin/pages/:id/draft/blocks
//                                        PATCH  /api/admin/pages/:id/draft
//   4. publish                           POST   /api/admin/pages/:id/publish
//   5. public visibility                 GET    /api/public/page (via frontend proxy)
//                                        GET    /<slug> on the frontend (200)
//   6. redirect aliases                  GET    /api/public/redirects (via proxy)
//
// Deviations (also printed at the end):
//   - A real 301 for redirect rows is emitted by the Next.js layer from
//     build-time config; rows written after a build take effect on the next
//     build (see frontend/next.config.ts). This smoke verifies the redirect
//     data reaches the public API, not the 301 itself.
//
// Usage: node scripts/smoke-e2e.js
// Exit code 0 = all flows passed; 1 = failure (children are always killed).

const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createRequire } = require('module');

const ROOT = path.join(__dirname, '..');
const BACKEND_DIR = path.join(ROOT, 'backend');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const BACKEND_PORT = 37900; // frontend rewrites are hard-wired to this port
const FRONTEND_PORT = 3100; // avoid clashing with a dev server on 3000
const BACKEND_BASE = `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_BASE = `http://127.0.0.1:${FRONTEND_PORT}`;
const CSRF = { 'x-requested-with': 'XMLHttpRequest' };
const OVERALL_TIMEOUT_MS = 180_000;

const backendRequire = createRequire(path.join(BACKEND_DIR, 'package.json'));
const Database = backendRequire('better-sqlite3');

const children = [];
let failed = false;

function step(message) {
  console.log(`\n▶ ${message}`);
}

function ok(message) {
  console.log(`  ✓ ${message}`);
}

function fail(message) {
  failed = true;
  console.error(`  ✗ ${message}`);
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
  else ok(message);
}

function waitFor(url, { timeoutMs = 60_000, expectOk = true } = {}) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (!expectOk || res.statusCode < 500) return resolve();
        setTimeout(attempt, 400);
      });
      req.on('error', () => {
        if (Date.now() > deadline) return reject(new Error(`timeout waiting for ${url}`));
        setTimeout(attempt, 400);
      });
      req.setTimeout(3000, () => req.destroy(new Error('request timeout')));
    };
    attempt();
  });
}

function spawnLogged(name, command, args, options) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
  child.stdout.on('data', (chunk) => process.stdout.write(`  [${name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`  [${name}!] ${chunk}`));
  child.on('exit', (code) => {
    if (!shuttingDown && code !== 0 && code !== null) {
      console.error(`  [${name}] exited unexpectedly with code ${code}`);
    }
  });
  children.push(child);
  return child;
}

let shuttingDown = false;
function killChildren() {
  shuttingDown = true;
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
}

async function json(res) {
  return res.json();
}

async function main() {
  // ---- precondition: frontend production build exists ----
  step('checking frontend production build');
  assert(fs.existsSync(path.join(FRONTEND_DIR, '.next', 'BUILD_ID')), 'frontend/.next/BUILD_ID found (run `npm run build` in frontend/ first)');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-smoke-'));
  const dbPath = path.join(tmp, 'smoke.db');
  const uploadsDir = path.join(tmp, 'uploads');

  // ---- backend ----
  step(`starting backend on :${BACKEND_PORT} (temp db ${dbPath})`);
  spawnLogged('api', process.execPath, ['server.js'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      HOST: '127.0.0.1',
      HKBA_DB_PATH: dbPath,
      HKBA_UPLOADS_DIR: uploadsDir,
      JWT_SECRET: `smoke-${crypto.randomBytes(16).toString('hex')}`,
    },
  });
  await waitFor(`${BACKEND_BASE}/api/health`);
  ok('backend healthy');

  // Seed one redirect row directly (no admin API exists for redirects; the
  // migration writes these rows in production).
  const conn = new Database(dbPath);
  conn
    .prepare("INSERT INTO redirects (id, from_path, to_path, status_code) VALUES (?, '/news/42', '/news/smoke-article', 301)")
    .run(crypto.randomUUID());
  conn.close();
  ok('seeded redirect row /news/42 -> /news/smoke-article');

  // ---- frontend ----
  step(`starting frontend (next start) on :${FRONTEND_PORT}`);
  spawnLogged('web', process.execPath, [path.join(FRONTEND_DIR, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(FRONTEND_PORT)], {
    cwd: FRONTEND_DIR,
    env: { ...process.env, NODE_ENV: 'production' },
  });
  await waitFor(`${FRONTEND_BASE}/`, { timeoutMs: 90_000 });
  ok('frontend responding');

  // ---- flow 1: login ----
  step('flow 1/6: admin login');
  const loginRes = await fetch(`${BACKEND_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'hkba2024' }),
  });
  assert(loginRes.status === 200, `login -> ${loginRes.status}`);
  const cookie = loginRes.headers.getSetCookie().find((line) => line.startsWith('hkba_admin=')).split(';')[0];
  ok('session cookie issued');

  const call = (method, apiPath, body) =>
    fetch(`${BACKEND_BASE}${apiPath}`, {
      method,
      headers: { cookie, ...CSRF, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  // ---- flow 2: create page ----
  step('flow 2/6: create page /about via admin api');
  const createRes = await call('POST', '/api/admin/pages', {
    nodeType: 'page',
    slug: 'about',
    titleZh: '煙霧測試頁',
    titleEn: 'Smoke Test Page',
  });
  assert(createRes.status === 201, `create page -> ${createRes.status}`);
  const pageId = (await json(createRes)).data.node.id;

  // ---- flow 3: save draft (block + SEO + share image) ----
  step('flow 3/6: save draft block, SEO and share image');
  let draft = (await json(await call('GET', `/api/admin/pages/${pageId}/draft`))).data;
  const blockRes = await call('POST', `/api/admin/pages/${pageId}/draft/blocks`, {
    expectedRevision: draft.version.revision,
    block: {
      componentType: 'content.rich-text',
      contentZh: { html: '<p>煙霧標記 smoke-marker</p>' },
      contentEn: { html: '<p>smoke-marker</p>' },
    },
  });
  assert(blockRes.status === 201, `add rich-text block -> ${blockRes.status}`);

  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
      '0000000d4944415478da63fcffff3f030005fe02fea72d994d0000000049454e44ae426082',
    'hex'
  );
  const form = new FormData();
  form.append('file', new Blob([png]), 'smoke-share.png');
  const uploadRes = await fetch(`${BACKEND_BASE}/api/admin/media/uploads`, {
    method: 'POST',
    headers: { cookie, ...CSRF },
    body: form,
  });
  assert(uploadRes.status === 201, `upload share image -> ${uploadRes.status}`);
  const shareMediaId = (await json(uploadRes)).data.asset.id;

  draft = (await json(await call('GET', `/api/admin/pages/${pageId}/draft`))).data;
  const seoRes = await call('PATCH', `/api/admin/pages/${pageId}/draft`, {
    expectedRevision: draft.version.revision,
    seo: { titleZh: '煙霧測試', descriptionZh: '煙霧測試描述', shareMediaId },
  });
  assert(seoRes.status === 200, `save SEO -> ${seoRes.status}`);

  // ---- flow 4: publish ----
  step('flow 4/6: publish');
  draft = (await json(await call('GET', `/api/admin/pages/${pageId}/draft`))).data;
  const publishRes = await call('POST', `/api/admin/pages/${pageId}/publish`, {
    expectedRevision: draft.version.revision,
  });
  assert(publishRes.status === 200, `publish -> ${publishRes.status}`);
  assert((await json(publishRes)).data.published === true, 'publish confirmed by api');

  // ---- flow 5: public visibility (through the frontend proxy + page 200) ----
  step('flow 5/6: public visibility');
  const publicRes = await fetch(`${FRONTEND_BASE}/api/public/page?path=${encodeURIComponent('/about')}`);
  assert(publicRes.status === 200, `GET /api/public/page via frontend proxy -> ${publicRes.status}`);
  const publicBody = await json(publicRes);
  const html = publicBody.data.blocks.map((b) => JSON.stringify({ zh: b.contentZh, en: b.contentEn })).join(' ');
  assert(html.includes('smoke-marker'), 'published block content served publicly');

  const pageRes = await fetch(`${FRONTEND_BASE}/about`);
  assert(pageRes.status === 200, `GET /about on frontend -> ${pageRes.status}`);

  // ---- flow 6: redirect aliases ----
  step('flow 6/6: redirect aliases on the public api');
  const redirectsRes = await fetch(`${FRONTEND_BASE}/api/public/redirects`);
  assert(redirectsRes.status === 200, `GET /api/public/redirects -> ${redirectsRes.status}`);
  const redirects = (await json(redirectsRes)).data.items;
  assert(
    redirects.some((item) => item.from === '/news/42' && item.to === '/news/smoke-article' && item.statusCode === 301),
    'redirect row visible on public api'
  );

  fs.rmSync(tmp, { recursive: true, force: true });
}

const overall = setTimeout(() => {
  console.error('\n✖ smoke e2e timed out');
  failed = true;
  killChildren();
  process.exit(1);
}, OVERALL_TIMEOUT_MS);

main()
  .then(() => {
    clearTimeout(overall);
    killChildren();
    console.log('\n✅ smoke e2e passed: login, create page, draft, publish, public visibility, redirects');
    console.log('   deviation: true 301s are a Next.js build-time concern; only the public redirect data was verified.');
    process.exit(0);
  })
  .catch((err) => {
    clearTimeout(overall);
    killChildren();
    console.error(`\n✖ smoke e2e failed: ${err.message}`);
    process.exit(1);
  });
