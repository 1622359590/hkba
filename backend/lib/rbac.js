// RBAC seed data and permission queries (spec: main design §12, data-api §2.8).
//
// Three roles are seeded on top of the M1 tables. Admin accounts stay in the
// legacy `admins` table (integer IDs); user_roles bridges them to roles (D3).
// The first admin account (lowest id) is always granted super_admin so a fresh
// deployment can never lock itself out. Everything is INSERT OR IGNORE, so
// seeding is idempotent and safe to run on every initDatabase() call.

const ROLES = [
  { id: 'super_admin', name: 'super_admin', description: '超級管理員：用戶、權限、系統設置和所有內容' },
  { id: 'editor', name: 'editor', description: '內容編輯：頁面、新聞和媒體編輯，保存草稿' },
  { id: 'publisher', name: 'publisher', description: '發佈人員：檢查、預覽、發佈、撤回和回退' },
];

const PERMISSIONS = [
  { id: 'perm_content_read', code: 'content.read', description: '讀取頁面、新聞與媒體內容' },
  { id: 'perm_content_write', code: 'content.write', description: '編輯內容草稿、上傳媒體' },
  { id: 'perm_publish', code: 'publish', description: '發佈與撤回內容' },
  { id: 'perm_rollback', code: 'rollback', description: '回退到歷史版本' },
  { id: 'perm_media_delete', code: 'media.delete', description: '永久刪除媒體資產' },
  { id: 'perm_system_admin', code: 'system.admin', description: '用戶、角色與系統設置管理' },
];

const ROLE_PERMISSIONS = {
  super_admin: ['content.read', 'content.write', 'publish', 'rollback', 'media.delete', 'system.admin'],
  editor: ['content.read', 'content.write'],
  publisher: ['content.read', 'publish', 'rollback'],
};

function seedRbac(conn) {
  const insertRole = conn.prepare(
    'INSERT OR IGNORE INTO roles (id, name, description) VALUES (?, ?, ?)'
  );
  for (const role of ROLES) insertRole.run(role.id, role.name, role.description);

  const insertPermission = conn.prepare(
    'INSERT OR IGNORE INTO permissions (id, code, description) VALUES (?, ?, ?)'
  );
  for (const permission of PERMISSIONS) {
    insertPermission.run(permission.id, permission.code, permission.description);
  }

  const insertRolePermission = conn.prepare(
    `INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
     SELECT ?, id FROM permissions WHERE code = ?`
  );
  for (const [roleId, codes] of Object.entries(ROLE_PERMISSIONS)) {
    for (const code of codes) insertRolePermission.run(roleId, code);
  }

  // The first admin account always holds super_admin (bootstrap safety).
  const firstAdmin = conn.prepare('SELECT id FROM admins ORDER BY id LIMIT 1').get();
  if (firstAdmin) {
    conn.prepare(
      'INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)'
    ).run(firstAdmin.id, 'super_admin');
  }
}

function hasPermission(conn, userId, code) {
  const row = conn
    .prepare(
      `SELECT 1
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = ? AND p.code = ?
       LIMIT 1`
    )
    .get(userId, code);
  return Boolean(row);
}

function permissionsOf(conn, userId) {
  return conn
    .prepare(
      `SELECT DISTINCT p.code
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = ?
       ORDER BY p.code`
    )
    .all(userId)
    .map((row) => row.code);
}

function rolesOf(conn, userId) {
  return conn
    .prepare(
      `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ?
       ORDER BY r.name`
    )
    .all(userId)
    .map((row) => row.name);
}

module.exports = { ROLES, PERMISSIONS, ROLE_PERMISSIONS, seedRbac, hasPermission, permissionsOf, rolesOf };
