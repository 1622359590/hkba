import test from 'node:test';
import assert from 'node:assert/strict';

import { selectStudioPage } from './studioPageNavigation.mjs';

test('selectStudioPage updates local state and stores the page in the URL hash', () => {
  const selected = [];
  const location = { hash: '' };

  selectStudioPage(
    'page-2',
    (pageId) => selected.push(pageId),
    location
  );

  assert.deepEqual(selected, ['page-2']);
  assert.equal(location.hash, 'page=page-2');
});

test('selectStudioPage encodes page ids before updating the hash', () => {
  const location = { hash: '' };

  selectStudioPage('page / fast', () => {}, location);

  assert.equal(location.hash, 'page=page%20%2F%20fast');
});
