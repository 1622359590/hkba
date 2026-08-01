import assert from 'node:assert/strict';
import test from 'node:test';

import { newsCardClassName, shouldShowMediaPlaceholder } from './publicMediaPresentation.mjs';

test('public content hides the media placeholder when no asset is available', () => {
  assert.equal(shouldShowMediaPlaceholder({ hasAsset: false, editable: false }), false);
});

test('studio content keeps the media placeholder when no asset is available', () => {
  assert.equal(shouldShowMediaPlaceholder({ hasAsset: false, editable: true }), true);
});

test('available media never needs a placeholder', () => {
  assert.equal(shouldShowMediaPlaceholder({ hasAsset: true, editable: true }), false);
  assert.equal(shouldShowMediaPlaceholder({ hasAsset: true, editable: false }), false);
});

test('news cards expose their own editorial layout variants', () => {
  assert.equal(newsCardClassName('news.grid', false), 'hk-news-card hk-news-card--grid is-text-only');
  assert.equal(newsCardClassName('news.featured', true), 'hk-news-card hk-news-card--featured has-cover');
});
