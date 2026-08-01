// Public news queries (spec: data-api §6; decision D7).
//
// Only `published` items are ever returned. Year filtering follows
// displayYear ?? year(publishedAt) — implemented in SQL so the public
// endpoint stays a single indexed query. Mounted publicly only at the
// frontend-switch milestone (the legacy /api/news route serves the live
// site until then); this lib lands with M5 so the year semantics are locked
// by tests now.

// Effective year of an item: display_year when set, else the calendar year
// of published_at. SQLite stores published_at as 'YYYY-MM-DD HH:MM:SS'.
const EFFECTIVE_YEAR_SQL = "COALESCE(display_year, CAST(strftime('%Y', published_at) AS INTEGER))";

// queryPublishedNews(conn, { year, categoryId, tagId, page, pageSize, slugPrefix? })
// Returns { items, total, page, pageSize } ordered by published_at DESC.
function queryPublishedNews(conn, { year, categoryId, tagId, page = 1, pageSize = 10 } = {}) {
  const where = ["status = 'published'"];
  const params = [];
  if (Number.isInteger(year)) {
    where.push(`${EFFECTIVE_YEAR_SQL} = ?`);
    params.push(year);
  }
  if (categoryId) {
    where.push('EXISTS (SELECT 1 FROM news_category_map cm WHERE cm.news_id = news_items.id AND cm.category_id = ?)');
    params.push(categoryId);
  }
  if (tagId) {
    where.push('EXISTS (SELECT 1 FROM news_tag_map tm WHERE tm.news_id = news_items.id AND tm.tag_id = ?)');
    params.push(tagId);
  }
  const clause = `WHERE ${where.join(' AND ')}`;

  const safePage = Math.max(1, page);
  const safeSize = Math.min(50, Math.max(1, pageSize));
  const total = conn.prepare(`SELECT COUNT(*) AS n FROM news_items ${clause}`).get(...params).n;
  const items = conn
    .prepare(
      `SELECT id, slug, title_zh, title_en, summary_zh, summary_en, cover_media_id,
              published_at, display_year, ${EFFECTIVE_YEAR_SQL} AS effective_year
       FROM news_items ${clause}
       ORDER BY published_at DESC, id
       LIMIT ? OFFSET ?`
    )
    .all(...params, safeSize, (safePage - 1) * safeSize);
  return { items, total, page: safePage, pageSize: safeSize };
}

function queryPublishedNewsByIds(conn, ids = []) {
  const ordered = [...new Set(ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))].slice(0, 24);
  if (!ordered.length) return [];
  const rows = conn
    .prepare(
      `SELECT id, slug, title_zh, title_en, summary_zh, summary_en, cover_media_id,
              published_at, display_year, ${EFFECTIVE_YEAR_SQL} AS effective_year
       FROM news_items
       WHERE status = 'published' AND id IN (${ordered.map(() => '?').join(',')})`
    )
    .all(...ordered);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ordered.map((id) => byId.get(id)).filter(Boolean);
}

// getPublishedNewsBySlug(conn, slug) — one published item with its blocks at
// published_revision, or null.
function getPublishedNewsBySlug(conn, slug) {
  const item = conn
    .prepare("SELECT * FROM news_items WHERE slug = ? AND status = 'published'")
    .get(slug);
  if (!item || item.published_revision == null) return null;
  const blocks = conn
    .prepare('SELECT * FROM news_blocks WHERE news_id = ? AND revision = ? ORDER BY sort_order, created_at')
    .all(item.id, item.published_revision);
  return { item, blocks };
}

// listPublishedYears(conn) — distinct effective years of published items,
// newest first (spec: year lists come from real published content only).
function listPublishedYears(conn) {
  return conn
    .prepare(
      `SELECT DISTINCT ${EFFECTIVE_YEAR_SQL} AS year
       FROM news_items
       WHERE status = 'published' AND ${EFFECTIVE_YEAR_SQL} IS NOT NULL
       ORDER BY year DESC`
    )
    .all()
    .map((row) => row.year);
}

module.exports = { EFFECTIVE_YEAR_SQL, queryPublishedNews, queryPublishedNewsByIds, getPublishedNewsBySlug, listPublishedYears };
