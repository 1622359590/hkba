import test from 'node:test';
import assert from 'node:assert/strict';

import { selectStudioBlock } from './studioSelection.mjs';

test('selectStudioBlock selects the block and opens the properties pane', () => {
  const calls = [];

  selectStudioBlock(
    'block-1',
    (blockId) => calls.push(`selected:${blockId}`),
    (pane) => calls.push(`pane:${pane}`)
  );

  assert.deepEqual(calls, ['selected:block-1', 'pane:props']);
});
