const test = require('node:test');
const assert = require('node:assert/strict');
const { createNewsSlugCandidate, generateUniqueNewsSlug } = require('./newsSlug');

test('creates the documented backend slug format', () => {
  const slug = createNewsSlugCandidate({
    date: new Date(2026, 7, 3),
    randomUUID: () => 'ABC12345-0000-0000-0000-000000000000',
  });
  assert.equal(slug, 'news-20260803-abc123');
});

test('retries a colliding candidate and returns the first unique slug', () => {
  const ids = [
    'aaaaaa00-0000-0000-0000-000000000000',
    'bbbbbb00-0000-0000-0000-000000000000',
  ];
  const seen = [];
  const slug = generateUniqueNewsSlug({
    date: new Date(2026, 7, 3),
    randomUUID: () => ids.shift(),
    isTaken: (candidate) => {
      seen.push(candidate);
      return candidate.endsWith('aaaaaa');
    },
  });

  assert.equal(slug, 'news-20260803-bbbbbb');
  assert.deepEqual(seen, ['news-20260803-aaaaaa', 'news-20260803-bbbbbb']);
});

test('stops after the configured collision limit', () => {
  assert.throws(
    () => generateUniqueNewsSlug({
      isTaken: () => true,
      randomUUID: () => 'cccccc00-0000-0000-0000-000000000000',
      maxAttempts: 2,
    }),
    /Unable to generate a unique news slug/,
  );
});
