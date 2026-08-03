import test from 'node:test';
import assert from 'node:assert/strict';
import { moveTeamGroup } from './teamGroupOrder.mjs';

test('moves an identity without mutating the original order', () => {
  const original = ['a', 'b', 'c'];
  assert.deepEqual(moveTeamGroup(original, 'b', -1), ['b', 'a', 'c']);
  assert.deepEqual(original, ['a', 'b', 'c']);
  assert.deepEqual(moveTeamGroup(original, 'b', 1), ['a', 'c', 'b']);
});

test('keeps the order stable for missing identities and boundary moves', () => {
  assert.deepEqual(moveTeamGroup(['a', 'b', 'c'], 'a', -1), ['a', 'b', 'c']);
  assert.deepEqual(moveTeamGroup(['a', 'b', 'c'], 'c', 1), ['a', 'b', 'c']);
  assert.deepEqual(moveTeamGroup(['a', 'b', 'c'], 'missing', 1), ['a', 'b', 'c']);
});
