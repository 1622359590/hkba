#!/usr/bin/env node
// External media import (visual-strike task 2).
//
// Scans the structured legacy tables for externally hosted image URLs
// (hkba.club, OSS buckets, …), downloads each file into the media library
// and rewrites the source row to the local /uploads/ path:
//
//   partners.logo_url        -> media_assets + local logo
//   team_members.avatar_url  -> media_assets + local avatar
//   banners.image_url        -> media_assets + local banner
//   news.cover_image         -> media_assets + news_items.cover_media_id
//                               (+ media_references news_cover) when the news
//                               row was migrated by migrate-content.js
//
// Properties:
//   - Checksum dedupe: identical downloads reuse the existing asset (no
//     duplicate files or rows).
//   - Idempotent: rows already pointing at local /uploads/ paths are skipped.
//   - Failures never abort the run: every failed URL lands in the report's
//     `unmapped` list with its error message.
//   - Reference rows: news covers use ref_type 'news_cover'; legacy logo /
//     avatar / banner rows use 'site_setting' with a descriptive
//     `legacy:<table>:<id>:<column>` ref_id (the CHECK constraint has no
//     legacy scope, and the reference keeps the asset delete-protected).
//   - --dry-run prints the plan without downloading or writing.
//   - Writes are preceded by a timestamped db backup unless --no-backup.
//
// CLI: node scripts/import-external-media.js [--dry-run] [--db <path>] [--no-backup]

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { storeUpload } = require('../lib/mediaStore');
const { runBackup } = require('./backup-db');

const FETCH_TIMEOUT_MS = 20_000;
const MAX_BYTES = 30 * 1024 * 1024;

const SOURCES = [
  { table: 'partners', column: 'logo_url', kind: 'partner_logo' },
  { table: 'team_members', column: 'avatar_url', kind: 'team_avatar' },
  { table: 'banners', column: 'image_url', kind: 'banner_image' },
  { table: 'news', column: 'cover_image', kind: 'news_cover' },
];

function isExternal(url) {
  return /^https?:\/\//i.test(String(url || '').trim());
}

async function download(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) {
      const error = new Error(`HTTP ${res.status}`);
      error.httpStatus = res.status;
      throw error;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) throw new Error('empty response');
    if (buffer.length > MAX_BYTES) throw new Error(`response too large (${buffer.length} bytes)`);
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}

// Wayback Machine fallback: the live hosts may be gone (hkba.club DNS dead)
// or privatized (OSS bucket now denies public reads). Archived snapshots
// keep the original asset bytes (`id_` = raw, no toolbar rewrite). The
// availability API only knows the *latest* capture — when that capture is
// itself an error page (e.g. a 403 after the bucket went private) it reports
// nothing, so we fall back to the CDX index for the newest status-200
// capture.
async function waybackDownload(url, fetchBuffer) {
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
  let timestamp = null;
  try {
    const body = JSON.parse((await fetchBuffer(api)).toString('utf8'));
    const snapshot = body && body.archived_snapshots && body.archived_snapshots.closest;
    if (snapshot && snapshot.available && snapshot.timestamp) timestamp = snapshot.timestamp;
  } catch {
    /* availability API hiccup — try CDX */
  }
  if (!timestamp) {
    const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&filter=statuscode:200&limit=-1`;
    const rows = JSON.parse((await fetchBuffer(cdx)).toString('utf8'));
    // Header row + captures, most recent last (limit=-1 returns the tail).
    if (Array.isArray(rows) && rows.length > 1) {
      timestamp = rows[rows.length - 1][1];
    }
  }
  if (!timestamp) throw new Error('no wayback snapshot');
  return fetchBuffer(`https://web.archive.org/web/${timestamp}id_/${url}`);
}

// Per-host short-circuit: when one URL on a host fails at the network level
// (DNS/TLS/timeout — an HTTP status means the host is alive), the rest of
// that host goes straight to Wayback instead of eating a timeout each.
function createDownloader(fetchBuffer = download) {
  const deadHosts = new Set();
  return async function downloadWithFallback(url) {
    let host = '';
    try {
      host = new URL(url).host;
    } catch {
      /* keep empty */
    }
    if (!deadHosts.has(host)) {
      try {
        return { buffer: await fetchBuffer(url), via: 'direct' };
      } catch (error) {
        if (!error.httpStatus) deadHosts.add(host);
        try {
          return { buffer: await waybackDownload(url, fetchBuffer), via: 'wayback' };
        } catch (waybackError) {
          throw new Error(`${error.message}; wayback: ${waybackError.message}`);
        }
      }
    }
    return { buffer: await waybackDownload(url, fetchBuffer), via: 'wayback' };
  };
}

function filenameFromUrl(url) {
  try {
    const base = path.basename(new URL(url).pathname);
    return base || 'download';
  } catch {
    return 'download';
  }
}

function firstAdminId(conn) {
  const row = conn.prepare('SELECT id FROM admins ORDER BY id LIMIT 1').get();
  return row ? row.id : null;
}

function assetIdByChecksum(conn, checksum) {
  const row = conn.prepare("SELECT id FROM media_assets WHERE checksum = ? AND status = 'active'").get(checksum);
  return row ? row.id : null;
}

function insertAsset(conn, stored, adminId) {
  conn
    .prepare(
      `INSERT INTO media_assets
         (id, storage_key, original_filename, mime_type, size_bytes, width, height, checksum, status, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
    )
    .run(stored.id, stored.storageKey, stored.originalFilename, stored.mimeType, stored.sizeBytes, stored.width, stored.height, stored.checksum, adminId);
  return stored.id;
}

function insertReference(conn, mediaId, refType, refId) {
  conn
    .prepare('INSERT OR IGNORE INTO media_references (id, media_id, ref_type, ref_id) VALUES (?, ?, ?, ?)')
    .run(crypto.randomUUID(), mediaId, refType, refId);
}

function newsItemIdForLegacyNews(conn, legacyNewsId) {
  const row = conn
    .prepare("SELECT new_id FROM legacy_id_map WHERE old_table = 'news' AND old_id = ? AND new_table = 'news_items' AND status = 'done'")
    .get(String(legacyNewsId));
  return row ? row.new_id : null;
}

async function runImport(conn, { dryRun = false, fetchImpl } = {}) {
  const downloader = fetchImpl || createDownloader();
  const report = {
    dryRun,
    startedAt: new Date().toISOString(),
    planned: 0,
    skippedLocal: 0,
    imported: 0,
    reused: 0,
    failed: 0,
    unmapped: [],
    items: [],
  };
  const adminId = firstAdminId(conn);

  for (const source of SOURCES) {
    const rows = conn.prepare(`SELECT id, ${source.column} AS url FROM ${source.table}`).all();
    for (const row of rows) {
      const url = String(row.url || '').trim();
      const label = `${source.table}.${source.column}#${row.id}`;
      if (!url) continue;
      if (!isExternal(url)) {
        if (url.startsWith('/uploads/')) report.skippedLocal += 1;
        continue;
      }
      report.planned += 1;
      if (dryRun) {
        report.items.push({ label, url, action: 'plan' });
        continue;
      }
      try {
        const { buffer, via } = await downloader(url);
        const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
        let mediaId = assetIdByChecksum(conn, checksum);
        let action = 'imported';
        if (mediaId) {
          action = 'reused';
          report.reused += 1;
        } else {
          const stored = storeUpload({ buffer, originalFilename: filenameFromUrl(url) });
          mediaId = insertAsset(conn, stored, adminId);
          report.imported += 1;
        }
        const asset = conn.prepare('SELECT storage_key FROM media_assets WHERE id = ?').get(mediaId);
        const localUrl = `/uploads/${asset.storage_key}`;

        if (source.table === 'news') {
          conn.prepare('UPDATE news SET cover_image = ? WHERE id = ?').run(localUrl, row.id);
          const newsItemId = newsItemIdForLegacyNews(conn, row.id);
          if (newsItemId) {
            conn.prepare('UPDATE news_items SET cover_media_id = ? WHERE id = ?').run(mediaId, newsItemId);
            insertReference(conn, mediaId, 'news_cover', newsItemId);
          }
        } else {
          conn.prepare(`UPDATE ${source.table} SET ${source.column} = ? WHERE id = ?`).run(localUrl, row.id);
          insertReference(conn, mediaId, 'site_setting', `legacy:${source.table}:${row.id}:${source.column}`);
        }
        report.items.push({ label, url, action, via, mediaId, localUrl });
      } catch (error) {
        report.failed += 1;
        const message = error.name === 'AbortError' ? `timeout after ${FETCH_TIMEOUT_MS}ms` : error.message;
        report.unmapped.push({ kind: source.kind, ref: label, url, error: message });
      }
    }
  }
  return report;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noBackup = args.includes('--no-backup');
  const dbFlag = args.indexOf('--db');
  const dbPath = dbFlag >= 0 ? args[dbFlag + 1] : process.env.HKBA_DB_PATH || path.join(__dirname, '..', 'db', 'hkba.db');

  if (!fs.existsSync(dbPath)) {
    console.error(`✖ database not found: ${dbPath}`);
    process.exit(1);
  }
  if (!dryRun && !noBackup) {
    const backup = runBackup({ dbPath });
    console.log(`📦 db backup: ${backup.backup}`);
  }
  const conn = new Database(dbPath);
  runImport(conn, { dryRun })
    .then((report) => {
      conn.close();
      console.log(JSON.stringify(report, null, 2));
      if (report.failed > 0) {
        console.log(`⚠ ${report.failed} download(s) failed — see unmapped (source rows left untouched)`);
      }
    })
    .catch((error) => {
      conn.close();
      console.error(`✖ import failed: ${error.message}`);
      process.exit(1);
    });
}

if (require.main === module) {
  main();
}

module.exports = { runImport, createDownloader };
