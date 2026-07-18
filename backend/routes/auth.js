const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, authMiddleware, verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/requirePermission');
const { getDb } = require('../db/init');
const {
  SESSION_COOKIE,
  parseCookieHeader,
  serializeSessionCookie,
  serializeSessionClearCookie,
} = require('../lib/cookies');
const { recordAudit, auditEvent } = require('../lib/audit');
const { permissionsOf, rolesOf } = require('../lib/rbac');

// Secure 只在生产启用（本地 http 开发不设 Secure，否则浏览器拒存）。
const SECURE_COOKIE = process.env.NODE_ENV === 'production';

// 登入：返回 JWT（过渡期 Bearer 保留）并同时种 HttpOnly 会话 Cookie。
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '請填寫用戶名和密碼' });
  }
  const db = getDb();
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    recordAudit(db, auditEvent(req, {
      actorName: String(username || ''),
      action: 'auth.login_failed',
      objectType: 'session',
      detail: { reason: 'invalid_credentials' },
    }));
    return res.status(401).json({ error: '用戶名或密碼錯誤' });
  }

  const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '7d' });
  res.append('Set-Cookie', serializeSessionCookie(token, { secure: SECURE_COOKIE }));
  recordAudit(db, auditEvent(req, {
    actorId: admin.id,
    actorName: admin.username,
    action: 'auth.login',
    objectType: 'session',
    objectId: admin.id,
  }));
  res.json({ token, username: admin.username });
});

// 登出：无论 token 是否仍有效都清 Cookie；能识别身份时写审计。
router.post('/logout', (req, res) => {
  const cookies = parseCookieHeader(req.headers.cookie);
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const decoded = verifyToken(cookies[SESSION_COOKIE]) || verifyToken(bearer);
  res.append('Set-Cookie', serializeSessionClearCookie({ secure: SECURE_COOKIE }));
  if (decoded) {
    recordAudit(getDb(), auditEvent(req, {
      actorId: decoded.id,
      actorName: decoded.username,
      action: 'auth.logout',
      objectType: 'session',
      objectId: decoded.id,
    }));
  }
  res.json({ success: true });
});

// 驗證 token：同时返回角色与权限点，供后台按能力渲染。
router.get('/verify', authMiddleware, (req, res) => {
  const db = getDb();
  res.json({
    valid: true,
    admin: req.admin,
    authMethod: req.authMethod,
    roles: rolesOf(db, req.admin.id),
    permissions: permissionsOf(db, req.admin.id),
  });
});

// 修改密碼（自助账户操作：任何已登录且具备基础读权限的管理员）
router.post('/change-password', authMiddleware, requirePermission('content.read'), (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const db = getDb();
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);

  if (!bcrypt.compareSync(oldPassword, admin.password)) {
    return res.status(400).json({ error: '舊密碼錯誤' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hash, req.admin.id);
  recordAudit(db, auditEvent(req, {
    actorId: req.admin.id,
    actorName: req.admin.username,
    action: 'auth.change_password',
    objectType: 'admin',
    objectId: req.admin.id,
  }));
  res.json({ success: true });
});

module.exports = router;
