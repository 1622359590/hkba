const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const {
  TeamGroupError,
  assertAssignableTeamGroup,
  createTeamGroup,
  deleteTeamGroup,
  listTeamGroups,
  reorderTeamGroups,
  updateTeamGroup,
} = require('./teamGroups');

function makeDb(t) {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_name TEXT NOT NULL,
      name_zh TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE team_member_groups (
      code TEXT PRIMARY KEY,
      label_zh TEXT NOT NULL,
      label_en TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_legacy INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO team_member_groups (code, label_zh, label_en, sort_order) VALUES
      ('chairman', '會長', 'Chairman', 10),
      ('advisor', '顧問', 'Advisor', 20);
  `);
  return db;
}

function assertGroupError(fn, status, code) {
  assert.throws(fn, (error) => error instanceof TeamGroupError && error.status === status && error.code === code);
}

test('creates identities with validated immutable codes and bilingual fallback', (t) => {
  const db = makeDb(t);

  const created = createTeamGroup(db, { code: 'industry_expert', label_zh: ' 行業專家 ', label_en: '' });

  assert.equal(created.code, 'industry_expert');
  assert.equal(created.label_zh, '行業專家');
  assert.equal(created.label_en, '行業專家');
  assertGroupError(() => createTeamGroup(db, { code: 'Bad Code', label_zh: '錯誤' }), 400, 'INVALID_GROUP_CODE');
  assertGroupError(() => createTeamGroup(db, { code: 'chairman', label_zh: '重複' }), 409, 'GROUP_EXISTS');
});

test('lists identities in configured order with member counts', (t) => {
  const db = makeDb(t);
  db.prepare("INSERT INTO team_members (group_name, name_zh) VALUES ('chairman', '甲'), ('chairman', '乙')").run();

  const rows = listTeamGroups(db);

  assert.deepEqual(rows.map((row) => [row.code, row.member_count]), [['chairman', 2], ['advisor', 0]]);
});

test('requires a complete unique permutation when reordering identities', (t) => {
  const db = makeDb(t);

  reorderTeamGroups(db, ['advisor', 'chairman']);

  assert.deepEqual(listTeamGroups(db).map((row) => row.code), ['advisor', 'chairman']);
  assertGroupError(() => reorderTeamGroups(db, ['advisor']), 400, 'INVALID_GROUP_ORDER');
  assertGroupError(() => reorderTeamGroups(db, ['advisor', 'advisor']), 400, 'INVALID_GROUP_ORDER');
});

test('prevents disabling the final active identity', (t) => {
  const db = makeDb(t);
  updateTeamGroup(db, 'advisor', { is_active: false });

  assertGroupError(() => updateTeamGroup(db, 'chairman', { is_active: false }), 409, 'LAST_ACTIVE_GROUP');
});

test('blocks deletion while members reference an identity', (t) => {
  const db = makeDb(t);
  db.prepare("INSERT INTO team_members (group_name, name_zh) VALUES ('chairman', '甲')").run();

  assertGroupError(() => deleteTeamGroup(db, 'chairman'), 409, 'GROUP_IN_USE');
  assert.equal(deleteTeamGroup(db, 'advisor').code, 'advisor');
});

test('new assignments require an active identity but existing inactive assignments may remain', (t) => {
  const db = makeDb(t);
  updateTeamGroup(db, 'advisor', { is_active: false });

  assertGroupError(() => assertAssignableTeamGroup(db, 'missing'), 400, 'UNKNOWN_GROUP');
  assertGroupError(() => assertAssignableTeamGroup(db, 'advisor'), 400, 'INACTIVE_GROUP');
  assert.equal(assertAssignableTeamGroup(db, 'advisor', 'advisor').code, 'advisor');
  assert.equal(assertAssignableTeamGroup(db, 'chairman', 'advisor').code, 'chairman');
});
