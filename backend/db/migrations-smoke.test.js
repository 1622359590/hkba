const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { migrate } = require('./migrate');

const M1_TABLES = [
  'legacy_id_map',
  'page_nodes',
  'page_versions',
  'page_blocks',
  'media_assets',
  'media_references',
  'news_items',
  'news_revisions',
  'news_blocks',
  'news_categories',
  'news_tags',
  'news_category_map',
  'news_tag_map',
  'roles',
  'permissions',
  'role_permissions',
  'user_roles',
  'audit_events',
  'preview_tokens',
  'redirects',
  'publish_records',
  'cleanup_tasks',
  'storage_settings',
  'page_draft_snapshots',
  'page_draft_snapshot_blocks',
];

const M1_INDEXES = [
  'idx_page_nodes_slug_per_parent',
  'idx_page_blocks_anchor',
  'idx_news_blocks_single_header',
  'idx_media_assets_checksum',
  'idx_legacy_id_map_new',
  'idx_publish_records_object',
  'idx_page_draft_snapshots_page',
  'idx_page_draft_snapshot_blocks_snapshot',
];

function makeTempDb(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-m1-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const conn = new Database(path.join(dir, 'test.db'));
  conn.pragma('foreign_keys = ON');
  t.after(() => conn.close());
  migrate(conn);
  return conn;
}

function objectExists(conn, type, name) {
  return Boolean(
    conn
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?`)
      .get(type, name)
  );
}

test('creates every M1 table and index on a fresh database', (t) => {
  const conn = makeTempDb(t);
  for (const table of M1_TABLES) {
    assert.ok(objectExists(conn, 'table', table), `missing table: ${table}`);
  }
  for (const index of M1_INDEXES) {
    assert.ok(objectExists(conn, 'index', index), `missing index: ${index}`);
  }
  const recorded = conn.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count;
  assert.equal(recorded, 16);
  // 008 adds user_agent to audit_events.
  const auditColumns = conn.prepare('PRAGMA table_info(audit_events)').all().map((col) => col.name);
  assert.ok(auditColumns.includes('user_agent'));
  // 010 generalizes mutation_log to any draft owner.
  const mutationColumns = conn.prepare('PRAGMA table_info(mutation_log)').all().map((col) => col.name);
  assert.ok(mutationColumns.includes('owner_id'));
  assert.ok(!mutationColumns.includes('page_id'));
  const mediaColumns = conn.prepare('PRAGMA table_info(media_assets)').all().map((col) => col.name);
  assert.ok(mediaColumns.includes('storage_provider'));
  assert.ok(mediaColumns.includes('public_url'));
});

test('partner carousel migration updates only About-page partner blocks and preserves playback choices', (t) => {
  const conn = makeTempDb(t);
  conn.prepare("INSERT INTO page_nodes (id, node_type, slug, path) VALUES ('about-page', 'page', 'about', '/about')").run();
  conn.prepare("INSERT INTO page_nodes (id, node_type, slug, path) VALUES ('home-page', 'page', 'home', '/')").run();
  conn.prepare("INSERT INTO page_versions (id, page_id, revision) VALUES ('about-version', 'about-page', 1)").run();
  conn.prepare("INSERT INTO page_versions (id, page_id, revision) VALUES ('home-version', 'home-page', 1)").run();
  conn.prepare("INSERT INTO page_blocks (id, page_version_id, component_type, sort_order, settings) VALUES ('about-partners', 'about-version', 'association.partners', 1, ?)")
    .run(JSON.stringify({ variant: 'logo-wall', autoPlay: false, speed: 'fast', direction: 'right', pauseOnHover: false }));
  conn.prepare("INSERT INTO page_blocks (id, page_version_id, component_type, sort_order, settings) VALUES ('home-partners', 'home-version', 'association.partners', 1, ?)")
    .run(JSON.stringify({ variant: 'logo-wall' }));

  const migration = fs.readFileSync(path.join(__dirname, 'migrations/011_about_partner_carousel.sql'), 'utf8');
  conn.exec(migration);

  assert.deepEqual(JSON.parse(conn.prepare("SELECT settings FROM page_blocks WHERE id = 'about-partners'").get().settings), {
    variant: 'carousel',
    autoPlay: false,
    speed: 'fast',
    direction: 'right',
    pauseOnHover: false,
  });
  assert.deepEqual(JSON.parse(conn.prepare("SELECT settings FROM page_blocks WHERE id = 'home-partners'").get().settings), {
    variant: 'logo-wall',
  });
});

test('home partner carousel migration updates only Home-page partner blocks and preserves playback choices', (t) => {
  const conn = makeTempDb(t);
  conn.prepare("INSERT INTO page_nodes (id, node_type, slug, path) VALUES ('home-page', 'page', 'home', '/')").run();
  conn.prepare("INSERT INTO page_nodes (id, node_type, slug, path) VALUES ('members-page', 'page', 'members', '/members')").run();
  conn.prepare("INSERT INTO page_versions (id, page_id, revision) VALUES ('home-version', 'home-page', 1)").run();
  conn.prepare("INSERT INTO page_versions (id, page_id, revision) VALUES ('members-version', 'members-page', 1)").run();
  conn.prepare("INSERT INTO page_blocks (id, page_version_id, component_type, sort_order, settings) VALUES ('home-partners', 'home-version', 'association.partners', 1, ?)")
    .run(JSON.stringify({ variant: 'logo-wall', autoPlay: false, speed: 'normal', direction: 'right', pauseOnHover: false }));
  conn.prepare("INSERT INTO page_blocks (id, page_version_id, component_type, sort_order, settings) VALUES ('members-partners', 'members-version', 'association.partners', 1, ?)")
    .run(JSON.stringify({ variant: 'logo-wall' }));

  const migration = fs.readFileSync(path.join(__dirname, 'migrations/012_home_partner_carousel.sql'), 'utf8');
  conn.exec(migration);

  assert.deepEqual(JSON.parse(conn.prepare("SELECT settings FROM page_blocks WHERE id = 'home-partners'").get().settings), {
    variant: 'carousel',
    autoPlay: false,
    speed: 'normal',
    direction: 'right',
    pauseOnHover: false,
  });
  assert.deepEqual(JSON.parse(conn.prepare("SELECT settings FROM page_blocks WHERE id = 'members-partners'").get().settings), {
    variant: 'logo-wall',
  });
});

test('home partner carousel repair restores later Home-page grid saves without changing other pages', (t) => {
  const conn = makeTempDb(t);
  conn.prepare("INSERT INTO page_nodes (id, node_type, slug, path) VALUES ('home-page', 'page', 'home', '/')").run();
  conn.prepare("INSERT INTO page_nodes (id, node_type, slug, path) VALUES ('members-page', 'page', 'members', '/members')").run();
  conn.prepare("INSERT INTO page_versions (id, page_id, revision) VALUES ('home-version', 'home-page', 1)").run();
  conn.prepare("INSERT INTO page_versions (id, page_id, revision) VALUES ('members-version', 'members-page', 1)").run();
  conn.prepare("INSERT INTO page_blocks (id, page_version_id, component_type, sort_order, settings) VALUES ('home-partners', 'home-version', 'association.partners', 1, ?)")
    .run(JSON.stringify({ variant: 'logo-wall', autoPlay: false, speed: 'fast', direction: 'right', pauseOnHover: false }));
  conn.prepare("INSERT INTO page_blocks (id, page_version_id, component_type, sort_order, settings) VALUES ('members-partners', 'members-version', 'association.partners', 1, ?)")
    .run(JSON.stringify({ variant: 'cards' }));

  const migration = fs.readFileSync(path.join(__dirname, 'migrations/015_restore_home_partner_carousel.sql'), 'utf8');
  conn.exec(migration);

  assert.deepEqual(JSON.parse(conn.prepare("SELECT settings FROM page_blocks WHERE id = 'home-partners'").get().settings), {
    variant: 'carousel',
    autoPlay: false,
    speed: 'fast',
    direction: 'right',
    pauseOnHover: false,
  });
  assert.deepEqual(JSON.parse(conn.prepare("SELECT settings FROM page_blocks WHERE id = 'members-partners'").get().settings), {
    variant: 'cards',
  });
});

test('page_nodes enforces per-parent slug uniqueness and site-wide path uniqueness', (t) => {
  const conn = makeTempDb(t);
  const insert = conn.prepare(
    'INSERT INTO page_nodes (id, parent_id, node_type, slug, path) VALUES (?, ?, ?, ?, ?)'
  );
  insert.run('root-a', null, 'section', 'about', '/about');
  insert.run('root-b', null, 'section', 'company', '/company');
  // Same slug under different parents is allowed.
  insert.run('child-a', 'root-a', 'page', 'team', '/about/team');
  insert.run('child-b', 'root-b', 'page', 'team', '/company/team');

  assert.throws(() => insert.run('dup-root', null, 'section', 'about', '/about-2'));
  assert.throws(() => insert.run('dup-child', 'root-a', 'page', 'team', '/about/team-2'));
  assert.throws(() => insert.run('dup-path', 'root-b', 'page', 'other', '/about/team'));
});

test('page_nodes CHECK constraints reject invalid enums', (t) => {
  const conn = makeTempDb(t);
  const insert = conn.prepare(
    'INSERT INTO page_nodes (id, parent_id, node_type, slug, path, navigation_status) VALUES (?, NULL, ?, ?, ?, ?)'
  );
  assert.throws(() => insert.run('x1', 'folder', 'x', '/x', 'visible'));
  assert.throws(() => insert.run('x2', 'page', 'x2', '/x2', 'floating'));
  insert.run('ok', 'section', 'ok', '/ok', 'external');
});

test('page_versions keeps one row per page revision', (t) => {
  const conn = makeTempDb(t);
  conn.prepare("INSERT INTO page_nodes (id, node_type, slug, path) VALUES ('p', 'page', 'p', '/p')").run();
  const insert = conn.prepare(
    "INSERT INTO page_versions (id, page_id, revision, status) VALUES (?, 'p', ?, ?)"
  );
  insert.run('v1', 1, 'draft');
  insert.run('v2', 2, 'published');
  assert.throws(() => insert.run('v3', 2, 'draft'));
  assert.throws(() => insert.run('v4', 3, 'archived'));
  assert.throws(() => insert.run('v5', 0, 'draft'));
  // FK: version of a missing page is rejected.
  assert.throws(() =>
    conn.prepare("INSERT INTO page_versions (id, page_id, revision) VALUES ('v9', 'ghost', 1)").run()
  );
});

test('page_blocks anchors are unique per version only when present', (t) => {
  const conn = makeTempDb(t);
  conn.prepare("INSERT INTO page_nodes (id, node_type, slug, path) VALUES ('p', 'page', 'p', '/p')").run();
  conn.prepare("INSERT INTO page_versions (id, page_id, revision) VALUES ('v', 'p', 1)").run();
  const insert = conn.prepare(
    "INSERT INTO page_blocks (id, page_version_id, component_type, sort_order, anchor_id) VALUES (?, 'v', ?, ?, ?)"
  );
  insert.run('b1', 'content.hero', 1, 'top');
  insert.run('b2', 'content.rich-text', 2, null);
  insert.run('b3', 'content.rich-text', 3, null); // NULL anchors do not collide
  assert.throws(() => insert.run('b4', 'content.cta', 4, 'top'));
  // Self-FK parent must exist inside the same table.
  assert.throws(() =>
    conn
      .prepare("INSERT INTO page_blocks (id, page_version_id, component_type, parent_block_id) VALUES ('b9', 'v', 'content.cta', 'ghost')")
      .run()
  );
});

test('news_items enforces slug uniqueness, status enum and four-digit display_year', (t) => {
  const conn = makeTempDb(t);
  const insert = conn.prepare(
    'INSERT INTO news_items (id, slug, status, display_year) VALUES (?, ?, ?, ?)'
  );
  insert.run('n1', 'launch', 'published', 2026);
  insert.run('n2', 'launch-2', 'draft', null);
  assert.throws(() => insert.run('n3', 'launch', 'draft', 2026));
  assert.throws(() => insert.run('n4', 'x', 'archived', 2026));
  assert.throws(() => insert.run('n5', 'y', 'draft', 123));
  assert.throws(() => insert.run('n6', 'z', 'draft', 10000));
});

test('news_blocks allows exactly one header per news per revision', (t) => {
  const conn = makeTempDb(t);
  conn.prepare("INSERT INTO news_items (id, slug) VALUES ('n', 'n')").run();
  const insert = conn.prepare(
    'INSERT INTO news_blocks (id, news_id, revision, block_type, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  insert.run('h1', 'n', 1, 'news.header', 0);
  insert.run('r1', 'n', 1, 'content.rich-text', 1);
  insert.run('r2', 'n', 1, 'content.rich-text', 2);
  assert.throws(() => insert.run('h2', 'n', 1, 'news.header', 3));
  // A new revision gets its own header.
  insert.run('h3', 'n', 2, 'news.header', 0);
});

test('news taxonomy links reject duplicates through composite primary keys', (t) => {
  const conn = makeTempDb(t);
  conn.prepare("INSERT INTO news_items (id, slug) VALUES ('n', 'n')").run();
  conn.prepare("INSERT INTO news_categories (id, slug) VALUES ('c', 'announcements')").run();
  conn.prepare("INSERT INTO news_tags (id, slug) VALUES ('t', 'web3')").run();
  conn.prepare("INSERT INTO news_category_map (news_id, category_id) VALUES ('n', 'c')").run();
  conn.prepare("INSERT INTO news_tag_map (news_id, tag_id) VALUES ('n', 't')").run();
  assert.throws(() =>
    conn.prepare("INSERT INTO news_category_map (news_id, category_id) VALUES ('n', 'c')").run()
  );
  assert.throws(() =>
    conn.prepare("INSERT INTO news_tag_map (news_id, tag_id) VALUES ('n', 't')").run()
  );
});

test('media_assets rejects negative sizes and duplicate storage keys', (t) => {
  const conn = makeTempDb(t);
  const insert = conn.prepare(
    "INSERT INTO media_assets (id, storage_key, mime_type, size_bytes, status) VALUES (?, ?, 'image/png', ?, ?)"
  );
  insert.run('m1', 'uploads/a.png', 100, 'active');
  assert.throws(() => insert.run('m2', 'uploads/a.png', 50, 'active'));
  assert.throws(() => insert.run('m3', 'uploads/b.png', -1, 'active'));
  assert.throws(() => insert.run('m4', 'uploads/c.png', 10, 'lost'));
});

test('media_references dedupes the same logical reference', (t) => {
  const conn = makeTempDb(t);
  conn.prepare(
    "INSERT INTO media_assets (id, storage_key, mime_type, size_bytes) VALUES ('m', 'uploads/a.png', 'image/png', 100)"
  ).run();
  const insert = conn.prepare(
    "INSERT INTO media_references (id, media_id, ref_type, ref_id) VALUES (?, 'm', ?, ?)"
  );
  insert.run('r1', 'page_block', 'b1');
  insert.run('r2', 'news_cover', 'n1');
  assert.throws(() => insert.run('r3', 'page_block', 'b1'));
  assert.throws(() => insert.run('r4', 'page_block', 'b1'));
});

test('legacy_id_map enforces idempotent old-to-new mappings', (t) => {
  const conn = makeTempDb(t);
  const insert = conn.prepare(
    'INSERT INTO legacy_id_map (id, old_table, old_id, new_table, new_id) VALUES (?, ?, ?, ?, ?)'
  );
  insert.run('x1', 'news', 7, 'news_items', 'uuid-1');
  // The same legacy row mapped to another new table is a distinct mapping.
  insert.run('x2', 'news', 7, 'media_assets', 'uuid-2');
  assert.throws(() => insert.run('x3', 'news', 7, 'news_items', 'uuid-3'));
});

test('operational tables enforce their enums and uniqueness', (t) => {
  const conn = makeTempDb(t);
  assert.throws(() =>
    conn.prepare("INSERT INTO redirects (id, from_path, to_path, status_code) VALUES ('r', '/a', '/b', 307)").run()
  );
  conn.prepare("INSERT INTO redirects (id, from_path, to_path) VALUES ('r2', '/a', '/b')").run();
  assert.throws(() =>
    conn.prepare("INSERT INTO redirects (id, from_path, to_path) VALUES ('r3', '/a', '/c')").run()
  );
  assert.throws(() =>
    conn.prepare("INSERT INTO publish_records (id, object_type, object_id, version_id, revision, action) VALUES ('p', 'page', 'o', 'v', 1, 'archive')").run()
  );
  assert.throws(() =>
    conn.prepare("INSERT INTO cleanup_tasks (id, task_type, status) VALUES ('c', 'retention', 'exploded')").run()
  );
  assert.throws(() =>
    conn.prepare("INSERT INTO preview_tokens (id, object_type, object_id, revision, token_hash, expires_at) VALUES ('t', 'media', 'o', 1, 'h', '2030-01-01')").run()
  );
});
