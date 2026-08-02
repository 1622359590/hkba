import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./LifecycleDashboard.tsx', import.meta.url), 'utf8');

test('renders onboarding, operations and healthy lifecycle states', () => {
  assert.match(source, /開始設置 HKBA 網站/);
  assert.match(source, /待完成/);
  assert.match(source, /網站運行正常/);
  assert.match(source, /快速開始/);
  assert.match(source, /最近發佈/);
});

test('uses real links for setup tasks and attention items', () => {
  assert.match(source, /href=\{item\.href\}/);
  assert.match(source, /href=\{nextTask\.href\}/);
  assert.match(source, /href="\/admin\/news"/);
  assert.match(source, /href:\s*['"]\/admin\/events['"]/);
  assert.match(source, /href:\s*['"]\/admin\/banners['"]/);
  assert.match(source, /href:\s*['"]\/admin\/media['"]/);
});

test('contains local loading and failure states without galaxy concepts', () => {
  assert.match(source, /admin-dashboard-skeleton/);
  assert.match(source, /部分資料暫時無法同步/);
  assert.match(source, /無法載入營運資料/);
  assert.doesNotMatch(source, /GalaxyMap|星系/);
});
