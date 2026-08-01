const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const newsQuery = require('./newsQuery');

test('queryPublishedNewsByIds preserves requested order and excludes non-published rows', () => {
  assert.equal(typeof newsQuery.queryPublishedNewsByIds, 'function');

  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE news_items (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      title_zh TEXT NOT NULL,
      title_en TEXT NOT NULL,
      summary_zh TEXT NOT NULL,
      summary_en TEXT NOT NULL,
      cover_media_id TEXT,
      published_at TEXT,
      display_year INTEGER,
      status TEXT NOT NULL
    );
  `);
  const insert = db.prepare(`
    INSERT INTO news_items
      (id, slug, title_zh, title_en, summary_zh, summary_en, published_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run('a', 'a', '甲', 'A', '甲摘要', 'A summary', '2026-08-01', 'published');
  insert.run('b', 'b', '乙', 'B', '乙摘要', 'B summary', '2026-08-02', 'published');
  insert.run('draft', 'draft', '草稿', 'Draft', '草稿摘要', 'Draft summary', null, 'draft');

  const rows = newsQuery.queryPublishedNewsByIds(db, ['draft', 'b', 'a', 'b']);
  assert.deepEqual(rows.map((row) => row.id), ['b', 'a']);
  db.close();
});
