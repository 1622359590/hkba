const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getDb } = require('../db/init');
const {
  TeamGroupError,
  assertAssignableTeamGroup,
  createTeamGroup,
  deleteTeamGroup,
  listTeamGroups,
  reorderTeamGroups,
  updateTeamGroup,
} = require('../lib/teamGroups');

function teamGroupError(res, error) {
  if (!(error instanceof TeamGroupError)) throw error;
  return res.status(error.status).json({ error: error.message, code: error.code, details: error.details });
}

// 公开：按分组获取
router.get('/', (req, res) => {
  const db = getDb();
  const group = req.query.group;
  let items;
  if (group) {
    items = db.prepare('SELECT * FROM team_members WHERE is_active = 1 AND group_name = ? ORDER BY sort_order ASC').all(group);
  } else {
    items = db.prepare('SELECT * FROM team_members WHERE is_active = 1 ORDER BY group_name, sort_order ASC').all();
  }
  res.json(items);
});

// 公开：获取所有分组
router.get('/groups', (req, res) => {
  const db = getDb();
  res.json(listTeamGroups(db, { activeOnly: true }).map((group) => group.code));
});

// 管理：身份結構
router.get('/groups/all', authMiddleware, (req, res) => {
  res.json(listTeamGroups(getDb()));
});

router.post('/groups', authMiddleware, (req, res) => {
  try {
    res.status(201).json(createTeamGroup(getDb(), req.body));
  } catch (error) {
    return teamGroupError(res, error);
  }
});

router.put('/groups/order', authMiddleware, (req, res) => {
  try {
    res.json(reorderTeamGroups(getDb(), req.body?.codes));
  } catch (error) {
    return teamGroupError(res, error);
  }
});

router.put('/groups/:code', authMiddleware, (req, res) => {
  try {
    res.json(updateTeamGroup(getDb(), req.params.code, req.body));
  } catch (error) {
    return teamGroupError(res, error);
  }
});

router.delete('/groups/:code', authMiddleware, (req, res) => {
  try {
    res.json(deleteTeamGroup(getDb(), req.params.code));
  } catch (error) {
    return teamGroupError(res, error);
  }
});

// 管理：获取全部
router.get('/all', authMiddleware, (req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT * FROM team_members ORDER BY group_name, sort_order ASC').all();
  res.json(items);
});

router.post('/', authMiddleware, (req, res) => {
  const { name_zh, name_en, title_zh, title_en, bio_zh, bio_en, avatar_url, group_name, social_facebook, social_twitter, social_linkedin, social_instagram, sort_order, is_active } = req.body;
  const db = getDb();
  try {
    const nextGroup = group_name || 'committee';
    assertAssignableTeamGroup(db, nextGroup);
    const result = db.prepare(
      `INSERT INTO team_members (name_zh, name_en, title_zh, title_en, bio_zh, bio_en, avatar_url, group_name, social_facebook, social_twitter, social_linkedin, social_instagram, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(name_zh||'', name_en||'', title_zh||'', title_en||'', bio_zh||'', bio_en||'', avatar_url, nextGroup, social_facebook||'', social_twitter||'', social_linkedin||'', social_instagram||'', sort_order||0, is_active!==undefined?is_active:1);
    res.json({ id: result.lastInsertRowid, success: true });
  } catch (error) {
    return teamGroupError(res, error);
  }
});

router.put('/:id', authMiddleware, (req, res) => {
  const { name_zh, name_en, title_zh, title_en, bio_zh, bio_en, avatar_url, group_name, social_facebook, social_twitter, social_linkedin, social_instagram, sort_order, is_active } = req.body;
  const db = getDb();
  const current = db.prepare('SELECT group_name FROM team_members WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: '找不到成員' });
  try {
    const nextGroup = group_name || 'committee';
    assertAssignableTeamGroup(db, nextGroup, current.group_name);
    db.prepare(
      `UPDATE team_members SET name_zh=?, name_en=?, title_zh=?, title_en=?, bio_zh=?, bio_en=?, avatar_url=?, group_name=?, social_facebook=?, social_twitter=?, social_linkedin=?, social_instagram=?, sort_order=?, is_active=? WHERE id=?`
    ).run(name_zh||'', name_en||'', title_zh||'', title_en||'', bio_zh||'', bio_en||'', avatar_url, nextGroup, social_facebook||'', social_twitter||'', social_linkedin||'', social_instagram||'', sort_order||0, is_active!==undefined?is_active:1, req.params.id);
    res.json({ success: true });
  } catch (error) {
    return teamGroupError(res, error);
  }
});

router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM team_members WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
