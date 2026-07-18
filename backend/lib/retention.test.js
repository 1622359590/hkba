const test = require('node:test');
const assert = require('node:assert/strict');

const {
  selectPublishedVersionsToPrune,
  selectDraftRevisionsToPrune,
  selectTrashToPurge,
} = require('./retention');

const NOW = Date.parse('2026-07-18T00:00:00Z');

function daysAgo(days) {
  return new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();
}

test('keeps the 20 most recent published versions and prunes the rest', () => {
  const versions = [];
  for (let i = 1; i <= 25; i += 1) {
    versions.push({ id: `v${i}`, revision: i, status: 'published', published_at: daysAgo(30 - i) });
  }
   const prune = selectPublishedVersionsToPrune(versions);
  assert.equal(prune.length, 5);
  // The five oldest versions (v1..v5) are eligible; v6..v25 stay.
  assert.deepEqual(new Set(prune), new Set(['v1', 'v2', 'v3', 'v4', 'v5']));
});

test('returns nothing when published versions fit within the limit', () => {
  const versions = [
    { id: 'v1', revision: 1, published_at: daysAgo(2) },
    { id: 'v2', revision: 2, published_at: daysAgo(1) },
  ];
  assert.deepEqual(selectPublishedVersionsToPrune(versions), []);
});

test('draft revisions keep the newest 20 regardless of age', () => {
  const revisions = [];
  for (let i = 1; i <= 25; i += 1) {
    // All older than 30 days, newest first by index.
    revisions.push({ id: `r${i}`, revision: i, created_at: daysAgo(100 - i) });
  }
  const prune = selectDraftRevisionsToPrune(revisions, NOW);
  assert.deepEqual(new Set(prune), new Set(['r1', 'r2', 'r3', 'r4', 'r5']));
});

test('draft revisions younger than 30 days survive beyond the newest 20', () => {
  const revisions = [];
  for (let i = 1; i <= 25; i += 1) {
    revisions.push({ id: `r${i}`, revision: i, created_at: daysAgo(30 - i) }); // 29..5 days old
  }
  assert.deepEqual(selectDraftRevisionsToPrune(revisions, NOW), []);
});

test('trash items older than 30 days are purged, newer ones kept', () => {
  const items = [
    { id: 'old', deleted_at: daysAgo(31) },
    { id: 'edge', deleted_at: daysAgo(29) },
    { id: 'fresh', deleted_at: daysAgo(1) },
    { id: 'notDeleted', deleted_at: null },
  ];
  assert.deepEqual(selectTrashToPurge(items, NOW), ['old']);
});
