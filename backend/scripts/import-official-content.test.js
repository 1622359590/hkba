const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { migrate } = require('../db/migrate');
const snapshot = require('../data/official-content.json');
const { importOfficialContent } = require('./import-official-content');

test('imports the official snapshot idempotently into structured data and page drafts', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrate(db);

  const first = importOfficialContent(db, snapshot);
  assert.equal(first.skipped, false);
  assert.equal(first.members, snapshot.members.length);
  assert.deepEqual(first.pages.sort(), ['/', '/about', '/contact', '/join', '/members', '/news']);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM team_members WHERE is_active = 1').get().count, snapshot.members.length);
  assert.equal(db.prepare("SELECT value FROM contact_info WHERE key = 'map_embed_url'").get().value, snapshot.contact.map_embed_url);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM page_nodes WHERE path = '/join'").get().count, 1);
  const aboutPartners = db.prepare(`
    SELECT page_blocks.settings
    FROM page_blocks
    JOIN page_versions ON page_versions.id = page_blocks.page_version_id
    JOIN page_nodes ON page_nodes.id = page_versions.page_id
    WHERE page_nodes.path = '/about' AND page_blocks.component_type = 'association.partners'
    ORDER BY page_versions.revision DESC
    LIMIT 1
  `).get();
  assert.deepEqual(JSON.parse(aboutPartners.settings), {
    variant: 'carousel',
    autoPlay: true,
    speed: 'slow',
    direction: 'left',
    pauseOnHover: true,
  });
  const homePartners = db.prepare(`
    SELECT page_blocks.settings
    FROM page_blocks
    JOIN page_versions ON page_versions.id = page_blocks.page_version_id
    JOIN page_nodes ON page_nodes.id = page_versions.page_id
    WHERE page_nodes.path = '/' AND page_blocks.component_type = 'association.partners'
    ORDER BY page_versions.revision DESC
    LIMIT 1
  `).get();
  assert.deepEqual(JSON.parse(homePartners.settings), {
    variant: 'carousel',
    autoPlay: true,
    speed: 'slow',
    direction: 'left',
    pauseOnHover: true,
  });

  const second = importOfficialContent(db, snapshot);
  assert.equal(second.skipped, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM team_members WHERE is_active = 1').get().count, snapshot.members.length);
  db.close();
});
