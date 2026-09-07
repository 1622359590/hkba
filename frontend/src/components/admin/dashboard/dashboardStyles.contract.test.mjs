import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../../../styles/admin.css', import.meta.url), 'utf8');

test('styles the dashboard as a scoped operations workspace', () => {
  assert.match(source, /\.admin-dashboard\s*\{/);
  assert.match(source, /\.admin-dashboard-attention(?:\s*\{|\s*,)/);
  assert.match(source, /\.admin-dashboard-quick(?:\s*\{|\s*,)/);
  assert.match(source, /\.admin-dashboard-skeleton\s*\{/);
  assert.match(source, /minmax\(0,\s*1\.45fr\)\s+minmax\(240px,\s*\.55fr\)/);
});

test('includes responsive, keyboard and reduced-motion behavior', () => {
  assert.match(source, /@media\s*\(max-width:\s*1100px\)/);
  assert.match(source, /:focus-visible/);
  assert.match(source, /prefers-reduced-motion/);
});
