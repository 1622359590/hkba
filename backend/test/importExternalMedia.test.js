// Visual-strike tests: scripts/import-external-media.js — external image
// download into the media library, source-URL rewrite, checksum dedupe,
// failure isolation and idempotent re-runs. Uses a local HTTP server as the
// "external" host so no network access is needed.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = 'test-secret-for-import-media-tests-012345678';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-import-media-'));
process.env.HKBA_DB_PATH = path.join(tmpDir, 'import.db');
process.env.HKBA_UPLOADS_DIR = path.join(tmpDir, 'uploads');

const { initDatabase, getDb, closeDatabase } = require('../db/init');
const { runImport, createDownloader } = require('../scripts/import-external-media');

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000d4944415478da63fcffff3f030005fe02fea72d994d0000000049454e44ae426082',
  'hex'
);

initDatabase();
const db = getDb();
for (const t of ['partners', 'team_members', 'banners', 'news']) db.prepare(`DELETE FROM ${t}`).run();

let server;
let base;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        const error = new Error(`HTTP ${res.statusCode}`);
        error.httpStatus = res.statusCode;
        reject(error);
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
  });
}

// Offline fetchBuffer: localhost hits the test server; archive.org calls are
// simulated (dead.example.com has an availability snapshot, cdx.example.com
// only has a CDX status-200 row, everything else has none); any other host
// is "connection refused".
async function fetchBuffer(url) {
  if (url.startsWith(base)) return httpGet(url);
  if (url.startsWith('https://archive.org/wayback/available')) {
    if (url.includes('dead.example.com')) {
      return Buffer.from(
        JSON.stringify({
          archived_snapshots: {
            closest: { available: true, timestamp: '20240101000000', url: 'http://web.archive.org/web/20240101000000/https://dead.example.com/img.png' },
          },
        })
      );
    }
    return Buffer.from(JSON.stringify({ archived_snapshots: {} }));
  }
  if (url.startsWith('https://web.archive.org/cdx/')) {
    if (url.includes('cdx.example.com')) {
      return Buffer.from(
        JSON.stringify([
          ['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'],
          ['com,example,cdx)/img.png', '20240202000000', 'https://cdx.example.com/img.png', 'image/png', '200', 'X', '100'],
        ])
      );
    }
    return Buffer.from(JSON.stringify([['urlkey']]));
  }
  if (url.startsWith('https://web.archive.org/')) {
    if (url.includes('dead.example.com')) return Buffer.concat([PNG, Buffer.from([2])]);
    if (url.includes('cdx.example.com')) return Buffer.concat([PNG, Buffer.from([3])]);
    throw new Error('HTTP 404');
  }
  throw new Error('connect ECONNREFUSED');
}

test.before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/logo.png' || req.url === '/cover.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(req.url === '/cover.png' ? Buffer.concat([PNG, Buffer.from([1])]) : PNG);
      return;
    }
    res.writeHead(404).end('nope');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server?.close();
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('external urls are downloaded, deduped, rewritten and referenced; failures are isolated', async () => {
  db.prepare("INSERT INTO partners (id, name, logo_url, sort_order, is_active) VALUES (1, 'P1', ?, 1, 1)").run(`${base}/logo.png`);
  db.prepare("INSERT INTO partners (id, name, logo_url, sort_order, is_active) VALUES (2, 'P2', ?, 2, 1)").run(`${base}/logo.png`); // same bytes -> dedupe
  db.prepare("INSERT INTO partners (id, name, logo_url, sort_order, is_active) VALUES (3, 'P3', ?, 3, 1)").run(`${base}/missing.png`); // 404 + no snapshot -> unmapped
  db.prepare("INSERT INTO partners (id, name, logo_url, sort_order, is_active) VALUES (4, 'P4', '/uploads/already-local.png', 4, 1)").run();
  db.prepare("INSERT INTO partners (id, name, logo_url, sort_order, is_active) VALUES (5, 'P5', 'https://dead.example.com/img.png', 5, 1)").run(); // direct dead, wayback snapshot
  db.prepare("INSERT INTO partners (id, name, logo_url, sort_order, is_active) VALUES (6, 'P6', 'https://cdx.example.com/img.png', 6, 1)").run(); // availability empty, CDX 200 row
  db.prepare("INSERT INTO news (id, title_zh, cover_image, is_published) VALUES (1, '新聞', ?, 1)").run(`${base}/cover.png`);
  // Simulate a migrated news item so cover_media_id wiring is exercised.
  db.prepare("INSERT INTO news_items (id, slug, title_zh, status, current_draft_revision) VALUES ('item-1', 'news-1', '新聞', 'draft', 1)").run();
  db.prepare("INSERT INTO legacy_id_map (old_table, old_id, new_table, new_id, status) VALUES ('news', '1', 'news_items', 'item-1', 'done')").run();

  const report = await runImport(db, { fetchImpl: createDownloader(fetchBuffer) });

  assert.equal(report.failed, 1);
  assert.equal(report.unmapped.length, 1);
  assert.equal(report.unmapped[0].ref, 'partners.logo_url#3');
  assert.match(report.unmapped[0].error, /HTTP 404/);
  assert.match(report.unmapped[0].error, /wayback/);
  assert.equal(report.skippedLocal, 1);
  assert.equal(report.imported, 4); // logo + cover + wayback + cdx variants (distinct bytes)
  assert.equal(report.reused, 1); // second partner row reuses the logo asset

  const p1 = db.prepare('SELECT logo_url FROM partners WHERE id = 1').get().logo_url;
  const p2 = db.prepare('SELECT logo_url FROM partners WHERE id = 2').get().logo_url;
  assert.match(p1, /^\/uploads\/media\/.+\.png$/);
  assert.equal(p2, p1, 'identical downloads share one asset');
  const p3 = db.prepare('SELECT logo_url FROM partners WHERE id = 3').get().logo_url;
  assert.equal(p3, `${base}/missing.png`, 'failed row left untouched');
  const p5 = db.prepare('SELECT logo_url FROM partners WHERE id = 5').get().logo_url;
  assert.match(p5, /^\/uploads\/media\//, 'wayback fallback rewrites the row');
  assert.ok(report.items.some((item) => item.via === 'wayback' && item.label === 'partners.logo_url#5'));

  const assets = db.prepare('SELECT * FROM media_assets').all();
  assert.equal(assets.length, 4);
  assert.ok(assets.every((asset) => asset.status === 'active'));
  const logoAsset = assets.find((asset) => `/uploads/${asset.storage_key}` === p1);
  assert.equal(logoAsset.width, 1);
  assert.equal(logoAsset.height, 1);
  assert.ok(fs.existsSync(path.join(process.env.HKBA_UPLOADS_DIR, logoAsset.storage_key)));

  const refs = db.prepare('SELECT * FROM media_references').all();
  assert.ok(refs.some((ref) => ref.ref_type === 'site_setting' && ref.ref_id === 'legacy:partners:1:logo_url'));

  const item = db.prepare('SELECT cover_media_id FROM news_items WHERE id = ?').get('item-1');
  assert.ok(item.cover_media_id, 'migrated news item gained a cover asset');
  assert.ok(refs.some((ref) => ref.ref_type === 'news_cover' && ref.ref_id === 'item-1'));
  const legacyCover = db.prepare('SELECT cover_image FROM news WHERE id = 1').get().cover_image;
  assert.match(legacyCover, /^\/uploads\/media\//);
});

test('re-running the import is a no-op except retrying the failed row', async () => {
  const report = await runImport(db, { fetchImpl: createDownloader(fetchBuffer) });
  assert.equal(report.imported, 0);
  assert.equal(report.reused, 0);
  assert.equal(report.planned, 1, 'only the still-external failed row is retried');
  assert.equal(report.failed, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM media_assets').get().n, 4);
});

test('dry-run plans without writing anything', async () => {
  db.prepare("INSERT INTO banners (id, image_url, is_active) VALUES (9, 'https://example.com/x.png', 1)").run();
  const report = await runImport(db, { dryRun: true });
  assert.equal(report.planned, 2, 'banner row + still-failed partner row');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM media_assets').get().n, 4);
  assert.equal(db.prepare('SELECT image_url FROM banners WHERE id = 9').get().image_url, 'https://example.com/x.png');
});
