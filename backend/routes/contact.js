const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getDb } = require('../db/init');
// 公开：获取联系信息
router.get('/info', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM contact_info').all();
  const info = {};
  for (const row of rows) info[row.key] = row.value;
  res.json(info);
});

// 管理：更新联系信息
router.put('/info', authMiddleware, (req, res) => {
  const db = getDb();
  const stmt = db.prepare('INSERT OR REPLACE INTO contact_info (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  for (const [key, value] of Object.entries(req.body)) {
    stmt.run(key, value);
  }
  res.json({ success: true });
});

// 公开：提交联系表单
router.post('/message', (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!name || !email || !message) {
    return res.status(400).json({ error: '請填寫必要信息' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: '請填寫有效的電郵地址' });
  }
  const db = getDb();
  db.prepare('INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)').run(name, email, subject, message);
  res.json({ success: true });
});

// 管理：获取所有消息
router.get('/messages', authMiddleware, (req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all();
  res.json(items);
});

// 管理：获取未读消息数量
router.get('/messages/unread-count', authMiddleware, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM contact_messages WHERE is_read = 0').get();
  res.json({ count: row?.count || 0 });
});

// 管理：标记已读
router.put('/messages/:id/read', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE contact_messages SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 管理：删除消息
router.delete('/messages/:id', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM contact_messages WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
