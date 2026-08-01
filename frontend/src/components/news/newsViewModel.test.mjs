import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeLegacyNews, normalizePublicNews, selectNewsLayout } from './newsViewModel.mjs';

const publicFixture = {
  id: 'n1',
  slug: 'policy-update',
  titleZh: '政策更新',
  titleEn: '',
  summaryZh: '摘要',
  summaryEn: '',
  year: 2026,
  publishedAt: '2026-08-02T08:00:00Z',
  cover: { url: '/media/a.jpg', altZh: '', altEn: '' },
  categories: [{ id: 'c1', slug: 'policy', nameZh: '政策', nameEn: 'Policy' }],
  tags: [],
};

test('normalizePublicNews uses localized fallbacks and title image alt', () => {
  const [item] = normalizePublicNews([publicFixture], 'en', (url) => `/api${url}`);
  assert.equal(item.href, '/news/policy-update');
  assert.equal(item.title, '政策更新');
  assert.equal(item.category, 'Policy');
  assert.deepEqual(item.image, { src: '/api/media/a.jpg', alt: '政策更新' });
});

test('normalizeLegacyNews uses the title as image alt text', () => {
  const [item] = normalizeLegacyNews([{
    id: 7,
    title_zh: '協會消息',
    title_en: 'Association update',
    summary_zh: '摘要',
    summary_en: 'Summary',
    cover_image: '/legacy.jpg',
    category: 'HKBA',
    published_at: '2023-08-28T00:00:00Z',
  }], 'zh', (url) => `/api${url}`);
  assert.equal(item.href, '/news/7');
  assert.deepEqual(item.image, { src: '/api/legacy.jpg', alt: '協會消息' });
});

test('selectNewsLayout keeps pinned order and removes focus items from the feed', () => {
  const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  const pinned = [{ id: 'c' }, { id: 'a' }];
  const result = selectNewsLayout(items, pinned, 2);
  assert.equal(result.featured.id, 'c');
  assert.deepEqual(result.secondary.map((item) => item.id), ['a', 'b']);
  assert.deepEqual(result.feed.map((item) => item.id), ['d']);
});
