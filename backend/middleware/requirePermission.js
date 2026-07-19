const { getDb } = require('../db/init');
const { hasPermission } = require('../lib/rbac');

// Permission gate (spec: main design §12). Mount AFTER authMiddleware.
// A lookup failure fails closed (403) and is logged, never silently allowed.
function requirePermission(code) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: '未登入' });
    }
    let allowed = false;
    try {
      allowed = hasPermission(getDb(), req.admin.id, code);
    } catch (error) {
      console.error(`permission check failed for ${code}:`, error.message);
    }
    if (!allowed) {
      return res.status(403).json({ error: '權限不足' });
    }
    next();
  };
}

module.exports = { requirePermission };
