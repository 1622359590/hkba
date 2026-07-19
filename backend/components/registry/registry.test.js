const test = require('node:test');
const assert = require('node:assert/strict');

const registry = require('./index');
const { definitions } = registry;

test('registers the full first-batch catalog (30 components)', () => {
  assert.equal(definitions.length, 30);
  const byCategory = definitions.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(byCategory, { news: 6, content: 13, association: 6, layout: 5 });
});

test('every definition is well-formed', () => {
  const types = new Set();
  for (const d of definitions) {
    assert.ok(d.type && !types.has(d.type), `duplicate or missing type: ${d.type}`);
    types.add(d.type);
    assert.ok(registry.VALID_CATEGORIES.has(d.category), `${d.type} bad category`);
    assert.ok(Number.isInteger(d.version) && d.version > 0, `${d.type} bad version`);
    assert.ok(d.name?.zh && d.name?.en, `${d.type} needs bilingual names`);
    assert.ok(Array.isArray(d.allowedPageTypes) && d.allowedPageTypes.length > 0, `${d.type} needs allowedPageTypes`);
    assert.ok(d.schema?.content?.fields && d.schema?.settings?.fields, `${d.type} needs schema maps`);
    assert.equal(d.category === 'layout', Boolean(d.isLayout), `${d.type} layout flag mismatch`);
    // catalog §8: initial versions declare that no migration is needed.
    assert.deepEqual(d.migrations, {}, `${d.type} v1 must declare empty migrations`);
  }
});

test('layout components are exactly the layout.* family', () => {
  const layouts = definitions.filter((d) => d.isLayout).map((d) => d.type).sort();
  assert.deepEqual(layouts, ['layout.accordion', 'layout.columns', 'layout.grid', 'layout.section', 'layout.tabs']);
  assert.ok(registry.isLayoutType('layout.section'));
  assert.equal(registry.isLayoutType('content.hero'), false);
});

test('news display components share the yearMode query contract', () => {
  for (const type of ['news.grid', 'news.list', 'news.featured', 'news.archive', 'news.category-tabs', 'news.related']) {
    const fields = registry.getDefinition(type).schema.settings.fields;
    assert.deepEqual(fields.yearMode.values, ['latest', 'specific', 'all', 'visitor-select'], type);
    assert.ok(fields.limit.min === 1 && fields.limit.max === 24, type);
  }
});

test('year is required when yearMode is specific', () => {
  const bad = registry.validateBlockConfig('news.grid', {
    settings: { yearMode: 'specific' },
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((error) => error.field === 'settings.year' && error.code === 'required'));
  const good = registry.validateBlockConfig('news.grid', {
    settings: { yearMode: 'specific', year: 2026 },
  });
  assert.equal(good.ok, true);
});

test('media blocks are shared between news and page; related is news-only', () => {
  assert.ok(registry.allowsPageType('media.image', 'news'));
  assert.ok(registry.allowsPageType('media.image', 'page'));
  assert.ok(registry.allowsPageType('news.related', 'news'));
  assert.equal(registry.allowsPageType('news.related', 'page'), false);
});

test('validateBlockConfig prefixes errors with the config scope', () => {
  const result = registry.validateBlockConfig('content.hero', { contentZh: {} });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.field === 'contentZh.title' && error.code === 'required'));
});

test('migrateConfig chains pure migration functions', () => {
  const fake = {
    type: 'test.fake',
    version: 3,
    category: 'content',
    name: { zh: 'x', en: 'x' },
    allowedPageTypes: ['page'],
    schema: { content: { fields: {} }, settings: { fields: {} } },
    migrations: {
      1: (config) => ({ ...config, renamed: config.old, old: undefined }),
      2: (config) => ({ ...config, extra: true }),
    },
  };
  registry.definitions.push(fake);
  try {
    const migrated = registry.migrateConfig('test.fake', { old: 'v' }, 1);
    assert.deepEqual(migrated, { renamed: 'v', old: undefined, extra: true });
    // A gap in the chain fails loudly instead of silently drifting.
    const gap = { ...fake, type: 'test.gap', migrations: { 1: (config) => config } };
    registry.definitions.push(gap);
    assert.throws(() => registry.migrateConfig('test.gap', {}, 1), /missing migration/);
    assert.throws(() => registry.migrateConfig('test.unknown', {}, 1), /unknown component type/);
  } finally {
    registry.definitions.pop();
    registry.definitions.pop();
  }
});

test('listDefinitions strips migration functions from metadata', () => {
  const listed = registry.listDefinitions();
  assert.equal(listed.length, 30);
  for (const entry of listed) {
    assert.equal(typeof entry.migrationsDeclared, 'boolean');
    assert.equal(entry.migrations, undefined);
  }
});
