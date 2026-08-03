const test = require('node:test');
const assert = require('node:assert/strict');

const registry = require('./index');
const { definitions } = registry;

test('registers the full component catalog (35 components)', () => {
  assert.equal(definitions.length, 35);
  const byCategory = definitions.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(byCategory, { news: 6, content: 16, association: 8, layout: 5 });
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

test('premium news variants expose editable CMS controls', () => {
  const hero = registry.getDefinition('content.hero').schema.settings.fields;
  assert.ok(hero.variant.values.includes('network-news'));

  const featured = registry.getDefinition('news.featured').schema.settings.fields;
  assert.ok(featured.variant.values.includes('flagship'));
  assert.deepEqual(featured.source.values, ['auto', 'pinned']);
  assert.equal(featured.secondaryCount.min, 2);
  assert.equal(featured.secondaryCount.max, 4);

  const list = registry.getDefinition('news.list').schema.settings.fields;
  assert.ok(list.variant.values.includes('editorial'));
  assert.equal(list.pageSize.min, 5);
  assert.equal(list.showSummary.type, 'boolean');
  assert.equal(list.showDate.type, 'boolean');

  const tabs = registry.getDefinition('news.category-tabs').schema.settings.fields;
  assert.ok(tabs.variant.values.includes('technology'));
  assert.equal(tabs.showYearFilter.type, 'boolean');
  assert.equal(tabs.showCategoryFilter.type, 'boolean');
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

test('hero secondary button is optional but requires a complete link when used', () => {
  const completeContent = {
    title: 'HKBA',
    subtitle: '',
    backgroundMediaId: '',
    primaryButton: { label: '了解更多', url: '/about' },
    secondaryButton: { label: '', url: '' },
  };
  const optional = registry.validateBlockConfig('content.hero', {
    contentZh: completeContent,
    contentEn: completeContent,
    settings: {},
  });
  assert.equal(optional.ok, true);

  const partial = registry.validateBlockConfig('content.hero', {
    contentZh: { ...completeContent, secondaryButton: { label: '聯繫我們', url: '' } },
    contentEn: completeContent,
    settings: {},
  });
  assert.equal(partial.ok, false);
  assert.ok(partial.errors.some((error) => error.field === 'contentZh.secondaryButton.url' && error.code === 'required'));
});

test('official-site content components expose editable structured fields', () => {
  const plans = registry.getDefinition('content.membership-plans');
  assert.equal(plans.schema.content.fields.plans.type, 'array');
  assert.equal(plans.schema.content.fields.plans.item.fields.benefits.type, 'array');

  const form = registry.getDefinition('content.contact-form');
  assert.equal(form.schema.content.fields.title.required, true);

  const map = registry.getDefinition('association.map');
  assert.equal(map.schema.settings.fields.height.type, 'integer');

  const imageText = registry.getDefinition('content.image-text');
  assert.equal(imageText.schema.content.fields.externalMediaUrl.type, 'string');
  const stats = registry.getDefinition('content.stats');
  assert.deepEqual(stats.schema.settings.fields.variant.values, ['metrics', 'features']);
  const mission = registry.getDefinition('content.mission');
  assert.equal(mission.schema.content.fields.items.item.fields.icon.type, 'enum');

  const timeline = registry.getDefinition('association.timeline');
  assert.equal(timeline.schema.content.fields.items.type, 'array');
  assert.equal(timeline.schema.content.fields.items.item.fields.year.required, true);
});

test('partner carousel exposes validated playback settings', () => {
  const fields = registry.getDefinition('association.partners').schema.settings.fields;
  assert.equal(fields.autoPlay.default, true);
  assert.deepEqual(fields.speed.values, ['slow', 'normal', 'fast']);
  assert.equal(fields.speed.default, 'slow');
  assert.deepEqual(fields.direction.values, ['left', 'right']);
  assert.equal(fields.direction.default, 'left');
  assert.equal(fields.pauseOnHover.default, true);

  const valid = registry.validateBlockConfig('association.partners', {
    settings: {
      group: '',
      variant: 'carousel',
      autoPlay: true,
      speed: 'slow',
      direction: 'left',
      pauseOnHover: true,
    },
  });
  assert.equal(valid.ok, true);

  const invalid = registry.validateBlockConfig('association.partners', {
    settings: { variant: 'carousel', speed: 'warp', direction: 'up' },
  });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.field === 'settings.speed' && error.code === 'enum'));
  assert.ok(invalid.errors.some((error) => error.field === 'settings.direction' && error.code === 'enum'));
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
  assert.equal(listed.length, 35);
  for (const entry of listed) {
    assert.equal(typeof entry.migrationsDeclared, 'boolean');
    assert.equal(entry.migrations, undefined);
  }
});
