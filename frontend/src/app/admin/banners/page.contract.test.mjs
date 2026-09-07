import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

test('renders a centered modal dialog instead of an inline AdminCard', () => {
  assert.match(source, /className="admin-editor-modal"/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.doesNotMatch(source, /<AdminCard/);
});

test('uses the Banner upload field and has no image URL editor', () => {
  assert.match(source, /<BannerImageUpload/);
  assert.doesNotMatch(source, /<ImageField/);
  assert.doesNotMatch(source, /圖片 URL|image_url[^\n]*<Input/);
});

test('blocks modal dismissal while uploading or saving', () => {
  assert.match(source, /saving\s*\|\|\s*uploading/);
  assert.match(source, /Escape/);
});
