import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./page.tsx', import.meta.url), 'utf8');

test('opens a requested news item from the dashboard id query parameter', () => {
  assert.match(source, /useSearchParams/);
  assert.match(source, /searchParams\.get\(['"]id['"]\)/);
  assert.match(source, /openEditor\(requestedNewsId\)/);
  assert.match(source, /openedIntentRef/);
});

