import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./BannerImageUpload.tsx', import.meta.url), 'utf8');

test('supports click and drag-drop through one upload function', () => {
  assert.match(source, /type="file"/);
  assert.match(source, /onDrop=/);
  assert.match(source, /uploadFiles/);
});

test('uploads to the media library and never renders a URL input', () => {
  assert.match(source, /\/api\/admin\/media\/uploads/);
  assert.doesNotMatch(source, /placeholder=["'][^"']*URL/i);
  assert.doesNotMatch(source, /type=["']url["']/i);
});

test('offers preview replacement and removal states', () => {
  assert.match(source, /Banner 圖片預覽/);
  assert.match(source, /更換圖片/);
  assert.match(source, /移除圖片/);
});
