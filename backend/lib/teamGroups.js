const GROUP_CODE_PATTERN = /^[a-z0-9_]{2,40}$/;

class TeamGroupError extends Error {
  constructor(message, { status = 400, code = 'INVALID_TEAM_GROUP', details } = {}) {
    super(message);
    this.name = 'TeamGroupError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function fail(message, options) {
  throw new TeamGroupError(message, options);
}

function normalizeLabels(input = {}) {
  const zh = String(input.label_zh ?? '').trim();
  const en = String(input.label_en ?? '').trim();
  if (!zh && !en) fail('請至少填寫一個身份名稱。', { code: 'GROUP_LABEL_REQUIRED' });
  return { label_zh: zh || en, label_en: en || zh };
}

function getTeamGroup(db, code) {
  return db.prepare('SELECT * FROM team_member_groups WHERE code = ?').get(code);
}

function listTeamGroups(db, { activeOnly = false } = {}) {
  return db.prepare(`
    SELECT groups.*, COUNT(members.id) AS member_count
    FROM team_member_groups AS groups
    LEFT JOIN team_members AS members ON members.group_name = groups.code
    ${activeOnly ? 'WHERE groups.is_active = 1' : ''}
    GROUP BY groups.code
    ORDER BY groups.sort_order, groups.code
  `).all();
}

function createTeamGroup(db, input = {}) {
  const code = String(input.code ?? '').trim();
  if (!GROUP_CODE_PATTERN.test(code)) {
    fail('身份代碼只可包含小寫字母、數字和下劃線。', { code: 'INVALID_GROUP_CODE' });
  }
  const labels = normalizeLabels(input);
  const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 10 AS value FROM team_member_groups').get().value;
  try {
    db.prepare(`
      INSERT INTO team_member_groups (code, label_zh, label_en, sort_order, is_active, is_legacy)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(code, labels.label_zh, labels.label_en, nextOrder, input.is_active === false || input.is_active === 0 ? 0 : 1);
  } catch (error) {
    if (String(error.code).includes('SQLITE_CONSTRAINT')) {
      fail('身份代碼已存在。', { status: 409, code: 'GROUP_EXISTS' });
    }
    throw error;
  }
  return getTeamGroup(db, code);
}

function updateTeamGroup(db, code, input = {}) {
  const current = getTeamGroup(db, code);
  if (!current) fail('找不到身份。', { status: 404, code: 'GROUP_NOT_FOUND' });
  const labels = normalizeLabels({
    label_zh: input.label_zh === undefined ? current.label_zh : input.label_zh,
    label_en: input.label_en === undefined ? current.label_en : input.label_en,
  });
  const nextActive = input.is_active === undefined ? current.is_active : (input.is_active ? 1 : 0);
  if (current.is_active && !nextActive) {
    const activeCount = db.prepare('SELECT COUNT(*) AS count FROM team_member_groups WHERE is_active = 1').get().count;
    if (activeCount <= 1) fail('至少需要保留一個啟用身份。', { status: 409, code: 'LAST_ACTIVE_GROUP' });
  }
  db.prepare(`
    UPDATE team_member_groups
    SET label_zh = ?, label_en = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE code = ?
  `).run(labels.label_zh, labels.label_en, nextActive, code);
  return getTeamGroup(db, code);
}

function reorderTeamGroups(db, codes) {
  const submitted = Array.isArray(codes) ? codes.map(String) : [];
  const stored = db.prepare('SELECT code FROM team_member_groups ORDER BY code').all().map((row) => row.code);
  const unique = [...new Set(submitted)];
  if (submitted.length !== stored.length || unique.length !== stored.length || [...unique].sort().join('\0') !== stored.join('\0')) {
    fail('身份排序必須包含全部且不重複的身份。', { code: 'INVALID_GROUP_ORDER' });
  }
  const update = db.prepare('UPDATE team_member_groups SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ?');
  db.transaction(() => submitted.forEach((code, index) => update.run((index + 1) * 10, code)))();
  return listTeamGroups(db);
}

function deleteTeamGroup(db, code) {
  const current = getTeamGroup(db, code);
  if (!current) fail('找不到身份。', { status: 404, code: 'GROUP_NOT_FOUND' });
  const memberCount = db.prepare('SELECT COUNT(*) AS count FROM team_members WHERE group_name = ?').get(code).count;
  if (memberCount > 0) {
    fail(`請先轉移 ${memberCount} 位成員。`, { status: 409, code: 'GROUP_IN_USE', details: { memberCount } });
  }
  const total = db.prepare('SELECT COUNT(*) AS count FROM team_member_groups').get().count;
  if (total <= 1) fail('至少需要保留一個身份。', { status: 409, code: 'LAST_GROUP' });
  db.prepare('DELETE FROM team_member_groups WHERE code = ?').run(code);
  return current;
}

function assertAssignableTeamGroup(db, code, currentCode = null) {
  const group = getTeamGroup(db, String(code ?? ''));
  if (!group) fail('所選身份不存在。', { code: 'UNKNOWN_GROUP' });
  if (!group.is_active && group.code !== currentCode) fail('所選身份已停用。', { code: 'INACTIVE_GROUP' });
  return group;
}

module.exports = {
  GROUP_CODE_PATTERN,
  TeamGroupError,
  assertAssignableTeamGroup,
  createTeamGroup,
  deleteTeamGroup,
  getTeamGroup,
  listTeamGroups,
  reorderTeamGroups,
  updateTeamGroup,
};
