// Lightweight schema validator for component configs (catalog §1, §8).
//
// Hand-rolled instead of zod to keep the zero-new-dependency constraint; the
// component schemas only need field types, required, enums, ranges, lengths
// and nested objects/arrays. Unknown fields are rejected (data-api §5: the
// server must not persist fields the registry does not declare).

const TYPE_CHECKS = {
  string: (value) => typeof value === 'string',
  integer: (value) => Number.isInteger(value),
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  boolean: (value) => typeof value === 'boolean',
  array: (value) => Array.isArray(value),
  object: (value) => value != null && typeof value === 'object' && !Array.isArray(value),
  enum: () => true, // checked against `values` below
};

function fail(field, code, message) {
  return { field, code, message };
}

function validateField(spec, value, path) {
  const errors = [];
  const label = spec.label || path;

  if (value === undefined || value === null) {
    if (spec.required) errors.push(fail(path, 'required', `${label} 為必填欄位`));
    return errors;
  }

  const typeOk = TYPE_CHECKS[spec.type] ? TYPE_CHECKS[spec.type](value) : false;
  if (!typeOk) {
    errors.push(fail(path, 'type', `${label} 類型錯誤（期望 ${spec.type}）`));
    return errors;
  }

  if (spec.type === 'enum' && !spec.values.includes(value)) {
    errors.push(fail(path, 'enum', `${label} 必須是 ${spec.values.join(' / ')}`));
  }

  if (typeof value === 'string') {
    if (spec.maxLength != null && value.length > spec.maxLength) {
      errors.push(fail(path, 'length', `${label} 長度不可超過 ${spec.maxLength}`));
    }
    if (spec.pattern && !spec.pattern.test(value)) {
      errors.push(fail(path, 'pattern', `${label} 格式不正確`));
    }
  }

  if (typeof value === 'number') {
    if (spec.min != null && value < spec.min) errors.push(fail(path, 'range', `${label} 不可小於 ${spec.min}`));
    if (spec.max != null && value > spec.max) errors.push(fail(path, 'range', `${label} 不可大於 ${spec.max}`));
  }

  if (Array.isArray(value)) {
    if (spec.minItems != null && value.length < spec.minItems) {
      errors.push(fail(path, 'items', `${label} 至少需要 ${spec.minItems} 項`));
    }
    if (spec.maxItems != null && value.length > spec.maxItems) {
      errors.push(fail(path, 'items', `${label} 最多允許 ${spec.maxItems} 項`));
    }
    if (spec.item) {
      value.forEach((entry, index) => {
        errors.push(...validateField(spec.item, entry, `${path}[${index}]`));
      });
    }
  }

  if (spec.type === 'object' && spec.fields) {
    errors.push(...validateFields(spec.fields, value, path));
  }

  return errors;
}

function validateFields(fields, config, prefix = '') {
  const errors = [];
  if (config == null || typeof config !== 'object' || Array.isArray(config)) {
    return [fail(prefix || '(root)', 'type', '配置必須是物件')];
  }
  for (const key of Object.keys(config)) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) {
      errors.push(fail(prefix ? `${prefix}.${key}` : key, 'unknown_field', `未註冊的欄位 ${key}`));
    }
  }
  for (const [name, spec] of Object.entries(fields)) {
    const path = prefix ? `${prefix}.${name}` : name;
    errors.push(...validateField(spec, config[name], path));
  }
  return errors;
}

// Validates a config object against a field map plus optional definition
// rules (cross-field constraints). Returns { ok, errors }.
function validateConfig(schema, config) {
  const fields = schema?.fields || {};
  const errors = validateFields(fields, config);
  if (errors.length === 0 && Array.isArray(schema?.rules)) {
    for (const rule of schema.rules) {
      const problem = rule(config);
      if (problem) errors.push(problem);
    }
  }
  return { ok: errors.length === 0, errors };
}

// Returns a new config with schema defaults applied (input is not mutated).
function applyDefaults(schema, config = {}) {
  const out = { ...config };
  for (const [name, spec] of Object.entries(schema?.fields || {})) {
    if (out[name] === undefined && spec.default !== undefined) {
      out[name] = typeof spec.default === 'object' && spec.default !== null
        ? JSON.parse(JSON.stringify(spec.default))
        : spec.default;
    }
  }
  return out;
}

module.exports = { validateConfig, validateFields, applyDefaults };
