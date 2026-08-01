import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('studio canvas renders the shared public footer in preview mode', async () => {
  const source = await readFile(new URL('../app/admin/studio/page.tsx', import.meta.url), 'utf8');

  assert.match(source, /import Footer from ['"]@\/components\/Footer['"]/);
  assert.match(source, /<Footer\s+preview\s+langOverride=\{lang\}\s*\/>/);
});

