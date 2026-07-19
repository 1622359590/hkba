const test = require('node:test');
const assert = require('node:assert/strict');

const { isValidDisplayYear, displayYearOf, latestYearOf } = require('./newsYear');

test('isValidDisplayYear accepts four-digit integers only', () => {
  assert.equal(isValidDisplayYear(2026), true);
  assert.equal(isValidDisplayYear(1000), true);
  assert.equal(isValidDisplayYear(9999), true);
  assert.equal(isValidDisplayYear(999), false);
  assert.equal(isValidDisplayYear(10000), false);
  assert.equal(isValidDisplayYear(2026.5), false);
  assert.equal(isValidDisplayYear('2026'), false);
  assert.equal(isValidDisplayYear(null), false);
});

test('displayYearOf prefers the editor display year over publishedAt', () => {
  assert.equal(displayYearOf({ display_year: 2025, published_at: '2026-01-15 10:00:00' }), 2025);
});

test('displayYearOf falls back to the publishedAt year', () => {
  assert.equal(displayYearOf({ display_year: null, published_at: '2026-01-15 10:00:00' }), 2026);
  assert.equal(displayYearOf({ published_at: '2024-12-31T23:30:00Z' }), 2024);
  assert.equal(displayYearOf({ published_at: '2023-06-01' }), 2023);
});

test('displayYearOf returns null when neither source is usable', () => {
  assert.equal(displayYearOf({ display_year: 123, published_at: null }), null);
  assert.equal(displayYearOf({ published_at: 'not a date' }), null);
  assert.equal(displayYearOf({}), null);
});

test('latestYearOf uses the maximum year present in data, never the server clock', () => {
  assert.equal(latestYearOf([2021, 2024, 2023]), 2024);
  assert.equal(latestYearOf([null, 2022, 'junk']), 2022);
  assert.equal(latestYearOf([]), null);
});
