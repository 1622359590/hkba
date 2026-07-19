const test = require('node:test');
const assert = require('node:assert/strict');

const {
  joinPath,
  depthOf,
  subtreeHeight,
  wouldCreateCycle,
  validateMove,
  validateNewNode,
} = require('./pageTree');

test('joinPath builds canonical site paths', () => {
  assert.equal(joinPath('', 'about'), '/about');
  assert.equal(joinPath(null, 'news'), '/news');
  assert.equal(joinPath('/news', '2026'), '/news/2026');
  assert.equal(joinPath('/news/', '/2026/'), '/news/2026');
});

// Tree fixture:
//   root (depth 1)
//   └── section (depth 2)
//       └── leaf (depth 3)
const tree = [
  { id: 'root', parent_id: null },
  { id: 'section', parent_id: 'root' },
  { id: 'leaf', parent_id: 'section' },
];

test('depthOf counts ancestors with roots at depth 1', () => {
  assert.equal(depthOf(tree, 'root'), 1);
  assert.equal(depthOf(tree, 'section'), 2);
  assert.equal(depthOf(tree, 'leaf'), 3);
  assert.equal(depthOf(tree, 'missing'), 0);
});

test('subtreeHeight measures the longest downward chain', () => {
  assert.equal(subtreeHeight(tree, 'root'), 3);
  assert.equal(subtreeHeight(tree, 'section'), 2);
  assert.equal(subtreeHeight(tree, 'leaf'), 1);
});

test('wouldCreateCycle detects direct and indirect cycles', () => {
  assert.equal(wouldCreateCycle(tree, 'root', 'leaf'), true);
  assert.equal(wouldCreateCycle(tree, 'root', 'root'), true);
  assert.equal(wouldCreateCycle(tree, 'section', 'root'), false);
  assert.equal(wouldCreateCycle(tree, 'root', null), false);
});

test('validateMove rejects cycles, missing nodes and depth overflows', () => {
  assert.deepEqual(validateMove(tree, 'root', 'root'), { ok: false, reason: 'self' });
  assert.deepEqual(validateMove(tree, 'ghost', null), { ok: false, reason: 'missing_node' });
  assert.deepEqual(validateMove(tree, 'leaf', 'ghost'), { ok: false, reason: 'missing_parent' });
  assert.deepEqual(validateMove(tree, 'root', 'leaf'), { ok: false, reason: 'cycle' });
  // Moving a height-2 subtree under a depth-3 node would reach depth 5.
  const forest = [
    ...tree,
    { id: 'x', parent_id: null },
    { id: 'y', parent_id: 'x' },
  ];
  assert.deepEqual(validateMove(forest, 'x', 'leaf'), { ok: false, reason: 'depth' });
});

test('validateMove allows a legal move at the depth boundary', () => {
  // Moving leaf under a new root-level sibling stays within 3 levels.
  const wider = [...tree, { id: 'sibling', parent_id: null }];
  assert.deepEqual(validateMove(wider, 'leaf', 'sibling'), { ok: true });
  // Moving a leaf under section (depth 2) lands exactly at depth 3.
  assert.deepEqual(validateMove(tree, 'leaf', 'section'), { ok: true });
});

test('validateNewNode enforces the maximum depth of 3', () => {
  assert.deepEqual(validateNewNode(tree, null), { ok: true });
  assert.deepEqual(validateNewNode(tree, 'section'), { ok: true });
  assert.deepEqual(validateNewNode(tree, 'leaf'), { ok: false, reason: 'depth' });
  assert.deepEqual(validateNewNode(tree, 'ghost'), { ok: false, reason: 'missing_parent' });
});
