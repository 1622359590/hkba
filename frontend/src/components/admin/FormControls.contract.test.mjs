import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./FormControls.tsx', import.meta.url), 'utf8');

test('bilingual fields expose the responsive grid class', () => {
  assert.match(source, /className="bilingual-field-grid"/);
});
