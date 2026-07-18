// Public content API (M8: frontend rendering switch; spec data-api §11).
//
// Read-only endpoints serving *published* content to the live site:
//   GET /api/public/page?path=/about      — page node + published block tree
//   GET /api/public/news                  — published news list (year/category/tag)
//   GET /api/public/news/years            — distinct published years
//   GET /api/public/news/categories       — active categories with counts
//   GET /api/public/news/item/:slug       — one published item with blocks
//   GET /api/public/redirects             — redirect table for the Next.js layer
//   GET /api/public/sitemap-data          — paths + slugs for sitemap.xml
//
// Responses are no-store: publishing must be visible immediately and there
// is no cache-invalidation layer yet (spec §10 step 7 deferred). Legacy
// routes (/api/news, /api/pages) stay untouched — the frontend falls back to
// them until content is migrated (M9).

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const { requestContext } = require('../lib/respond');
const registry = require('../components/registry');
const { extractMediaIds } = require('../lib/mediaReferences');
const { loadBlocks } = require('../lib/drafts');
const { queryPublishedNews, getPublishedNewsBySlug, listPublishedYears } = require('../lib/newsQuery');

router.use(requestContext);
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Uniform block shape for the shared renderer — page_blocks use
// component_type, news_blocks use block_type; both become component_type.
function blockJson(block) {
  return {
    id: block.id,
    component_type: block.component_type || block.block_type,
    parent_block_id: block.parent_block_id || null,
    sort_order: block.sort_order,
    anchor_id: block.anchor_id || null,
    contentZh: JSON.parse(block.content_zh || '{}'),
    contentEn: JSON.parse(block.content_en || '{}'),
    settings: JSON.parse(block.settings || '{}'),
  };
}

// Resolves every media id referenced by the given parsed blocks into
// { id: { url, altZh, altEn } } for the renderer. Extra ids (e.g. a news
// cover that lives on the item row, not in a block) can be folded in.
function mediaMapFor(conn, parsedBlocks, extraIds = []) {
  const ids = new Set(extraIds.filter(Boolean));
  for (const block of parsedBlocks) {
    const definition = registry.getDefinition(block.component_type);
    for (const id of extractMediaIds(definition, block)) ids.add(id);
  }
  if (!ids.size) return {};
  const list = [...ids];
  const rows = conn
    .prepare(`SELECT id, storage_key, alt_zh, alt_en FROM media_assets WHERE status = 'active' AND id IN (${list.map(() => '?').join(',')})`)
    .all(...list);
  const map = {};
  for (const row of rows) {
    map[row.id] = { url: `/uploads/${row.storage_key}`, altZh: row.alt_zh || '', altEn: row.alt_en || '' };
  }
  return map;
}

function taxonomyFor(conn, newsId) {
  const categories = conn
    .prepare(
      `SELECT c.id, c.slug, c.name_zh AS nameZh, c.name_en AS nameEn
       FROM news_categories c JOIN news_category_map m ON m.category_id = c.id
       WHERE m.news_id = ? ORDER BY c.sort_order, c.created_at`
    )
    .all(newsId);
  const tags = conn
    .prepare(
      `SELECT t.id, t.slug, t.name_zh AS nameZh, t.name_en AS nameEn
       FROM news_tags t JOIN news_tag_map m ON m.tag_id = t.id
       WHERE m.news_id = ? ORDER BY t.created_at`
    )
    .all(newsId);
  return { categories, tags };
}

// ---------- pages ----------

router.get('/page', (req, res) => {
  const pagePath = String(req.query.path || '/');
  const conn = getDb();
  const node = conn.prepare('SELECT * FROM page_nodes WHERE path = ? AND deleted_at IS NULL').get(pagePath);
  if (!node || !node.published_version_id) {
    return res.fail('NOT_PUBLISHED', '頁面尚未發佈', [], 404);
  }
  const version = conn.prepare('SELECT * FROM page_versions WHERE id = ?').get(node.published_version_id);
  if (!version) return res.fail('NOT_PUBLISHED', '頁面尚未發佈', [], 404);
  const blocks = loadBlocks(conn, version.id).map(blockJson);
  res.ok({
    path: node.path,
    titleZh: node.title_zh,
    titleEn: node.title_en,
    seo: JSON.parse(version.seo || '{}'),
    revision: version.revision,
    publishedAt: version.published_at,
    blocks,
    media: mediaMapFor(conn, blocks),
  });
});

// ---------- news ----------

router.get('/news', (req, res) => {
  const conn = getDb();
  const rawYear = Number(req.query.year);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
  const result = queryPublishedNews(conn, {
    year: Number.isInteger(rawYear) && rawYear > 0 ? rawYear : undefined,
    categoryId: req.query.categoryId || undefined,
    tagId: req.query.tagId || undefined,
    page,
    pageSize,
  });
  const items = result.items.map((item) => {
    const cover = item.cover_media_id
      ? conn.prepare("SELECT storage_key, alt_zh, alt_en FROM media_assets WHERE id = ? AND status = 'active'").get(item.cover_media_id)
      : null;
    return {
      id: item.id,
      slug: item.slug,
      titleZh: item.title_zh,
      titleEn: item.title_en,
      summaryZh: item.summary_zh,
      summaryEn: item.summary_en,
      year: item.effective_year,
      publishedAt: item.published_at,
      cover: cover ? { url: `/uploads/${cover.storage_key}`, altZh: cover.alt_zh || '', altEn: cover.alt_en || '' } : null,
      ...taxonomyFor(conn, item.id),
    };
  });
  res.ok({ items, total: result.total, page: result.page, pageSize: result.pageSize });
});

// Registered before /news/item/:slug so the literal path wins.
router.get('/news/years', (req, res) => {
  res.ok({ years: listPublishedYears(getDb()) });
});

router.get('/news/categories', (req, res) => {
  const conn = getDb();
  const items = conn
    .prepare(
      `SELECT c.id, c.slug, c.name_zh AS nameZh, c.name_en AS nameEn,
              (SELECT COUNT(*) FROM news_category_map m JOIN news_items n ON n.id = m.news_id AND n.status = 'published' WHERE m.category_id = c.id) AS publishedCount
       FROM news_categories c WHERE c.is_active = 1 ORDER BY c.sort_order, c.created_at`
    )
    .all();
  res.ok({ items });
});

router.get('/news/item/:slug', (req, res) => {
  const conn = getDb();
  const slug = String(req.params.slug);
  const found = getPublishedNewsBySlug(conn, slug);
  if (!found) {
    // Slug aliases land in the redirect table (D8: legacy numeric /news/:id
    // URLs 301 to the slug URL once migration writes the rows). The client
    // replaces the URL; the Next.js layer issues true 301s for direct hits.
    const redirect = conn.prepare('SELECT to_path FROM redirects WHERE from_path = ?').get(`/news/${slug}`);
    if (redirect) return res.ok({ redirect: redirect.to_path });
    return res.fail('NOT_FOUND', '新聞不存在或未發佈', [], 404);
  }
  const { item, blocks } = found;
  const parsed = blocks.map(blockJson);
  const media = mediaMapFor(conn, parsed, [item.cover_media_id]);
  res.ok({
    item: {
      id: item.id,
      slug: item.slug,
      titleZh: item.title_zh,
      titleEn: item.title_en,
      summaryZh: item.summary_zh,
      summaryEn: item.summary_en,
      seo: JSON.parse(item.seo || '{}'),
      coverMediaId: item.cover_media_id || null,
      cover: item.cover_media_id && media[item.cover_media_id] ? media[item.cover_media_id] : null,
      year: item.display_year || (item.published_at ? Number(String(item.published_at).slice(0, 4)) : null),
      publishedAt: item.published_at,
      revision: item.published_revision,
      ...taxonomyFor(conn, item.id),
    },
    blocks: parsed,
    media,
  });
});

// ---------- redirects & sitemap ----------

router.get('/redirects', (req, res) => {
  const items = getDb()
    .prepare('SELECT from_path AS "from", to_path AS "to", status_code AS statusCode FROM redirects ORDER BY created_at')
    .all();
  res.ok({ items });
});

router.get('/sitemap-data', (req, res) => {
  const conn = getDb();
  const pages = conn
    .prepare(
      `SELECT n.path, v.published_at AS updatedAt
       FROM page_nodes n JOIN page_versions v ON v.id = n.published_version_id
       WHERE n.deleted_at IS NULL AND n.navigation_status != 'hidden' ORDER BY n.path`
    )
    .all();
  const news = conn
    .prepare("SELECT slug, published_at AS publishedAt FROM news_items WHERE status = 'published' ORDER BY published_at DESC")
    .all();
  res.ok({ pages, news });
});

// ---------- association data (structured legacy tables; visual-strike task) ----------
//
// One read-only payload feeding every association.* block renderer. The data
// stays in the structured tables (partners / team_members / milestones /
// contact_info); resolvers never copy it into page content. Image URLs are
// whatever the source rows point at — after import-external-media runs they
// are local /uploads/ paths.
router.get('/association', (req, res) => {
  const conn = getDb();
  const partners = conn
    .prepare(
      `SELECT id, name, logo_url AS logoUrl, website_url AS websiteUrl, group_name AS "group"
       FROM partners WHERE is_active = 1 ORDER BY sort_order, id`
    )
    .all();
  const people = conn
    .prepare(
      `SELECT id, name_zh AS nameZh, name_en AS nameEn, title_zh AS titleZh, title_en AS titleEn,
              bio_zh AS bioZh, bio_en AS bioEn, avatar_url AS avatarUrl, group_name AS "group",
              social_facebook AS facebook, social_twitter AS twitter,
              social_linkedin AS linkedin, social_instagram AS instagram
       FROM team_members WHERE is_active = 1 ORDER BY sort_order, id`
    )
    .all();
  const milestones = conn
    .prepare(
      `SELECT id, year, title_zh AS titleZh, title_en AS titleEn,
              description_zh AS descriptionZh, description_en AS descriptionEn
       FROM milestones WHERE is_active = 1 ORDER BY sort_order, id`
    )
    .all();
  const contact = {};
  for (const row of conn.prepare('SELECT key, value FROM contact_info').all()) {
    contact[row.key] = row.value;
  }
  // No structured resources table exists yet; the renderer shows a designed
  // empty state for association.resources.
  res.ok({ partners, people, milestones, contact, resources: [] });
});

module.exports = router;
