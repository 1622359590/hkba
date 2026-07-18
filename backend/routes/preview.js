// Public preview content endpoint (spec: data-api §11).
//
// GET /api/preview/:token returns the draft content pinned by the token.
// Responses are never indexable or cacheable. The token binds a revision: if
// the draft has since advanced, the preview is stale and answered 410 so the
// editor regenerates a link instead of reviewing outdated content.

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');
const { resolvePreviewToken } = require('../lib/previewTokens');
const { loadBlocks } = require('../lib/drafts');
const { loadNewsBlocks } = require('../lib/newsDrafts');

function blockJson(block) {
  return {
    ...block,
    component_type: block.component_type || block.block_type,
    contentZh: JSON.parse(block.content_zh || '{}'),
    contentEn: JSON.parse(block.content_en || '{}'),
    settings: JSON.parse(block.settings || '{}'),
  };
}

router.get('/:token', (req, res) => {
  res.set('X-Robots-Tag', 'noindex, noarchive');
  res.set('Cache-Control', 'no-store');

  const conn = getDb();
  const token = resolvePreviewToken(conn, req.params.token);
  if (!token) {
    return res.status(404).json({ success: false, error: { code: 'PREVIEW_INVALID', message: '預覽連結無效或已過期' } });
  }

  if (token.object_type === 'page') {
    const node = conn.prepare('SELECT * FROM page_nodes WHERE id = ?').get(token.object_id);
    const version = node
      ? conn.prepare('SELECT * FROM page_versions WHERE page_id = ? AND revision = ?').get(node.id, token.revision)
      : null;
    if (!node || !version) {
      return res.status(410).json({ success: false, error: { code: 'PREVIEW_STALE', message: '草稿已更新，請重新產生預覽' } });
    }
    return res.json({
      success: true,
      data: {
        objectType: 'page',
        objectId: node.id,
        revision: token.revision,
        path: node.path,
        titleZh: node.title_zh,
        titleEn: node.title_en,
        seo: JSON.parse(version.seo || '{}'),
        blocks: loadBlocks(conn, version.id).map(blockJson),
      },
    });
  }

  const news = conn.prepare('SELECT * FROM news_items WHERE id = ?').get(token.object_id);
  if (!news) {
    return res.status(410).json({ success: false, error: { code: 'PREVIEW_STALE', message: '草稿已更新，請重新產生預覽' } });
  }
  const blocks = loadNewsBlocks(conn, news.id, token.revision);
  // News draft rows bump revision in place; a missing revision means the
  // draft moved on — unless the pinned revision is a kept published one.
  const revisionRow = conn
    .prepare('SELECT * FROM news_revisions WHERE news_id = ? AND revision = ?')
    .get(news.id, token.revision);
  if (!revisionRow || (revisionRow.status === 'draft' && news.current_draft_revision !== token.revision)) {
    return res.status(410).json({ success: false, error: { code: 'PREVIEW_STALE', message: '草稿已更新，請重新產生預覽' } });
  }
  return res.json({
    success: true,
    data: {
      objectType: 'news',
      objectId: news.id,
      revision: token.revision,
      slug: news.slug,
      titleZh: news.title_zh,
      titleEn: news.title_en,
      seo: JSON.parse(news.seo || '{}'),
      blocks: blocks.map(blockJson),
    },
  });
});

module.exports = router;
