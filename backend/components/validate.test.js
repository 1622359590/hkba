const test = require('node:test');
const assert = require('node:assert/strict');

const { validateConfig, applyDefaults } = require('./validate');

const schema = {
  fields: {
    title: { type: 'string', required: true, maxLength: 10, label: '標題' },
    count: { type: 'integer', min: 1, max: 24 },
    ratio: { type: 'enum', values: ['16:9', '4:3'] },
    enabled: { type: 'boolean' },
    tags: { type: 'array', minItems: 1, maxItems: 3, item: { type: 'string' } },
    button: { type: 'object', fields: { label: { type: 'string', required: true } } },
  },
};

test('accepts a valid config', () => {
  const { ok, errors } = validateConfig(schema, {
    title: '你好',
    count: 6,
    ratio: '16:9',
    enabled: true,
    tags: ['a'],
    button: { label: 'Go' },
  });
  assert.deepEqual(errors, []);
  assert.equal(ok, true);
});

test('rejects unknown fields (data-api §5)', () => {
  const { ok, errors } = validateConfig(schema, { title: 'x', hack: true });
  assert.equal(ok, false);
  assert.equal(errors[0].code, 'unknown_field');
  assert.equal(errors[0].field, 'hack');
});

test('enforces required, types, enums, ranges and lengths', () => {
  const { errors } = validateConfig(schema, {
    count: 99,
    ratio: '21:9',
    enabled: 'yes',
    tags: [],
    button: {},
  });
  const byField = new Map(errors.map((error) => [error.field, error.code]));
  assert.equal(byField.get('title'), 'required');
  assert.equal(byField.get('count'), 'range');
  assert.equal(byField.get('ratio'), 'enum');
  assert.equal(byField.get('enabled'), 'type');
  assert.equal(byField.get('tags'), 'items');
  assert.equal(byField.get('button.label'), 'required');
});

test('enforces maxLength and array item types', () => {
  const { errors } = validateConfig(schema, { title: 'x'.repeat(11), tags: ['ok', 5] });
  const codes = errors.map((error) => `${error.field}:${error.code}`);
  assert.ok(codes.includes('title:length'));
  assert.ok(codes.includes('tags[1]:type'));
});

test('definition rules add cross-field constraints', () => {
  const ruled = {
    fields: { mode: { type: 'enum', values: ['latest', 'specific'], required: true }, year: { type: 'integer' } },
    rules: [
      (config) =>
        config.mode === 'specific' && !Number.isInteger(config.year)
          ? { field: 'year', code: 'required', message: '需要年份' }
          : null,
    ],
  };
  assert.equal(validateConfig(ruled, { mode: 'specific' }).ok, false);
  assert.equal(validateConfig(ruled, { mode: 'specific', year: 2026 }).ok, true);
  assert.equal(validateConfig(ruled, { mode: 'latest' }).ok, true);
});

test('applyDefaults fills defaults without mutating the input', () => {
  const withDefaults = { fields: { limit: { type: 'integer', default: 6 }, tags: { type: 'array', default: [] } } };
  const input = { tags: ['x'] };
  const out = applyDefaults(withDefaults, input);
  assert.deepEqual(out, { limit: 6, tags: ['x'] });
  assert.deepEqual(input, { tags: ['x'] });
  out.tags.push('y');
  assert.deepEqual(applyDefaults(withDefaults, {}).tags, []);
});
