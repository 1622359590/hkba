// Component registry (catalog §1, §8; data-api §2.7).
//
// The code registry is the source of truth for component contracts: type,
// version, category, schema, allowedPageTypes and config migrations. Renderers
// live in the frontend; the backend registers contracts and validates block
// configs against them. Databases never invent component types.

const definitions = require('./definitions');
const { validateConfig } = require('../validate');

// Lookups scan the definitions array (tiny, ~30 entries) so tests and future
// tooling can register additional definitions at runtime.
const VALID_CATEGORIES = new Set(['news', 'content', 'association', 'layout']);

function getDefinition(type) {
  return definitions.find((definition) => definition.type === type) || null;
}

function isLayoutType(type) {
  const definition = getDefinition(type);
  return Boolean(definition && definition.isLayout);
}

function allowsPageType(type, pageType) {
  const definition = getDefinition(type);
  return Boolean(definition && definition.allowedPageTypes.includes(pageType));
}

// Metadata exposed to the admin UI (migrations stay server-side functions).
function listDefinitions() {
  return definitions.map((definition) => ({
    type: definition.type,
    version: definition.version,
    category: definition.category,
    name: definition.name,
    description: definition.description,
    allowedPageTypes: definition.allowedPageTypes,
    isLayout: Boolean(definition.isLayout),
    isNewsBlock: Boolean(definition.isNewsBlock),
    schema: definition.schema,
    migrationsDeclared: Object.keys(definition.migrations || {}).length > 0,
  }));
}

// Validates one block's bilingual content and settings against the registry.
// Returns { ok, errors } with field-prefixed errors (contentZh.title etc).
// With allowMissingEn (draft stage), required-field errors on contentEn are
// dropped: Chinese-first drafts are allowed (main design §10); translation
// completeness is a publish check, not a draft blocker.
function validateBlockConfig(type, { contentZh = {}, contentEn = {}, settings = {} }, options = {}) {
  const definition = getDefinition(type);
  if (!definition) {
    return { ok: false, errors: [{ field: 'componentType', code: 'unknown_field', message: `未註冊的組件類型 ${type}` }] };
  }
  const prefix = (errors, scope) => errors.map((error) => ({ ...error, field: `${scope}.${error.field}` }));
  let enErrors = validateConfig(definition.schema.content, contentEn).errors;
  if (options.allowMissingEn) {
    enErrors = enErrors.filter((error) => error.code !== 'required');
  }
  const errors = [
    ...prefix(validateConfig(definition.schema.content, contentZh).errors, 'contentZh'),
    ...prefix(enErrors, 'contentEn'),
    ...prefix(validateConfig(definition.schema.settings, settings).errors, 'settings'),
  ];
  return { ok: errors.length === 0, errors };
}

// Applies the config migration chain from `fromVersion` up to the definition's
// current version. Migrations are pure functions keyed by the version they
// upgrade FROM: migrations = { 1: (config) => configAtV2 }.
function migrateConfig(type, config, fromVersion) {
  const definition = getDefinition(type);
  if (!definition) {
    throw new Error(`unknown component type: ${type}`);
  }
  let current = config;
  for (let version = fromVersion; version < definition.version; version += 1) {
    const step = definition.migrations?.[version];
    if (typeof step !== 'function') {
      throw new Error(`missing migration for ${type} from version ${version}`);
    }
    current = step(current);
  }
  return current;
}

module.exports = {
  definitions,
  getDefinition,
  isLayoutType,
  allowsPageType,
  listDefinitions,
  validateBlockConfig,
  migrateConfig,
  VALID_CATEGORIES,
};
