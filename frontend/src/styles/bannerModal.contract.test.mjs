import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./admin.css', import.meta.url), 'utf8');

test('centers the editor modal over a dimmed background', () => {
  assert.match(css, /\.admin-editor-modal\s*\{[^}]*place-items:\s*center/s);
  assert.match(css, /\.admin-banner-modal\s*\{[^}]*width:\s*min\(760px,\s*100%\)/s);
});

test('styles click, drag, preview, and responsive states', () => {
  assert.match(css, /\.banner-image-upload\.is-dragging/);
  assert.match(css, /\.banner-image-upload\.has-image/);
  assert.match(css, /@media \(max-width:\s*620px\)[\s\S]*\.admin-banner-modal/);
});
