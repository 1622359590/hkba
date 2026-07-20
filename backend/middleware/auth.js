const jwt = require('jsonwebtoken');
const { parseCookieHeader, SESSION_COOKIE } = require('../lib/cookies');

// 强制要求 JWT_SECRET：未配置直接退出，避免硬编码 fallback 泄露
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET 环境变量未设置');
  console.error('请在 backend/.env 中配置 JWT_SECRET=<至少 32 位随机字符串>');
  process.exit(1);
}

// CSRF-safe methods never change state and skip the custom-header check.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-requested-with';
const CSRF_HEADER_VALUE = 'xmlhttprequest';

function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Dual-mode authentication (transition decision D3):
//   1. Prefer the HttpOnly session cookie.
//   2. Fall back to the Authorization: Bearer header (legacy clients).
// An invalid cookie does not block a valid Bearer fallback.
// Cookie-authenticated write requests must carry the custom
// `x-requested-with: XMLHttpRequest` header (CSRF protection, see plan M2).
function authMiddleware(req, res, next) {
  const cookies = parseCookieHeader(req.headers.cookie);

  let decoded = verifyToken(cookies[SESSION_COOKIE]);
  let authMethod = 'cookie';

  if (!decoded) {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    decoded = verifyToken(bearer);
    authMethod = 'bearer';
  }

  if (!decoded) {
    return res.status(401).json({ error: '未登入' });
  }

  if (authMethod === 'cookie' && !SAFE_METHODS.has(req.method)) {
    const header = (req.headers[CSRF_HEADER] || '').toLowerCase();
    if (header !== CSRF_HEADER_VALUE) {
      return res.status(403).json({ error: 'CSRF 驗證失敗：缺少自定義請求頭' });
    }
  }

  req.admin = decoded;
  req.authMethod = authMethod;
  next();
}

module.exports = { authMiddleware, verifyToken, JWT_SECRET };
