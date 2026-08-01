const crypto = require('crypto');

const SYSTEM_PAGES = [
  {
    path: '/', slug: 'home', titleZh: '首頁', titleEn: 'Home',
    blocks: [
      ['content.hero', { title: '香港區塊鏈協會', subtitle: '推動香港區塊鏈生態發展' }, { title: 'Hong Kong Blockchain Association', subtitle: 'Advancing Hong Kong\'s blockchain ecosystem' }, { variant: 'full', overlay: 40 }],
    ],
  },
  {
    path: '/about', slug: 'about', titleZh: '關於我們', titleEn: 'About',
    blocks: [['content.rich-text', { html: '<h2>關於香港區塊鏈協會</h2>' }, { html: '<h2>About HKBA</h2>' }, {}]],
  },
  {
    path: '/news', slug: 'news', titleZh: '新聞動態', titleEn: 'News',
    blocks: [
      ['content.hero', { title: '新聞動態', subtitle: '掌握香港區塊鏈協會最新消息' }, { title: 'News', subtitle: 'Latest updates from HKBA' }, { variant: 'network-news', overlay: 35 }],
      ['news.featured', { title: '焦點新聞', description: '' }, { title: 'Featured', description: '' }, { yearMode: 'all', limit: 5, sort: 'newest', source: 'auto', pinnedIds: [], secondaryCount: 2, fallbackToLatest: true, variant: 'flagship' }],
      ['news.category-tabs', { title: '新聞篩選', description: '' }, { title: 'News filters', description: '' }, { yearMode: 'visitor-select', limit: 8, sort: 'newest', maxTabs: 8, variant: 'technology', showYearFilter: true, showCategoryFilter: true }],
      ['news.list', { title: '最新新聞', description: '' }, { title: 'Latest News', description: '' }, { yearMode: 'visitor-select', limit: 9, pageSize: 9, sort: 'newest', variant: 'editorial', showSummary: true, showDate: true }],
    ],
  },
  {
    path: '/events', slug: 'events', titleZh: '活動中心', titleEn: 'Events',
    blocks: [
      ['content.hero', { title: '活動中心', subtitle: '參與協會活動、論壇與行業交流' }, { title: 'Events', subtitle: 'HKBA events, forums and industry exchange' }, { variant: 'left', overlay: 35 }],
      ['association.events', { title: '最新活動', description: '' }, { title: 'Latest Events', description: '' }, { status: 'all', limit: 12, showLocation: true }],
    ],
  },
  {
    path: '/members', slug: 'members', titleZh: '會員單位', titleEn: 'Members',
    blocks: [
      ['content.hero', { title: '會員單位', subtitle: '連結香港與全球區塊鏈生態夥伴' }, { title: 'Members', subtitle: 'Connecting blockchain organisations in Hong Kong and beyond' }, { variant: 'left', overlay: 35 }],
      ['association.members', { title: '會員名錄', description: '' }, { title: 'Member Directory', description: '' }, {}],
      ['association.partners', { title: '合作夥伴', description: '' }, { title: 'Partners', description: '' }, { variant: 'logo-wall' }],
    ],
  },
  {
    path: '/join', slug: 'join', titleZh: '加入我們', titleEn: 'Join Us',
    blocks: [
      ['content.hero', { title: '加入香港區塊鏈協會', subtitle: '選擇適合你的會籍方案' }, { title: 'Join HKBA', subtitle: 'Choose the membership plan that fits you' }, { variant: 'left', overlay: 35 }],
      ['content.membership-plans', { title: '會員方案', description: '', plans: [] }, { title: 'Membership Plans', description: '', plans: [] }, { columns: 3 }],
      ['content.cta', { title: '需要協助？', description: '歡迎聯繫協會了解會籍詳情', button: { label: '聯繫我們', url: '/contact' } }, { title: 'Need help?', description: 'Contact HKBA for membership details', button: { label: 'Contact us', url: '/contact' } }, { backgroundVariant: 'brand' }],
    ],
  },
  {
    path: '/team', slug: 'team', titleZh: '顧問團隊', titleEn: 'Team',
    blocks: [
      ['content.hero', { title: '顧問團隊', subtitle: '匯聚專業力量，共同推動行業發展' }, { title: 'Leadership Team', subtitle: 'Expertise advancing the blockchain industry' }, { variant: 'left', overlay: 35 }],
      ['association.board', { title: '顧問委員會', description: '' }, { title: 'Advisory Board', description: '' }, { status: 'current', showBio: true, showSocial: true }],
    ],
  },
  {
    path: '/contact', slug: 'contact', titleZh: '聯繫我們', titleEn: 'Contact',
    blocks: [
      ['content.hero', { title: '聯繫我們', subtitle: '歡迎與香港區塊鏈協會聯絡' }, { title: 'Contact Us', subtitle: 'Get in touch with HKBA' }, { variant: 'left', overlay: 35 }],
      ['association.contact', { title: '聯繫方式', description: '' }, { title: 'Contact Details', description: '' }, { showMap: true, showSocial: true, showHours: false }],
    ],
  },
];

function insertBlock(conn, versionId, type, sortOrder, contentZh, contentEn, settings) {
  conn.prepare(
    `INSERT INTO page_blocks
      (id, page_version_id, component_type, component_version, sort_order, is_visible, content_zh, content_en, settings)
     VALUES (?, ?, ?, 1, ?, 1, ?, ?, ?)`
  ).run(
    crypto.randomUUID(), versionId, type, sortOrder,
    JSON.stringify(contentZh), JSON.stringify(contentEn), JSON.stringify(settings)
  );
}

function createDraftPage(conn, definition) {
  const pageId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  conn.prepare(
    `INSERT INTO page_nodes
      (id, node_type, slug, path, title_zh, title_en, navigation_status, sort_order, draft_version_id)
     VALUES (?, 'page', ?, ?, ?, ?, 'visible', ?, ?)`
  ).run(pageId, definition.slug, definition.path, definition.titleZh, definition.titleEn, SYSTEM_PAGES.indexOf(definition), versionId);
  conn.prepare(
    `INSERT INTO page_versions (id, page_id, revision, status, seo)
     VALUES (?, ?, 1, 'draft', ?)`
  ).run(versionId, pageId, JSON.stringify({ titleZh: definition.titleZh, titleEn: definition.titleEn }));
  definition.blocks.forEach((block, index) => insertBlock(conn, versionId, block[0], index + 1, block[1], block[2], block[3]));
  return pageId;
}

function clonePublishedToDraft(conn, node) {
  if (node.draft_version_id) return node.draft_version_id;
  const revision = conn.prepare('SELECT COALESCE(MAX(revision), 0) + 1 AS revision FROM page_versions WHERE page_id = ?').get(node.id).revision;
  const draftId = crypto.randomUUID();
  const source = node.published_version_id
    ? conn.prepare('SELECT * FROM page_versions WHERE id = ?').get(node.published_version_id)
    : null;
  conn.prepare(
    `INSERT INTO page_versions (id, page_id, revision, status, seo, source_version_id)
     VALUES (?, ?, ?, 'draft', ?, ?)`
  ).run(draftId, node.id, revision, source?.seo || '{}', source?.id || null);

  if (source) {
    const blocks = conn.prepare('SELECT * FROM page_blocks WHERE page_version_id = ? ORDER BY sort_order').all(source.id);
    const idMap = new Map(blocks.map((block) => [block.id, crypto.randomUUID()]));
    const insert = conn.prepare(
      `INSERT INTO page_blocks
        (id, page_version_id, component_type, component_version, sort_order, parent_block_id, is_visible, anchor_id, content_zh, content_en, settings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const block of blocks) {
      insert.run(
        idMap.get(block.id), draftId, block.component_type, block.component_version, block.sort_order,
        block.parent_block_id ? idMap.get(block.parent_block_id) || null : null,
        block.is_visible, block.anchor_id, block.content_zh, block.content_en, block.settings
      );
    }
  }
  return draftId;
}

function convertMembership(conn, report) {
  const canonical = conn.prepare("SELECT * FROM page_nodes WHERE path = '/members' AND deleted_at IS NULL").get();
  const legacy = conn.prepare("SELECT * FROM page_nodes WHERE path = '/membership' AND deleted_at IS NULL").get();
  if (!legacy) return;

  if (canonical) {
    conn.prepare("UPDATE page_nodes SET deleted_at = datetime('now'), navigation_status = 'hidden', updated_at = datetime('now') WHERE id = ?").run(legacy.id);
  } else {
    const draftId = clonePublishedToDraft(conn, legacy);
    conn.prepare(
      `UPDATE page_nodes
       SET slug = 'members', path = '/members', title_zh = '會員單位', title_en = 'Members',
           published_version_id = NULL, draft_version_id = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(draftId, legacy.id);
  }
  conn.prepare(
    `INSERT INTO redirects (id, from_path, to_path, status_code)
     VALUES (?, '/membership', '/members', 301)
     ON CONFLICT(from_path) DO UPDATE SET to_path = excluded.to_path, status_code = excluded.status_code`
  ).run(crypto.randomUUID());
  report.converted.push('/membership -> /members');
}

function isOldDefaultNewsBlocks(blocks) {
  if (blocks.length !== 2) return false;
  if (blocks[0].component_type !== 'content.hero' || blocks[1].component_type !== 'news.list') return false;
  const heroZh = JSON.parse(blocks[0].content_zh || '{}');
  const heroEn = JSON.parse(blocks[0].content_en || '{}');
  const listZh = JSON.parse(blocks[1].content_zh || '{}');
  const listEn = JSON.parse(blocks[1].content_en || '{}');
  return heroZh.title === '新聞動態'
    && heroEn.title === 'News'
    && listZh.title === '最新新聞'
    && listEn.title === 'Latest News';
}

function upgradeDefaultNewsPage(conn, report) {
  const node = conn.prepare("SELECT * FROM page_nodes WHERE path = '/news' AND deleted_at IS NULL").get();
  if (!node) return;
  const sourceVersionId = node.draft_version_id || node.published_version_id;
  if (!sourceVersionId) return;
  const blocks = conn.prepare('SELECT * FROM page_blocks WHERE page_version_id = ? ORDER BY sort_order').all(sourceVersionId);
  if (!isOldDefaultNewsBlocks(blocks)) return;

  const draftId = node.draft_version_id || clonePublishedToDraft(conn, node);
  if (!node.draft_version_id) {
    conn.prepare("UPDATE page_nodes SET draft_version_id = ?, updated_at = datetime('now') WHERE id = ?").run(draftId, node.id);
  }
  conn.prepare('DELETE FROM page_blocks WHERE page_version_id = ?').run(draftId);
  const definition = SYSTEM_PAGES.find((entry) => entry.path === '/news');
  definition.blocks.forEach((block, index) => insertBlock(conn, draftId, block[0], index + 1, block[1], block[2], block[3]));
  report.upgraded.push('/news');
}

function ensureSystemPages(conn) {
  const report = { created: [], converted: [], upgraded: [] };
  const work = conn.transaction(() => {
    convertMembership(conn, report);
    for (const definition of SYSTEM_PAGES) {
      const existing = conn.prepare('SELECT id FROM page_nodes WHERE path = ? AND deleted_at IS NULL').get(definition.path);
      if (existing) continue;
      createDraftPage(conn, definition);
      report.created.push(definition.path);
    }
    upgradeDefaultNewsPage(conn, report);
  });
  work();
  return report;
}

module.exports = { ensureSystemPages, SYSTEM_PAGES };
