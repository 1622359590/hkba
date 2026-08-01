#!/usr/bin/env node
// Content migration (M9; acceptance spec §5-§8, decision D8).
//
// Migrates legacy tables (banners, pages, news, media + inline image URLs)
// into the Phase-2 entity model:
//   banners        -> homepage content.hero block (+ stats / association blocks)
//   pages (HTML)   -> page_nodes + page_versions + one content.rich-text block
//   news           -> news_items + news_revisions + news_blocks (header +
//                     rich-text), with free-text category/tags normalized into
//                     the taxonomy tables and numeric-id redirects written (D8)
//   media / URLs   -> media_assets with checksum dedupe + media_references
//
// Properties:
//   - Idempotent: every translated row is recorded in legacy_id_map
//     (old_table, old_id -> new_table, new_id, status, error); re-runs skip
//     completed rows and retry failed ones without duplicating inserts.
//   - --dry-run prints the plan as JSON without writing anything.
//   - --db <path> targets a specific database file; the default is the
//     configured HKBA_DB_PATH / backend db. A timestamped file backup is
//     taken before any write unless --no-backup is passed.
//   - After migrating, a verification pass prints a JSON report: row-count
//     reconciliation, orphan references, unmapped items (external URLs,
//     missing files) and per-entity failures.
//
// Kept structured (not migrated, still served by legacy APIs; the public
// fallback chain renders them until the association components land):
//   partners, team_members, milestones, stats(rows feed content.stats),
//   events, announcements, contact_info.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { imageSize } = require('../lib/imageSize');
const { ensureSystemPages } = require('../lib/ensureSystemPages');

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
};

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function shortHash(text) {
  return crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, 8);
}

function fileChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ---------------------------------------------------------------------------
// migration context
// ---------------------------------------------------------------------------

function createContext(conn, { dryRun = false, uploadsDir } = {}) {
  const report = {
    dryRun,
    startedAt: new Date().toISOString(),
    counts: { legacy: {}, migrated: {}, mappedDone: 0, mappedFailed: 0 },
    media: { created: 0, reused: 0, missingFile: 0, externalUrl: 0 },
    taxonomy: { categories: 0, tags: 0 },
    pages: { created: 0, published: 0, blocks: 0 },
    news: { created: 0, published: 0, drafts: 0, redirects: 0, blocks: 0 },
    keptStructured: {},
    failures: [],
    unmapped: [],
    orphans: [],
  };

  const mapGet = conn.prepare("SELECT new_id, status FROM legacy_id_map WHERE old_table = ? AND old_id = ? AND new_table = ?");
  const mapInsert = conn.prepare(
    "INSERT OR IGNORE INTO legacy_id_map (id, old_table, old_id, new_table, new_id, source, status, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const ctx = {
    conn,
    dryRun,
    uploadsDir: uploadsDir || process.env.HKBA_UPLOADS_DIR || path.join(__dirname, '..', 'uploads'),
    report,
    planned: [], // dry-run only: human-readable plan lines
    writes: 0,

    alreadyMapped(oldTable, oldId, newTable) {
      const row = mapGet.get(oldTable, oldId, newTable);
      return row && row.status === 'done' ? row.new_id : null;
    },
    recordMap(oldTable, oldId, newTable, newId, source, status, error = '') {
      if (status === 'done') report.counts.mappedDone += 1;
      else report.counts.mappedFailed += 1;
      if (dryRun) return;
      mapInsert.run(crypto.randomUUID(), oldTable, oldId, newTable, newId, source, status, error);
    },
    fail(scope, message) {
      report.failures.push({ scope, message });
    },
    unmapped(kind, detail) {
      report.unmapped.push({ kind, detail });
    },
    plan(line) {
      if (dryRun) ctx.planned.push(line);
    },
    run(sql, ...params) {
      ctx.writes += 1;
      if (dryRun) return { lastInsertRowid: 0, changes: 0 };
      return conn.prepare(sql).run(...params);
    },
  };
  return ctx;
}

// ---------------------------------------------------------------------------
// media
// ---------------------------------------------------------------------------

// Resolves one legacy image reference (/uploads/... local path or external
// URL) to a media_assets row id. Local files are read, checksummed and
// deduped by checksum; missing files and external URLs are reported and
// yield null.
function ensureMediaForUrl(ctx, url, { alt = '', source = '' } = {}) {
  const value = String(url || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    ctx.report.media.externalUrl += 1;
    ctx.unmapped('external_media_url', value);
    return null;
  }
  const storageKey = value.replace(/^\/?uploads\//, '');
  if (!storageKey || storageKey.includes('..')) {
    ctx.unmapped('bad_media_path', value);
    return null;
  }
  const abs = path.join(ctx.uploadsDir, storageKey);
  if (!fs.existsSync(abs)) {
    ctx.report.media.missingFile += 1;
    ctx.unmapped('missing_media_file', value);
    return null;
  }
  const buffer = fs.readFileSync(abs);
  const checksum = fileChecksum(buffer);
  const existing = ctx.conn
    .prepare("SELECT id FROM media_assets WHERE checksum = ? AND status = 'active'")
    .get(checksum);
  if (existing) {
    ctx.report.media.reused += 1;
    return existing.id;
  }
  const byKey = ctx.conn.prepare('SELECT id FROM media_assets WHERE storage_key = ?').get(storageKey);
  if (byKey) {
    ctx.report.media.reused += 1;
    return byKey.id;
  }
  const id = crypto.randomUUID();
  const ext = path.extname(storageKey).toLowerCase();
  const size = imageSize(buffer) || { width: null, height: null };
  ctx.run(
    `INSERT INTO media_assets (id, storage_key, original_filename, mime_type, size_bytes, width, height, checksum, status, alt_zh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    id,
    storageKey,
    path.basename(storageKey),
    MIME_BY_EXT[ext] || 'application/octet-stream',
    buffer.length,
    size.width,
    size.height,
    checksum,
    alt
  );
  ctx.report.media.created += 1;
  ctx.plan(`media: ${value} -> ${id}`);
  return id;
}

function addMediaReference(ctx, mediaId, refType, refId) {
  if (!mediaId) return;
  ctx.run(
    'INSERT OR IGNORE INTO media_references (id, media_id, ref_type, ref_id) VALUES (?, ?, ?, ?)',
    crypto.randomUUID(),
    mediaId,
    refType,
    refId
  );
}

// ---------------------------------------------------------------------------
// taxonomy normalization
// ---------------------------------------------------------------------------

function ensureCategory(ctx, name) {
  const label = String(name || '').trim();
  if (!label) return null;
  let slug = slugify(label);
  if (!slug) slug = `cat-${shortHash(label)}`;
  const existing = ctx.conn.prepare('SELECT id FROM news_categories WHERE slug = ?').get(slug);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  ctx.run('INSERT INTO news_categories (id, slug, name_zh, name_en) VALUES (?, ?, ?, ?)', id, slug, label, '');
  ctx.report.taxonomy.categories += 1;
  ctx.plan(`category: "${label}" -> ${slug}`);
  return id;
}

function ensureTag(ctx, name) {
  const label = String(name || '').trim();
  if (!label) return null;
  let slug = slugify(label);
  if (!slug) slug = `tag-${shortHash(label)}`;
  const existing = ctx.conn.prepare('SELECT id FROM news_tags WHERE slug = ?').get(slug);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  ctx.run('INSERT INTO news_tags (id, slug, name_zh, name_en) VALUES (?, ?, ?, ?)', id, slug, label, '');
  ctx.report.taxonomy.tags += 1;
  return id;
}

// ---------------------------------------------------------------------------
// news
// ---------------------------------------------------------------------------

function uniqueNewsSlug(ctx, base, oldId) {
  const fallback = `news-${oldId}`;
  let slug = base || fallback;
  let candidate = slug;
  let counter = 0;
  while (ctx.conn.prepare('SELECT 1 FROM news_items WHERE slug = ?').get(candidate)) {
    counter += 1;
    candidate = `${slug}-${oldId}${counter > 1 ? `-${counter}` : ''}`;
  }
  return candidate;
}

function migrateNews(ctx) {
  const rows = ctx.conn.prepare('SELECT * FROM news ORDER BY id').all();
  ctx.report.counts.legacy.news = rows.length;
  const adminId = ctx.conn.prepare('SELECT id FROM admins ORDER BY id LIMIT 1').get()?.id ?? null;

  for (const row of rows) {
    if (ctx.alreadyMapped('news', row.id, 'news_items')) continue;
    try {
      const id = crypto.randomUUID();
      const slug = uniqueNewsSlug(ctx, slugify(row.title_en) || slugify(row.title_zh), row.id);
      const isPublished = Boolean(row.is_published);
      const publishedAt = row.published_at || (isPublished ? row.created_at : null);
      const coverMediaId = ensureMediaForUrl(ctx, row.cover_image, { alt: row.title_zh, source: `news:${row.id}` });

      const categoryId = ensureCategory(ctx, row.category);
      const tagIds = String(row.tags || '')
        .split(/[,，、;；]/)
        .map((entry) => ensureTag(ctx, entry))
        .filter(Boolean);

      const snapshot = {
        titleZh: row.title_zh,
        titleEn: row.title_en,
        summaryZh: row.summary_zh,
        summaryEn: row.summary_en,
        coverMediaId,
        displayYear: null,
        seo: {},
        categoryIds: categoryId ? [categoryId] : [],
        tagIds,
      };

      ctx.run(
        `INSERT INTO news_items (id, slug, title_zh, title_en, summary_zh, summary_en, cover_media_id, author_id, published_at, display_year, status, current_draft_revision, published_revision, seo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, '{}')`,
        id,
        slug,
        row.title_zh,
        row.title_en,
        row.summary_zh,
        row.summary_en,
        coverMediaId,
        adminId,
        publishedAt,
        isPublished ? 'published' : 'draft',
        isPublished ? 2 : 1,
        isPublished ? 1 : null
      );

      const headerZh = { title: row.title_zh, summary: row.summary_zh, coverMediaId: coverMediaId || '', publishedAt: publishedAt || '' };
      const headerEn = { title: row.title_en, summary: row.summary_en };
      const headerSettings = { categoryIds: categoryId ? [categoryId] : [], tagIds };
      const richZh = { html: row.content_zh || '' };
      const richEn = { html: row.content_en || '' };

      const insertRevisionBlocks = (revision) => {
        const headerId = crypto.randomUUID();
        ctx.run(
          `INSERT INTO news_blocks (id, news_id, revision, block_type, block_version, sort_order, content_zh, content_en, settings)
           VALUES (?, ?, ?, 'news.header', 1, 1, ?, ?, ?)`,
          headerId,
          id,
          revision,
          JSON.stringify(headerZh),
          JSON.stringify(headerEn),
          JSON.stringify(headerSettings)
        );
        ctx.run(
          `INSERT INTO news_blocks (id, news_id, revision, block_type, block_version, sort_order, content_zh, content_en, settings)
           VALUES (?, ?, ?, 'content.rich-text', 1, 2, ?, ?, '{}')`,
          crypto.randomUUID(),
          id,
          revision,
          JSON.stringify(richZh),
          JSON.stringify(richEn)
        );
        ctx.report.news.blocks += 2;
        addMediaReference(ctx, coverMediaId, 'news_block', headerId);
      };

      insertRevisionBlocks(1);
      ctx.run(
        `INSERT INTO news_revisions (id, news_id, revision, status, snapshot, created_by, published_by, published_at)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
        crypto.randomUUID(),
        id,
        isPublished ? 'published' : 'draft',
        JSON.stringify(snapshot),
        adminId,
        isPublished ? adminId : null,
        isPublished ? publishedAt : null
      );
      if (isPublished) {
        // The publish engine continues every published item with a +1 draft
        // revision; mirror that so the news center opens a sane draft.
        insertRevisionBlocks(2);
        ctx.run(
          `INSERT INTO news_revisions (id, news_id, revision, status, snapshot, created_by)
           VALUES (?, ?, 2, 'draft', ?, ?)`,
          crypto.randomUUID(),
          id,
          JSON.stringify(snapshot),
          adminId
        );
        ctx.run(
          'INSERT INTO publish_records (id, object_type, object_id, version_id, revision, action, actor_id, checks_report) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
          crypto.randomUUID(),
          'news',
          id,
          id,
          'publish',
          adminId,
          JSON.stringify({ migrated: true })
        );
        ctx.run(
          "INSERT INTO redirects (id, from_path, to_path, status_code, created_by) VALUES (?, ?, ?, 301, ?) ON CONFLICT(from_path) DO NOTHING",
          crypto.randomUUID(),
          `/news/${row.id}`,
          `/news/${slug}`,
          adminId
        );
        ctx.report.news.redirects += 1;
        ctx.report.news.published += 1;
      } else {
        ctx.report.news.drafts += 1;
      }
      addMediaReference(ctx, coverMediaId, 'news_cover', id);

      for (const categoryRowId of categoryId ? [categoryId] : []) {
        ctx.run('INSERT OR IGNORE INTO news_category_map (news_id, category_id) VALUES (?, ?)', id, categoryRowId);
      }
      for (const tagId of tagIds) {
        ctx.run('INSERT OR IGNORE INTO news_tag_map (news_id, tag_id) VALUES (?, ?)', id, tagId);
      }

      ctx.recordMap('news', row.id, 'news_items', id, 'migrate-content', 'done');
      ctx.report.news.created += 1;
      ctx.plan(`news: #${row.id} -> ${slug} (${isPublished ? 'published' : 'draft'})`);
    } catch (error) {
      ctx.recordMap('news', row.id, 'news_items', '', 'migrate-content', 'failed', String(error.message || error));
      ctx.fail(`news:${row.id}`, String(error.message || error));
    }
  }
}

// ---------------------------------------------------------------------------
// pages (legacy HTML pages -> single rich-text block) & homepage
// ---------------------------------------------------------------------------

function publishPage(ctx, pageId, versionId, adminId) {
  ctx.run("UPDATE page_versions SET status = 'published', published_by = ?, published_at = datetime('now') WHERE id = ?", adminId, versionId);
  ctx.run('UPDATE page_nodes SET published_version_id = ?, updated_at = datetime(\'now\') WHERE id = ?', versionId, pageId);
  ctx.run(
    'INSERT INTO publish_records (id, object_type, object_id, version_id, revision, action, actor_id, checks_report) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
    crypto.randomUUID(),
    'page',
    pageId,
    versionId,
    'publish',
    adminId,
    JSON.stringify({ migrated: true })
  );
  ctx.report.pages.published += 1;
}

function insertPageBlock(ctx, versionId, type, sortOrder, contentZh, contentEn, settings = {}) {
  const id = crypto.randomUUID();
  ctx.run(
    `INSERT INTO page_blocks (id, page_version_id, component_type, component_version, sort_order, parent_block_id, is_visible, content_zh, content_en, settings)
     VALUES (?, ?, ?, 1, ?, NULL, 1, ?, ?, ?)`,
    id,
    versionId,
    type,
    sortOrder,
    JSON.stringify(contentZh),
    JSON.stringify(contentEn),
    JSON.stringify(settings)
  );
  ctx.report.pages.blocks += 1;
  return id;
}

function createPageNode(ctx, { slug, pagePath, titleZh, titleEn, sortOrder = 0 }) {
  const id = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  ctx.run(
    `INSERT INTO page_nodes (id, parent_id, node_type, slug, path, title_zh, title_en, navigation_status, sort_order)
     VALUES (?, NULL, 'page', ?, ?, ?, ?, 'visible', ?)`,
    id,
    slug,
    pagePath,
    titleZh,
    titleEn,
    sortOrder
  );
  ctx.run(
    "INSERT INTO page_versions (id, page_id, revision, status, seo) VALUES (?, ?, 1, 'draft', '{}')",
    versionId,
    id
  );
  ctx.report.pages.created += 1;
  return { id, versionId };
}

function migrateHomepage(ctx, adminId) {
  if (ctx.alreadyMapped('banners', 0, 'page_nodes')) return; // homepage sentinel
  const banners = ctx.conn.prepare('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order, id').all();
  const stats = ctx.conn.prepare('SELECT * FROM stats WHERE is_active = 1 ORDER BY sort_order, id').all();
  const partnerCount = ctx.conn.prepare('SELECT COUNT(*) AS n FROM partners WHERE is_active = 1').get().n;
  ctx.report.counts.legacy.banners = banners.length;
  ctx.report.keptStructured.partners = partnerCount;

  const existing = ctx.conn.prepare('SELECT id FROM page_nodes WHERE path = ?').get('/');
  if (existing) {
    ctx.unmapped('homepage_exists', '/ 已存在，跳過首頁生成');
    return;
  }
  const { id: pageId, versionId } = createPageNode(ctx, { slug: 'home', pagePath: '/', titleZh: '首頁', titleEn: 'Home' });

  let order = 0;
  if (banners.length) {
    const banner = banners[0];
    const mediaId = ensureMediaForUrl(ctx, banner.image_url, { alt: banner.title_zh, source: `banners:${banner.id}` });
    order += 1;
    const heroId = insertPageBlock(
      ctx,
      versionId,
      'content.hero',
      order,
      {
        title: banner.title_zh,
        subtitle: banner.subtitle_zh || banner.description_zh || '',
        backgroundMediaId: mediaId || '',
        primaryButton: banner.link_url ? { label: '了解更多', url: banner.link_url } : { label: '', url: '' },
        secondaryButton: { label: '', url: '' },
      },
      {
        title: banner.title_en,
        subtitle: banner.subtitle_en || banner.description_en || '',
        primaryButton: banner.link_url ? { label: 'Learn more', url: banner.link_url } : { label: '', url: '' },
        secondaryButton: { label: '', url: '' },
      },
      { variant: 'full', overlay: 40 }
    );
    addMediaReference(ctx, mediaId, 'page_block', heroId);
    ctx.recordMap('banners', banner.id, 'page_blocks', heroId, 'migrate-content', 'done');
    if (banners.length > 1) {
      for (const extra of banners.slice(1)) {
        ctx.unmapped('extra_banner', `banner #${extra.id}「${extra.title_zh}」未遷移（首頁僅保留一個 Hero）`);
        ctx.recordMap('banners', extra.id, 'page_blocks', '', 'migrate-content', 'failed', 'extra banner skipped');
      }
    }
  }

  if (stats.length) {
    order += 1;
    insertPageBlock(
      ctx,
      versionId,
      'content.stats',
      order,
      { items: stats.map((row) => ({ value: row.value, label: row.label_zh })) },
      { items: stats.map((row) => ({ value: row.value, label: row.label_en || row.label_zh })) }
    );
  }

  if (partnerCount) {
    order += 1;
    insertPageBlock(ctx, versionId, 'association.partners', order, {}, {});
  }

  publishPage(ctx, pageId, versionId, adminId);
  ctx.recordMap('banners', 0, 'page_nodes', pageId, 'migrate-content', 'done');
  ctx.plan(`homepage: / with ${order} blocks`);
}

function migrateLegacyPages(ctx, adminId) {
  const rows = ctx.conn.prepare('SELECT * FROM pages ORDER BY id').all();
  ctx.report.counts.legacy.pages = rows.length;
  const teamCount = ctx.conn.prepare('SELECT COUNT(*) AS n FROM team_members WHERE is_active = 1').get().n;
  const milestoneCount = ctx.conn.prepare('SELECT COUNT(*) AS n FROM milestones WHERE is_active = 1').get().n;
  ctx.report.keptStructured.teamMembers = teamCount;
  ctx.report.keptStructured.milestones = milestoneCount;

  let aboutHooked = false;
  for (const row of rows) {
    if (ctx.alreadyMapped('pages', row.id, 'page_nodes')) continue;
    try {
      let slug = slugify(row.slug) || `page-${row.id}`;
      let pagePath = `/${slug}`;
      if (ctx.conn.prepare('SELECT 1 FROM page_nodes WHERE path = ?').get(pagePath)) {
        slug = `${slug}-${row.id}`;
        pagePath = `/${slug}`;
      }
      const { id: pageId, versionId } = createPageNode(ctx, {
        slug,
        pagePath,
        titleZh: row.title_zh,
        titleEn: row.title_en,
        sortOrder: row.id,
      });

      let order = 0;
      if (!aboutHooked && (slug.includes('about') || row.slug.includes('about'))) {
        aboutHooked = true;
        if (milestoneCount) {
          order += 1;
          insertPageBlock(ctx, versionId, 'association.timeline', order, {}, {});
        }
        if (teamCount) {
          order += 1;
          insertPageBlock(ctx, versionId, 'association.members', order, {}, {});
        }
      }
      order += 1;
      insertPageBlock(ctx, versionId, 'content.rich-text', order, { html: row.content_zh || '' }, { html: row.content_en || '' });

      ctx.run('UPDATE page_versions SET seo = ? WHERE id = ?', JSON.stringify({
        titleZh: row.meta_title_zh,
        titleEn: row.meta_title_en,
        descriptionZh: row.meta_desc_zh,
        descriptionEn: row.meta_desc_en,
      }), versionId);
      publishPage(ctx, pageId, versionId, adminId);
      ctx.recordMap('pages', row.id, 'page_nodes', pageId, 'migrate-content', 'done');
      ctx.plan(`page: ${row.slug} -> ${pagePath}`);
    } catch (error) {
      ctx.recordMap('pages', row.id, 'page_nodes', '', 'migrate-content', 'failed', String(error.message || error));
      ctx.fail(`pages:${row.id}`, String(error.message || error));
    }
  }
}

// Legacy media table rows are assets in their own right; migrate those not
// already pulled in via inline URLs (checksum dedupe makes this safe).
function migrateMediaTable(ctx) {
  const rows = ctx.conn.prepare('SELECT * FROM media ORDER BY id').all();
  ctx.report.counts.legacy.media = rows.length;
  for (const row of rows) {
    if (ctx.alreadyMapped('media', row.id, 'media_assets')) continue;
    const id = ensureMediaForUrl(ctx, row.url, { alt: row.original_name, source: `media:${row.id}` });
    if (id) {
      ctx.recordMap('media', row.id, 'media_assets', id, 'migrate-content', 'done');
    } else {
      ctx.recordMap('media', row.id, 'media_assets', '', 'migrate-content', 'failed', 'file missing or external');
    }
  }
}

// ---------------------------------------------------------------------------
// verification
// ---------------------------------------------------------------------------

function verify(ctx) {
  const { conn, report } = ctx;
  report.counts.migrated.mediaAssets = conn.prepare('SELECT COUNT(*) AS n FROM media_assets').get().n;
  report.counts.migrated.pageNodes = conn.prepare('SELECT COUNT(*) AS n FROM page_nodes WHERE deleted_at IS NULL').get().n;
  report.counts.migrated.pageVersionsPublished = conn.prepare("SELECT COUNT(*) AS n FROM page_versions WHERE status = 'published'").get().n;
  report.counts.migrated.newsItems = conn.prepare('SELECT COUNT(*) AS n FROM news_items').get().n;
  report.counts.migrated.newsPublished = conn.prepare("SELECT COUNT(*) AS n FROM news_items WHERE status = 'published'").get().n;
  report.counts.migrated.redirects = conn.prepare('SELECT COUNT(*) AS n FROM redirects').get().n;

  // Orphan checks: config media ids with no active asset, dangling covers,
  // news without header block at position 1.
  const assets = new Set(conn.prepare("SELECT id FROM media_assets WHERE status = 'active'").all().map((row) => row.id));
  const coverRows = conn.prepare('SELECT id, cover_media_id FROM news_items WHERE cover_media_id IS NOT NULL').all();
  for (const row of coverRows) {
    if (!assets.has(row.cover_media_id)) {
      report.orphans.push({ kind: 'news_cover_missing_asset', newsId: row.id, mediaId: row.cover_media_id });
    }
  }
  const refRows = conn.prepare('SELECT media_id, ref_type, ref_id FROM media_references').all();
  for (const row of refRows) {
    if (!assets.has(row.media_id)) {
      report.orphans.push({ kind: 'reference_missing_asset', ...row });
    }
  }
  return report;
}

// ---------------------------------------------------------------------------
// entry
// ---------------------------------------------------------------------------

function runMigration(conn, options = {}) {
  const ctx = createContext(conn, options);
  const adminId = conn.prepare('SELECT id FROM admins ORDER BY id LIMIT 1').get()?.id ?? null;
  const work = () => {
    migrateMediaTable(ctx);
    migrateNews(ctx);
    migrateHomepage(ctx, adminId);
    migrateLegacyPages(ctx, adminId);
  };
  if (ctx.dryRun) {
    work();
  } else {
    conn.transaction(work)();
    ctx.report.systemPages = ensureSystemPages(conn);
  }
  return verify(ctx);
}

function backupDatabase(dbPath, report) {
  const backupsDir = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupsDir, `${path.basename(dbPath, '.db')}.${stamp}.bak`);
  fs.copyFileSync(dbPath, target);
  report.backup = target;
  return target;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noBackup = args.includes('--no-backup');
  const dbFlagIndex = args.indexOf('--db');
  const dbPath = dbFlagIndex >= 0 ? args[dbFlagIndex + 1] : process.env.HKBA_DB_PATH || path.join(__dirname, '..', 'db', 'hkba.db');
  if (!fs.existsSync(dbPath)) {
    console.error(`database not found: ${dbPath}`);
    process.exit(1);
  }

  // Open the target database directly (not the singleton) so --db works
  // against copies and test fixtures without touching the live connection.
  const Database = require('better-sqlite3');
  const conn = new Database(dbPath);

  let backupPath = null;
  if (!dryRun && !noBackup) {
    backupPath = backupDatabase(dbPath, {});
    console.log(`backup: ${backupPath}`);
  }

  const report = runMigration(conn, { dryRun });
  if (backupPath) report.backup = backupPath;
  report.finishedAt = new Date().toISOString();
  conn.close();
  console.log(JSON.stringify(report, null, 2));
  const hardFailures = report.failures.length + report.orphans.length;
  process.exit(hardFailures > 0 ? 2 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { runMigration, slugify };
