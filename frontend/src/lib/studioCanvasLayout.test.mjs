import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('studio canvas wrapper does not stretch the canvas to the viewport height', async () => {
  const css = await readFile(new URL('../styles/studio.css', import.meta.url), 'utf8');
  const rule = css.match(/\.hk-canvas-wrap\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(rule, /align-items\s*:\s*flex-start\s*;/);
});
