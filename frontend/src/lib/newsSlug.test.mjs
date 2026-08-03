import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewsSlug } from './newsSlug.mjs';

test('creates a dated lowercase news slug from a UUID', () => {
  const slug = createNewsSlug({
    date: new Date(2026, 7, 3),
    randomUUID: () => 'A1B2C3D4-0000-0000-0000-000000000000',
  });

  assert.equal(slug, 'news-20260803-a1b2c3');
  assert.match(slug, /^news-[0-9]{8}-[a-z0-9]{6}$/);
});

test('creates a fresh slug for each UUID', () => {
  const ids = [
    '111111aa-0000-0000-0000-000000000000',
    '222222bb-0000-0000-0000-000000000000',
  ];
  const randomUUID = () => ids.shift();

  assert.notEqual(
    createNewsSlug({ date: new Date(2026, 7, 3), randomUUID }),
    createNewsSlug({ date: new Date(2026, 7, 3), randomUUID }),
  );
});
