import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/blocks.css', import.meta.url), 'utf8');

test('partner carousel uses one shared white strip instead of grey item cards', () => {
  const stripRule = css.match(/\.hk-partner-carousel\s*\{([^}]*)\}/s)?.[1] || '';
  assert.match(stripRule, /background:\s*#f7f8fa;/);
  assert.match(stripRule, /border-radius:\s*12px;/);
  assert.match(css, /\.hk-partner-carousel \.hk-partner__tile\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/s);
  assert.match(css, /\.hk-partner-carousel::before[\s\S]*#f7f8fa/);
});
