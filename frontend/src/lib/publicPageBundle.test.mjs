import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPublicPageBundle } from './publicPageBundle.mjs';

test('published page is not exposed until its dependent data has loaded', async () => {
  let resolveAssociation;
  const associationPromise = new Promise((resolve) => { resolveAssociation = resolve; });
  let settled = false;

  const pending = loadPublicPageBundle('/about', {
    fetchPage: async () => ({ path: '/about', blocks: [] }),
    fetchNews: async () => ({ items: [] }),
    fetchAssociation: () => associationPromise,
  }).then((bundle) => {
    settled = true;
    return bundle;
  });

  await Promise.resolve();
  assert.equal(settled, false);

  resolveAssociation({ people: [], milestones: [] });
  assert.deepEqual(await pending, {
    page: { path: '/about', blocks: [] },
    news: { items: [] },
    association: { people: [], milestones: [] },
  });
});

test('missing published page skips dependent requests', async () => {
  let dependentCalls = 0;
  const bundle = await loadPublicPageBundle('/missing', {
    fetchPage: async () => null,
    fetchNews: async () => { dependentCalls += 1; return null; },
    fetchAssociation: async () => { dependentCalls += 1; return null; },
  });

  assert.equal(bundle, null);
  assert.equal(dependentCalls, 0);
});
