import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePublicPagePresentation } from './publicPagePresentation.ts';

const hero = { id: 'hero', component_type: 'content.hero' };
const board = { id: 'board', component_type: 'association.board' };

test('replaces the published members hero with the leadership introduction', () => {
  const result = resolvePublicPagePresentation('/members', [hero, board]);

  assert.equal(result.intro, 'leadership');
  assert.deepEqual(result.blocks, [board]);
});

test('keeps blocks unchanged for other published pages', () => {
  const result = resolvePublicPagePresentation('/about', [hero, board]);

  assert.equal(result.intro, null);
  assert.deepEqual(result.blocks, [hero, board]);
});

test('does not discard a members page when its first block is not a hero', () => {
  const result = resolvePublicPagePresentation('/members', [board]);

  assert.equal(result.intro, 'leadership');
  assert.deepEqual(result.blocks, [board]);
});
