import assert from 'node:assert/strict';
import test from 'node:test';

import { parseAnimatedStat } from './animatedStat.mjs';

test('parses integer statistic values and preserves the suffix', () => {
  assert.deepEqual(parseAnimatedStat('200+'), {
    target: 200,
    suffix: '+',
    decimals: 0,
  });
});

test('parses decimal statistic values and preserves compound suffixes', () => {
  assert.deepEqual(parseAnimatedStat('1.8K+'), {
    target: 1.8,
    suffix: 'K+',
    decimals: 1,
  });
});

test('falls back to a static label when a value is not numeric', () => {
  assert.deepEqual(parseAnimatedStat('HKBA'), {
    target: 0,
    suffix: 'HKBA',
    decimals: 0,
  });
});
