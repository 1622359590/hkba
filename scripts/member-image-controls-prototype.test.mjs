import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlUrl = new URL('../docs/member-image-controls-prototype.html', import.meta.url);

test('prototype exposes the approved member image controls', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  for (const id of ['avatarSize', 'imageRatio', 'cropPosition', 'gridColumns', 'resetControls']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /min="64"/);
  assert.match(html, /max="140"/);
  assert.match(html, /value="96"/);
  assert.match(html, /--avatar-size/);
  assert.match(html, /--avatar-ratio/);
  assert.match(html, /--avatar-position/);
  assert.match(html, /--grid-columns/);
  assert.match(html, /addEventListener\(['"]input['"]/);
  assert.match(html, /addEventListener\(['"]change['"]/);
  assert.match(html, /addEventListener\(['"]click['"]/);
});
