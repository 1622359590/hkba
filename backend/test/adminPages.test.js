const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.JWT_SECRET = 'test-secret-for-admin-pages-tests-0123456789';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkba-admin-pages-'));
process.env.HKBA_DB_PATH = path.join(tmpDir, 'admin-pages.db');

const bcrypt = require('bcryptjs');
const express = require('express');

const { initDatabase, getDb, closeDatabase } = require('../db/init');
const authRoutes = require('../routes/auth');
const componentsRoutes = require('../routes/admin/components');
const pagesRoutes = require('../routes/admin/pages');

initDatabase();
const db = getDb();
db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('publisher1', bcrypt.hashSync('publisher-pass', 4));
const publisherId = db.prepare('SELECT id FROM admins WHERE username = ?').get('publisher1').id;
db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, 'publisher')").run(publisherId);

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin/components', componentsRoutes);
app.use('/api/admin/pages', pagesRoutes);

let server;
let base;
let adminCookie;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
  adminCookie = (await login('admin', 'hkba2024')).cookie;
});

test.after(() => {
  server?.close();
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const CSRF = { 'x-requested-with': 'XMLHttpRequest' };

async function login(username, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const setCookie = res.headers.getSetCookie().find((line) => line.startsWith('hkba_admin='));
  return { cookie: setCookie.split(';')[0] };
}

function call(method, path, { body, cookie = adminCookie } = {}) {
  const headers = { cookie, ...CSRF };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const get = (path, opts) => call('GET', path, opts);
const post = (path, body, opts) => call('POST', path, { ...opts, body });
const patch = (path, body, opts) => call('PATCH', path, { ...opts, body });
const del = (path, opts) => call('DELETE', path, opts);

async function createPage(payload) {
  const res = await post('/api/admin/pages', payload);
  return { res, body: await res.json() };
}

// ---------- registry endpoint ----------

test('GET definitions returns the registry in the unified envelope', async () => {
  const res = await get('/api/admin/components/definitions');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.meta.requestId);
  assert.equal(body.data.definitions.length, 30);
  const hero = body.data.definitions.find((d) => d.type === 'content.hero');
  assert.equal(hero.version, 1);
  assert.ok(hero.schema.content.fields.title.required);
});

test('definitions requires authentication; publisher (content.read) may read', async () => {
  const anon = await get('/api/admin/components/definitions', { cookie: '' });
  assert.equal(anon.status, 401);
  const publisher = await login('publisher1', 'publisher-pass');
  const res = await get('/api/admin/components/definitions', { cookie: publisher.cookie });
  assert.equal(res.status, 200);
});

// ---------- page tree CRUD ----------

test('creates pages, rejects bad slugs, and wraps errors uniformly', async () => {
  const { res, body } = await createPage({ nodeType: 'section', slug: 'about', titleZh: '關於我們' });
  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.node.path, '/about');
  assert.equal(body.data.node.missing_en, true);

  const bad = await createPage({ slug: 'Bad Slug!' });
  assert.equal(bad.res.status, 400);
  assert.equal(bad.body.success, false);
  assert.equal(bad.body.error.code, 'VALIDATION_FAILED');
  assert.ok(Array.isArray(bad.body.error.fields));
  assert.ok(bad.body.meta.requestId);
});

test('slug is unique per parent but reusable across parents', async () => {
  await createPage({ nodeType: 'section', slug: 'company', titleZh: '公司' });
  const first = await createPage({ parentId: (await getNodeId('/about')), slug: 'team', titleZh: '團隊' });
  assert.equal(first.res.status, 201);
  const dup = await createPage({ parentId: (await getNodeId('/about')), slug: 'team', titleZh: '重複' });
  assert.equal(dup.res.status, 409);
  assert.equal(dup.body.error.code, 'REFERENCE_EXISTS');
  const other = await createPage({ parentId: (await getNodeId('/company')), slug: 'team', titleZh: '團隊B' });
  assert.equal(other.res.status, 201);
});

let nodeIdCache = new Map();
async function getNodeId(path) {
  if (nodeIdCache.has(path)) return nodeIdCache.get(path);
  const res = await get('/api/admin/pages/tree');
  const body = await res.json();
  const stack = [...body.data.tree];
  while (stack.length) {
    const node = stack.pop();
    if (node.path === path) {
      nodeIdCache.set(path, node.id);
      return node.id;
    }
    stack.push(...node.children);
  }
  throw new Error(`node not found: ${path}`);
}

test('rejects a fourth level and moving a section under its own descendant', async () => {
  const aboutId = await getNodeId('/about');
  const teamId = await getNodeId('/about/team');
  const level3 = await createPage({ parentId: teamId, slug: 'history', titleZh: '歷史' });
  assert.equal(level3.res.status, 201);
  const level4 = await createPage({ parentId: level3.body.data.node.id, slug: 'deep', titleZh: '太深' });
  assert.equal(level4.res.status, 400);
  assert.equal(level4.body.error.fields[0].code, 'depth');

  const cycle = await post(`/api/admin/pages/${aboutId}/move`, { parentId: teamId });
  const cycleBody = await cycle.json();
  assert.equal(cycle.status, 400);
  assert.equal(cycleBody.error.fields[0].code, 'cycle');
});

test('moves a page and recomputes stored subtree paths', async () => {
  const historyId = await getNodeId('/about/team/history');
  const companyId = await getNodeId('/company');
  const res = await post(`/api/admin/pages/${historyId}/move`, { parentId: companyId });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.node.path, '/company/history');
});

test('patch updates titles and rejects invalid navigation status', async () => {
  const teamId = await getNodeId('/about/team');
  const okRes = await patch(`/api/admin/pages/${teamId}`, { titleEn: 'Team', navigationStatus: 'visible' });
  assert.equal(okRes.status, 200);
  const bad = await patch(`/api/admin/pages/${teamId}`, { navigationStatus: 'floating' });
  assert.equal(bad.status, 400);
});

test('renaming a published slug records a 301 redirect', async () => {
  const teamId = await getNodeId('/about/team');
  // Simulate a published node.
  db.prepare("INSERT INTO page_versions (id, page_id, revision, status) VALUES ('pub-v', ?, 3, 'published')").run(teamId);
  db.prepare("UPDATE page_nodes SET published_version_id = 'pub-v' WHERE id = ?").run(teamId);

  const res = await patch(`/api/admin/pages/${teamId}`, { slug: 'our-team' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.node.path, '/about/our-team');
  const redirect = db.prepare('SELECT * FROM redirects WHERE from_path = ?').get('/about/team');
  assert.ok(redirect);
  assert.equal(redirect.to_path, '/about/our-team');
  assert.equal(redirect.status_code, 301);
});

test('tree is nested and carries status flags', async () => {
  const res = await get('/api/admin/pages/tree');
  const body = await res.json();
  const about = body.data.tree.find((node) => node.slug === 'about');
  assert.ok(about);
  assert.equal(about.is_published, false);
  assert.ok(about.children.some((child) => child.slug === 'our-team'));
});

test('trash requires a children strategy, then trashes and restores subtrees', async () => {
  const aboutId = await getNodeId('/about');
  const noStrategy = await del(`/api/admin/pages/${aboutId}`);
  assert.equal(noStrategy.status, 400);
  assert.equal((await noStrategy.json()).error.fields[0].field, 'childrenStrategy');

  const trashed = await del('/api/admin/pages/' + aboutId, {});
  // Send strategy in body.
  const res = await fetch(`${base}/api/admin/pages/${aboutId}`, {
    method: 'DELETE',
    headers: { cookie: adminCookie, ...CSRF, 'Content-Type': 'application/json' },
    body: JSON.stringify({ childrenStrategy: 'trash' }),
  });
  assert.equal(res.status, 200);
  void trashed;

  const treeAfter = await (await get('/api/admin/pages/tree')).json();
  assert.equal(treeAfter.data.tree.some((node) => node.slug === 'about'), false);

  const restore = await post(`/api/admin/pages/${aboutId}/restore`);
  assert.equal(restore.status, 200);
  const treeRestored = await (await get('/api/admin/pages/tree')).json();
  const about = treeRestored.data.tree.find((node) => node.slug === 'about');
  assert.ok(about);
  assert.ok(about.children.some((child) => child.slug === 'our-team'), 'children restored in the same batch');
});

test('move strategy reparents children before trashing', async () => {
  const companyId = await getNodeId('/company');
  const childPage = await createPage({ parentId: companyId, slug: 'milestones', titleZh: '里程碑' });
  assert.equal(childPage.res.status, 201);
  const res = await fetch(`${base}/api/admin/pages/${companyId}`, {
    method: 'DELETE',
    headers: { cookie: adminCookie, ...CSRF, 'Content-Type': 'application/json' },
    body: JSON.stringify({ childrenStrategy: 'move', moveToParentId: null }),
  });
  assert.equal(res.status, 200);
  const tree = await (await get('/api/admin/pages/tree')).json();
  assert.ok(tree.data.tree.some((node) => node.slug === 'milestones'), 'child moved to root');
  assert.equal(tree.data.tree.some((node) => node.slug === 'company'), false);
});

// ---------- draft & blocks ----------

async function freshPageWithDraft(slug) {
  const created = await createPage({ slug, titleZh: slug });
  const id = created.body.data.node.id;
  const draft = await (await get(`/api/admin/pages/${id}/draft`)).json();
  return { id, draft: draft.data };
}

test('GET draft creates an empty draft on first access', async () => {
  const { draft } = await freshPageWithDraft('draft-test');
  assert.equal(draft.created, true);
  assert.equal(draft.version.revision, 1);
  assert.deepEqual(draft.blocks, []);
});

test('block mutations bump revisions and stale expectedRevision gets 409', async () => {
  const { id, draft } = await freshPageWithDraft('conflict-test');
  const add = await post(`/api/admin/pages/${id}/draft/blocks`, {
    expectedRevision: draft.version.revision,
    block: { componentType: 'content.hero', contentZh: { title: '歡迎' } },
  });
  assert.equal(add.status, 201);
  const added = await add.json();
  assert.equal(added.data.revision, 2);
  assert.equal(added.data.block.component_type, 'content.hero');

  const stale = await patch(`/api/admin/pages/${id}/draft`, {
    expectedRevision: draft.version.revision, // stale: draft is now at 2
    seo: { title: 'x' },
  });
  assert.equal(stale.status, 409);
  const staleBody = await stale.json();
  assert.equal(staleBody.error.code, 'REVISION_CONFLICT');
  assert.match(staleBody.error.fields[0].message, /當前修訂為 2/);
});

test('mutationId replays return the stored response without double-applying', async () => {
  const { id, draft } = await freshPageWithDraft('idempotent-test');
  const payload = {
    expectedRevision: draft.version.revision,
    mutationId: 'mutation-xyz-1',
    block: { componentType: 'content.cta', contentZh: { title: '加入我們', button: { label: '加入', url: '/join' } } },
  };
  const first = await (await post(`/api/admin/pages/${id}/draft/blocks`, payload)).json();
  const second = await (await post(`/api/admin/pages/${id}/draft/blocks`, payload)).json();
  assert.equal(first.data.block.id, second.data.block.id);
  assert.equal(second.data.replayed, true);
  const blocks = (await (await get(`/api/admin/pages/${id}/draft`)).json()).data.blocks;
  assert.equal(blocks.length, 1);
});

test('layout nesting rules are enforced on block insert', async () => {
  const { id, draft } = await freshPageWithDraft('nesting-test');
  let revision = draft.version.revision;
  const addBlock = async (block) => {
    const res = await post(`/api/admin/pages/${id}/draft/blocks`, { expectedRevision: revision, block });
    const body = await res.json();
    if (res.status < 300) revision = body.data.revision;
    return { res, body };
  };

  const section = await addBlock({ componentType: 'layout.section' });
  assert.equal(section.res.status, 201);
  const columns = await addBlock({ componentType: 'layout.columns', parentBlockId: section.body.data.block.id });
  assert.equal(columns.res.status, 201);
  const hero = await addBlock({ componentType: 'content.hero', contentZh: { title: '巢狀' }, parentBlockId: columns.body.data.block.id });
  assert.equal(hero.res.status, 201, 'two-level nesting is legal');

  const underHero = await addBlock({ componentType: 'content.cta', parentBlockId: hero.body.data.block.id });
  assert.equal(underHero.res.status, 400, 'content components cannot parent blocks');

  const thirdLevel = await addBlock({ componentType: 'layout.grid', parentBlockId: hero.body.data.block.id });
  assert.equal(thirdLevel.res.status, 400, 'third nesting level is rejected');
});

test('reorder requires a full permutation and updates sort_order', async () => {
  const { id, draft } = await freshPageWithDraft('reorder-test');
  let revision = draft.version.revision;
  const ids = [];
  for (const title of ['一', '二', '三']) {
    const res = await post(`/api/admin/pages/${id}/draft/blocks`, {
      expectedRevision: revision,
      block: { componentType: 'content.hero', contentZh: { title } },
    });
    const body = await res.json();
    revision = body.data.revision;
    ids.push(body.data.block.id);
  }

  const bad = await post(`/api/admin/pages/${id}/draft/blocks/reorder`, { expectedRevision: revision, order: [ids[0]] });
  assert.equal(bad.status, 400);

  const reordered = await post(`/api/admin/pages/${id}/draft/blocks/reorder`, {
    expectedRevision: revision,
    order: [ids[2], ids[0], ids[1]],
  });
  assert.equal(reordered.status, 200);
  const body = await reordered.json();
  assert.deepEqual(body.data.blocks.map((b) => b.id), [ids[2], ids[0], ids[1]]);
});

test('duplicating a block copies config and clears the anchor', async () => {
  const { id, draft } = await freshPageWithDraft('duplicate-block-test');
  const add = await post(`/api/admin/pages/${id}/draft/blocks`, {
    expectedRevision: draft.version.revision,
    block: { componentType: 'content.hero', contentZh: { title: '原件' }, anchorId: 'top' },
  });
  const added = await add.json();
  const dup = await post(`/api/admin/pages/${id}/draft/blocks/${added.data.block.id}/duplicate`, {
    expectedRevision: added.data.revision,
  });
  assert.equal(dup.status, 201);
  const dupBody = await dup.json();
  assert.notEqual(dupBody.data.block.id, added.data.block.id);
  assert.equal(dupBody.data.block.anchor_id, null);
  assert.equal(dupBody.data.block.contentZh.title, '原件');
});

test('deleting a block with children is refused until children are gone', async () => {
  const { id, draft } = await freshPageWithDraft('delete-block-test');
  let revision = draft.version.revision;
  const section = await (await post(`/api/admin/pages/${id}/draft/blocks`, {
    expectedRevision: revision,
    block: { componentType: 'layout.section' },
  })).json();
  revision = section.data.revision;
  const child = await (await post(`/api/admin/pages/${id}/draft/blocks`, {
    expectedRevision: revision,
    block: { componentType: 'content.hero', contentZh: { title: '子' }, parentBlockId: section.data.block.id },
  })).json();
  revision = child.data.revision;

  const refused = await del(`/api/admin/pages/${id}/draft/blocks/${section.data.block.id}?expectedRevision=${revision}`);
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).error.code, 'REFERENCE_EXISTS');

  const dropChild = await del(`/api/admin/pages/${id}/draft/blocks/${child.data.block.id}?expectedRevision=${revision}`);
  const childBody = await dropChild.json();
  assert.equal(dropChild.status, 200);
  const dropParent = await del(`/api/admin/pages/${id}/draft/blocks/${section.data.block.id}?expectedRevision=${childBody.data.revision}`);
  assert.equal(dropParent.status, 200);
});

test('unknown component types and invalid configs are rejected with field errors', async () => {
  const { id, draft } = await freshPageWithDraft('validation-test');
  const unknown = await post(`/api/admin/pages/${id}/draft/blocks`, {
    expectedRevision: draft.version.revision,
    block: { componentType: 'hack.custom' },
  });
  assert.equal(unknown.status, 400);

  const invalid = await post(`/api/admin/pages/${id}/draft/blocks`, {
    expectedRevision: draft.version.revision,
    block: { componentType: 'content.hero', contentZh: {} },
  });
  assert.equal(invalid.status, 400);
  const body = await invalid.json();
  assert.ok(body.error.fields.some((f) => f.field === 'contentZh.title' && f.code === 'required'));
});

test('publisher cannot write pages (403 FORBIDDEN)', async () => {
  const publisher = await login('publisher1', 'publisher-pass');
  const res = await post('/api/admin/pages', { slug: 'denied', titleZh: '拒絕' }, { cookie: publisher.cookie });
  assert.equal(res.status, 403);
  const body = await res.json();
  // requirePermission uses the legacy shape; still a stable 403.
  assert.equal(res.status, 403);
  assert.ok(body);
});

test('duplicating a page copies its draft blocks', async () => {
  const { id, draft } = await freshPageWithDraft('dup-page-test');
  await post(`/api/admin/pages/${id}/draft/blocks`, {
    expectedRevision: draft.version.revision,
    block: { componentType: 'content.hero', contentZh: { title: '被複製' } },
  });
  const res = await post(`/api/admin/pages/${id}/duplicate`);
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.match(body.data.node.slug, /^dup-page-test-copy/);
  const copyDraft = await (await get(`/api/admin/pages/${body.data.node.id}/draft`)).json();
  assert.equal(copyDraft.data.blocks.length, 1);
  assert.equal(copyDraft.data.blocks[0].contentZh.title, '被複製');
});
