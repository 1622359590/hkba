#!/usr/bin/env node
// Media wiring (visual-strike task 3).
//
// Connects imported media assets to the published page structure after
// import-external-media.js has localized the image files:
//
//   - Homepage hero: sets content.backgroundMediaId (zh+en) to the asset of
//     banners[0] on both the published and the draft version of '/', and
//     records page_block references so the asset is delete-protected.
//   - Association block headings: fills empty bilingual titles on the
//     migrated association.* blocks (home partners wall, about timeline and
//     member grid) so the sections read as designed.
//
// News detail covers are wired by import-external-media.js itself
// (news_items.cover_media_id); legacy /members and /team pages read the
// rewritten local URLs straight from the legacy tables.
//
// Idempotent: values are overwritten with the same content on re-runs.
// CLI: node scripts/wire-media.js [--db <path>]

const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const TITLES = [
  { path: '/', component: 'association.partners', zh: '合作夥伴', en: 'Our Partners' },
  { path: '/about', component: 'association.timeline', zh: '發展歷程', en: 'Our Journey' },
  { path: '/about', component: 'association.members', zh: '顧問團隊', en: 'Advisory Board' },
];

function assetIdForStorageUrl(conn, url) {
  const key = String(url || '').replace(/^\/uploads\//, '');
  if (!key) return null;
  const row = conn.prepare("SELECT id FROM media_assets WHERE storage_key = ? AND status = 'active'").get(key);
  return row ? row.id : null;
}

function insertReference(conn, mediaId, refType, refId) {
  conn
    .prepare('INSERT OR IGNORE INTO media_references (id, media_id, ref_type, ref_id) VALUES (?, ?, ?, ?)')
    .run(crypto.randomUUID(), mediaId, refType, refId);
}

function versionIds(conn, node) {
  return [node.published_version_id, node.draft_version_id].filter(Boolean);
}

function patchBlockContent(block, patch) {
  const zh = JSON.parse(block.content_zh || '{}');
  const en = JSON.parse(block.content_en || '{}');
  return {
    zh: JSON.stringify({ ...zh, ...patch.zh }),
    en: JSON.stringify({ ...en, ...patch.en }),
  };
}

function runWiring(conn) {
  const report = { hero: [], titles: [], warnings: [] };

  // ---- homepage hero <- banners[0] asset ----
  const banner = conn.prepare('SELECT id, image_url FROM banners ORDER BY sort_order, id LIMIT 1').get();
  const heroMediaId = banner ? assetIdForStorageUrl(conn, banner.image_url) : null;
  const home = conn.prepare("SELECT * FROM page_nodes WHERE path = '/' AND deleted_at IS NULL").get();
  if (!heroMediaId) {
    report.warnings.push('banners[0] has no active media asset — hero left untouched');
  } else if (!home) {
    report.warnings.push('no published home page node at / — hero left untouched');
  } else {
    for (const versionId of versionIds(conn, home)) {
      const hero = conn
        .prepare("SELECT * FROM page_blocks WHERE page_version_id = ? AND component_type = 'content.hero' ORDER BY sort_order LIMIT 1")
        .get(versionId);
      if (!hero) continue;
      const next = patchBlockContent(hero, { zh: { backgroundMediaId: heroMediaId }, en: { backgroundMediaId: heroMediaId } });
      conn.prepare('UPDATE page_blocks SET content_zh = ?, content_en = ? WHERE id = ?').run(next.zh, next.en, hero.id);
      insertReference(conn, heroMediaId, 'page_block', hero.id);
      report.hero.push({ versionId, blockId: hero.id, mediaId: heroMediaId });
    }
  }

  // ---- association block headings ----
  for (const spec of TITLES) {
    const node = conn.prepare('SELECT * FROM page_nodes WHERE path = ? AND deleted_at IS NULL').get(spec.path);
    if (!node) continue;
    for (const versionId of versionIds(conn, node)) {
      const blocks = conn
        .prepare('SELECT * FROM page_blocks WHERE page_version_id = ? AND component_type = ?')
        .all(versionId, spec.component);
      for (const block of blocks) {
        const current = JSON.parse(block.content_zh || '{}');
        if (current.title) continue; // editor content wins
        const next = patchBlockContent(block, { zh: { title: spec.zh }, en: { title: spec.en } });
        conn.prepare('UPDATE page_blocks SET content_zh = ?, content_en = ? WHERE id = ?').run(next.zh, next.en, block.id);
        report.titles.push({ path: spec.path, component: spec.component, blockId: block.id });
      }
    }
  }

  return report;
}

function main() {
  const args = process.argv.slice(2);
  const dbFlag = args.indexOf('--db');
  const dbPath = dbFlag >= 0 ? args[dbFlag + 1] : process.env.HKBA_DB_PATH || path.join(__dirname, '..', 'db', 'hkba.db');
  const conn = new Database(dbPath);
  try {
    const report = runWiring(conn);
    console.log(JSON.stringify(report, null, 2));
    if (report.warnings.length) process.exitCode = 1;
  } finally {
    conn.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { runWiring };
