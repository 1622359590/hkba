import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./page.tsx', import.meta.url), 'utf8');

test('loads the five backend sources that drive the lifecycle dashboard', () => {
  assert.match(source, /\/api\/admin\/pages\/tree/);
  assert.match(source, /\/api\/admin\/news\?pageSize=50/);
  assert.match(source, /\/api\/banners\/all/);
  assert.match(source, /\/api\/team\/all/);
  assert.match(source, /\/api\/contact\/messages\/unread-count/);
});

test('builds and renders the lifecycle dashboard instead of the galaxy map', () => {
  assert.match(source, /buildAdminDashboardModel/);
  assert.match(source, /LifecycleDashboard/);
  assert.doesNotMatch(source, /GalaxyMap|GalaxyNode|GalaxyBadge/);
});

test('refreshes when content or messages change elsewhere in the admin', () => {
  assert.match(source, /hkba:content-updated/);
  assert.match(source, /hkba:messages-updated/);
});

