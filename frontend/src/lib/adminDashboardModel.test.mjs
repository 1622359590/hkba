import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminDashboardModel, flattenDashboardPages } from './adminDashboardModel.mjs';

const emptyInput = () => ({ pages: [], news: [], banners: [], team: [], unread: 0, failed: [] });

const publishedHome = (overrides = {}) => ({
  id: 'home',
  node_type: 'page',
  path: '/',
  title_zh: '首頁',
  title_en: 'Home',
  has_draft: false,
  is_published: true,
  missing_en: false,
  updated_at: '2026-08-01T09:00:00.000Z',
  children: [],
  ...overrides,
});

test('flattens nested page nodes without mutating the tree', () => {
  const child = publishedHome({ id: 'child', path: '/about' });
  const parent = { ...publishedHome({ id: 'parent', node_type: 'section' }), children: [child] };
  const result = flattenDashboardPages([parent]);
  assert.deepEqual(result.map((page) => page.id), ['parent', 'child']);
  assert.equal(parent.children.length, 1);
});

test('uses onboarding mode before the first publication', () => {
  const model = buildAdminDashboardModel(emptyInput());
  assert.equal(model.mode, 'onboarding');
  assert.equal(model.setupTasks.length, 5);
  assert.equal(model.completedSetupCount, 0);
  assert.equal(model.nextSetupTask.id, 'pages');
});

test('derives onboarding task completion from real content', () => {
  const model = buildAdminDashboardModel({
    ...emptyInput(),
    pages: [publishedHome({ is_published: false })],
    news: [{ id: 'news-1', status: 'draft' }],
    banners: [{ id: 1, is_active: 1 }],
    team: [{ id: 1, is_active: 1 }],
  });
  assert.deepEqual(model.setupTasks.map((task) => task.complete), [true, true, true, true, false]);
  assert.equal(model.completedSetupCount, 4);
  assert.equal(model.nextSetupTask.id, 'publish');
});

test('uses operations mode after any page or news publication', () => {
  const pageModel = buildAdminDashboardModel({ ...emptyInput(), pages: [publishedHome()] });
  const newsModel = buildAdminDashboardModel({
    ...emptyInput(),
    news: [{ id: 'published-news', status: 'published', title_zh: '已發佈新聞' }],
  });
  assert.equal(pageModel.mode, 'operations');
  assert.equal(newsModel.mode, 'operations');
});

test('attaches missing English to a page draft instead of creating a separate alert', () => {
  const model = buildAdminDashboardModel({
    ...emptyInput(),
    pages: [publishedHome({ has_draft: true, missing_en: true })],
    banners: [{ is_active: 1 }],
    team: [{ is_active: 1 }],
  });
  const pageItems = model.attentionItems.filter((item) => item.kind === 'page-draft');
  assert.equal(pageItems.length, 1);
  assert.match(pageItems[0].description, /英文/);
  assert.equal(pageItems[0].href, '/admin/studio?id=home');
});

test('does not alert on missing English when the page has no draft', () => {
  const model = buildAdminDashboardModel({
    ...emptyInput(),
    pages: [publishedHome({ missing_en: true, has_draft: false })],
    banners: [{ is_active: 1 }],
    team: [{ is_active: 1 }],
  });
  assert.equal(model.attentionItems.filter((item) => item.kind === 'page-draft').length, 0);
});

test('creates exact news draft, configuration and message actions', () => {
  const model = buildAdminDashboardModel({
    ...emptyInput(),
    pages: [publishedHome()],
    news: [{
      id: 'draft-1',
      status: 'draft',
      title_zh: 'RWA 新聞',
      missing_en: true,
      updated_at: '2026-08-02T10:00:00.000Z',
    }],
    unread: 3,
  });
  const draft = model.attentionItems.find((item) => item.kind === 'news-draft');
  assert.equal(draft.href, '/admin/news?id=draft-1');
  assert.match(draft.description, /英文/);
  assert.ok(model.attentionItems.some((item) => item.id === 'config:banners'));
  assert.ok(model.attentionItems.some((item) => item.id === 'config:team'));
  assert.ok(model.attentionItems.some((item) => item.id === 'messages:unread' && item.title.includes('3')));
});

test('limits work to six and orders page changes before drafts and messages', () => {
  const pages = Array.from({ length: 5 }, (_, index) => publishedHome({
    id: `page-${index}`,
    title_zh: `頁面 ${index}`,
    has_draft: true,
    updated_at: `2026-08-0${index + 1}T09:00:00.000Z`,
  }));
  const news = Array.from({ length: 4 }, (_, index) => ({
    id: `news-${index}`,
    title_zh: `新聞 ${index}`,
    status: 'draft',
    updated_at: `2026-07-0${index + 1}T09:00:00.000Z`,
  }));
  const model = buildAdminDashboardModel({
    ...emptyInput(), pages, news, banners: [{ is_active: 1 }], team: [{ is_active: 1 }], unread: 2,
  });
  assert.equal(model.attentionItems.length, 6);
  assert.ok(model.attentionItems.slice(0, 5).every((item) => item.kind === 'page-draft'));
  assert.equal(model.attentionItems[0].id, 'page-draft:page-4');
  assert.equal(model.attentionItems[5].kind, 'news-draft');
});

test('returns a healthy state and newest published news when no work remains', () => {
  const model = buildAdminDashboardModel({
    ...emptyInput(),
    pages: [publishedHome()],
    banners: [{ is_active: 1 }],
    team: [{ is_active: 1 }],
    news: [
      { id: 'old', status: 'published', title_zh: '較早新聞', published_at: '2026-07-01T00:00:00.000Z' },
      { id: 'new', status: 'published', title_zh: '最新新聞', published_at: '2026-08-01T00:00:00.000Z' },
    ],
  });
  assert.equal(model.isHealthy, true);
  assert.deepEqual(model.recentItems.map((item) => item.id), ['new', 'old']);
});
