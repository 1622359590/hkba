const test = require('node:test');
const assert = require('node:assert/strict');

const { validateBlockTree, validateNewsBlocks } = require('./blockTree');

test('accepts a flat block list', () => {
  const blocks = [
    { id: 'a', component_type: 'content.hero', parent_block_id: null },
    { id: 'b', component_type: 'news.grid', parent_block_id: null },
  ];
  assert.deepEqual(validateBlockTree(blocks), { ok: true, errors: [] });
});

test('accepts two-level layout nesting and rejects a third level', () => {
  const legal = [
    { id: 'section', component_type: 'layout.section', parent_block_id: null },
    { id: 'columns', component_type: 'layout.columns', parent_block_id: 'section' },
    { id: 'hero', component_type: 'content.hero', parent_block_id: 'columns' },
  ];
  assert.deepEqual(validateBlockTree(legal), { ok: true, errors: [] });

  const illegal = [
    ...legal,
    { id: 'grid', component_type: 'layout.grid', parent_block_id: 'hero' },
  ];
  const result = validateBlockTree(illegal);
  assert.equal(result.ok, false);
  const codes = result.errors.map((error) => error.code);
  assert.ok(codes.includes('non_layout_parent'));
  assert.ok(codes.includes('nesting'));
});

test('rejects non-layout parents and missing parents', () => {
  const blocks = [
    { id: 'a', component_type: 'content.hero', parent_block_id: null },
    { id: 'b', component_type: 'content.cta', parent_block_id: 'a' },
    { id: 'c', component_type: 'content.faq', parent_block_id: 'ghost' },
  ];
  const result = validateBlockTree(blocks);
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => [error.blockId, error.code]),
    [
      ['b', 'non_layout_parent'],
      ['c', 'missing_parent'],
    ]
  );
});

test('detects self-nesting and reference cycles', () => {
  const self = [{ id: 'a', component_type: 'layout.section', parent_block_id: 'a' }];
  assert.equal(validateBlockTree(self).errors[0].code, 'cycle');

  const cycle = [
    { id: 'a', component_type: 'layout.section', parent_block_id: 'b' },
    { id: 'b', component_type: 'layout.section', parent_block_id: 'a' },
  ];
  const codes = validateBlockTree(cycle).errors.map((error) => error.code);
  assert.ok(codes.includes('cycle'));
});

test('news bodies require exactly one header placed first', () => {
  assert.equal(validateNewsBlocks([{ id: 'r', block_type: 'content.rich-text', sort_order: 0 }]).errors[0].code, 'missing_header');

  const duplicate = validateNewsBlocks([
    { id: 'h1', block_type: 'news.header', sort_order: 0 },
    { id: 'h2', block_type: 'news.header', sort_order: 1 },
  ]);
  assert.equal(duplicate.errors[0].code, 'duplicate_header');

  const misplaced = validateNewsBlocks([
    { id: 'r', block_type: 'content.rich-text', sort_order: 0 },
    { id: 'h', block_type: 'news.header', sort_order: 1 },
  ]);
  assert.equal(misplaced.errors[0].code, 'header_position');

  const legal = validateNewsBlocks([
    { id: 'h', block_type: 'news.header', sort_order: 0 },
    { id: 'r', block_type: 'content.rich-text', sort_order: 1 },
    { id: 'i', block_type: 'media.image', sort_order: 2 },
  ]);
  assert.deepEqual(legal, { ok: true, errors: [] });
});
