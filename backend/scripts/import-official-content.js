#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { migrate } = require('../db/migrate');
const { ensureSystemPages } = require('../lib/ensureSystemPages');

const MARKER = { oldTable: 'official_site', oldId: 1, newTable: 'official_content' };

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function paragraphs(items) {
  return items.map((item) => `<p>${escapeHtml(item)}</p>`).join('');
}

function hero(title, subtitle, primary, secondary) {
  return {
    type: 'content.hero',
    zh: { title: title.zh, subtitle: subtitle.zh, backgroundMediaId: '', primaryButton: primary.zh, secondaryButton: secondary?.zh || { label: '', url: '' } },
    en: { title: title.en, subtitle: subtitle.en, backgroundMediaId: '', primaryButton: primary.en, secondaryButton: secondary?.en || { label: '', url: '' } },
    settings: { variant: 'left', overlay: 35 },
  };
}

function association(type, titleZh, titleEn, settings = {}) {
  return { type, zh: { title: titleZh, description: '' }, en: { title: titleEn, description: '' }, settings };
}

function pageDefinitions(snapshot) {
  const plansZh = snapshot.membershipPlans;
  const plansEn = snapshot.membershipPlans.map((plan) => ({ ...plan, buttonLabel: 'Download application form' }));
  const groupSections = [
    ['honorary_chairman', '榮譽主席', 'Honorary Chairman'],
    ['co_chairman', '聯席會長', 'Co-Chairman'],
    ['vice_chairman', '副主席', 'Vice Chairman'],
    ['industry_expert', '業界專家顧問', 'Industry Experts'],
    ['ambassador', '協會大使', 'HKBA Ambassadors'],
    ['secretary_general', '聯席秘書長', 'Secretary General'],
  ];
  const contactDetailsZh = [snapshot.contact.business, snapshot.contact.education, snapshot.contact.enquiries];
  const contactDetailsEn = [
    'Business cooperation: WhatsApp David +852 6224 4422',
    'EDI.college course and customised services: WhatsApp Cindy +852 6182 0903',
    'General enquiries: WhatsApp Ms So +852 9097 1709 / 6182 0903 / 5509 4404 Phillip',
  ];

  return [
    {
      path: '/', titleZh: '首頁', titleEn: 'Home',
      blocks: [
        hero(
          { zh: '香港區塊鏈協會 HKBA.club', en: 'Hong Kong Blockchain Association' },
          { zh: snapshot.home.introZh, en: snapshot.home.introEn },
          { zh: { label: '關於協會', url: '/about' }, en: { label: 'About HKBA', url: '/about' } },
          { zh: { label: '加入我們', url: '/join' }, en: { label: 'Join us', url: '/join' } }
        ),
        association('association.partners', '合作夥伴', 'Partners', {
          variant: 'carousel', autoPlay: true, speed: 'slow', direction: 'left', pauseOnHover: true,
        }),
        association('association.board', '榮譽主席', 'Honorary Chairman', { roles: ['honorary_chairman'], status: 'current', showBio: true, showSocial: false, limit: 4 }),
        { type: 'news.grid', zh: { title: '協會新聞', description: '' }, en: { title: 'Association News', description: '' }, settings: { yearMode: 'all', limit: 6, sort: 'newest', showYearFilter: false, showSummary: true, showDate: true } },
      ],
    },
    {
      path: '/about', titleZh: '關於 HKBA', titleEn: 'About HKBA',
      blocks: [
        hero(
          { zh: '香港區塊鏈協會', en: 'Hong Kong Blockchain Association' },
          { zh: '關於 HKBA', en: 'About HKBA' },
          { zh: { label: '加入我們', url: '/join' }, en: { label: 'Join HKBA', url: '/join' } }
        ),
        { type: 'content.rich-text', zh: { html: `<h2>ABOUT HKBA 關於香港區塊鏈協會</h2>${paragraphs(snapshot.about.zh)}` }, en: { html: `<h2>ABOUT HKBA</h2>${paragraphs(snapshot.about.en)}` }, settings: {} },
        {
          type: 'content.stats',
          zh: { items: snapshot.stats.map((item) => ({ value: item.value, unit: '', label: item.labelZh, description: '' })) },
          en: { items: snapshot.stats.map((item) => ({ value: item.value, unit: '', label: item.labelEn, description: '' })) },
          settings: {},
        },
        association('association.partners', '合作夥伴', 'Partners', {
          variant: 'carousel', autoPlay: true, speed: 'slow', direction: 'left', pauseOnHover: true,
        }),
      ],
    },
    {
      path: '/members', titleZh: '領導委員會成員', titleEn: 'Leadership Members',
      blocks: [
        hero(
          { zh: '領導委員會成員', en: 'Leadership Members' },
          { zh: '香港區塊鏈協會領導團隊與專家顧問', en: 'HKBA leadership, experts and ambassadors' },
          { zh: { label: '加入我們', url: '/join' }, en: { label: 'Join HKBA', url: '/join' } }
        ),
        ...groupSections.map(([group, zh, en]) => association('association.board', zh, en, { roles: [group], status: 'current', showBio: true, showSocial: true })),
      ],
    },
    {
      path: '/join', titleZh: '加入我們', titleEn: 'Join HKBA',
      blocks: [
        hero(
          { zh: '成為香港區塊鏈協會會員', en: 'Become an HKBA Member' },
          { zh: '連結、交流並共同推動大灣區區塊鏈與 Web3 生態', en: 'Connect, collaborate and advance the Greater Bay Area blockchain and Web3 ecosystem' },
          { zh: { label: '聯繫我們', url: '/contact' }, en: { label: 'Contact us', url: '/contact' } }
        ),
        {
          type: 'content.image-text',
          zh: { title: 'HKBA MEMBERSHIP 會員制度', body: `<p>${escapeHtml(snapshot.membership.introZh)}</p>`, mediaId: '', externalMediaUrl: snapshot.membership.imageUrl, button: { label: '聯繫我們', url: '/contact' } },
          en: { title: 'HKBA MEMBERSHIP', body: `<p>${escapeHtml(snapshot.membership.introEn)}</p>`, mediaId: '', externalMediaUrl: snapshot.membership.imageUrl, button: { label: 'Contact us', url: '/contact' } },
          settings: { mediaPosition: 'right', variant: 'two-col' },
        },
        {
          type: 'content.stats',
          zh: { title: '成為 HKBA 會員專享的優勢', items: snapshot.membership.benefitsZh.map((item, index) => ({ value: String(index + 1).padStart(2, '0'), unit: '', label: item.label, description: item.description })) },
          en: { title: 'HKBA Member Benefits', items: snapshot.membership.benefitsEn.map((item, index) => ({ value: String(index + 1).padStart(2, '0'), unit: '', label: item.label, description: item.description })) },
          settings: { variant: 'features' },
        },
        { type: 'content.membership-plans', zh: { title: '會員方案', description: '選擇合適的會員類型並下載申請表。', plans: plansZh }, en: { title: 'Membership Plans', description: 'Choose a membership type and download the application form.', plans: plansEn }, settings: { columns: 3 } },
        { type: 'content.cta', zh: { title: '對會籍有疑問？', description: '協會團隊會協助你選擇合適方案。', button: { label: '聯繫我們', url: '/contact' } }, en: { title: 'Questions about membership?', description: 'Our team can help you choose the right plan.', button: { label: 'Contact us', url: '/contact' } }, settings: { backgroundVariant: 'brand' } },
      ],
    },
    {
      path: '/contact', titleZh: '聯繫我們', titleEn: 'Contact Us',
      blocks: [
        hero(
          { zh: '聯繫我們', en: 'Contact Us' },
          { zh: '歡迎聯絡香港區塊鏈協會', en: 'Get in touch with the Hong Kong Blockchain Association' },
          { zh: { label: '發送留言', url: '#message' }, en: { label: 'Send a message', url: '#message' } }
        ),
        association('association.contact', '歡迎聯絡本會', 'Contact HKBA', { showMap: false, showSocial: true, showHours: false }),
        { type: 'content.rich-text', zh: { html: paragraphs(contactDetailsZh) }, en: { html: paragraphs(contactDetailsEn) }, settings: {} },
        { type: 'content.contact-form', zh: { title: '給我們留言', description: '提交後可在後台留言中心查看。', submitLabel: '提交' }, en: { title: 'Make an Enquiry', description: 'Messages appear in the CMS message centre.', submitLabel: 'Submit' }, settings: { showSubject: true }, anchorId: 'message' },
        association('association.map', '地圖位置', 'Location', { height: 480, rounded: true }),
      ],
    },
    {
      path: '/news', titleZh: '協會新聞與動態', titleEn: 'Association News',
      blocks: [
        hero(
          { zh: '協會新聞與動態', en: 'Association News & Updates' },
          { zh: '掌握香港區塊鏈協會最新消息', en: 'Latest news from HKBA' },
          { zh: { label: '查看最新消息', url: '#news-list' }, en: { label: 'Latest news', url: '#news-list' } }
        ),
        { type: 'news.grid', zh: { title: '最新消息', description: '' }, en: { title: 'Latest News', description: '' }, settings: { yearMode: 'all', limit: 12, sort: 'newest', showYearFilter: true, showSummary: true, showDate: true }, anchorId: 'news-list' },
      ],
    },
  ];
}

function insertBlock(conn, versionId, block, sortOrder) {
  conn.prepare(
    `INSERT INTO page_blocks
      (id, page_version_id, component_type, component_version, sort_order, is_visible, anchor_id, content_zh, content_en, settings)
     VALUES (?, ?, ?, 1, ?, 1, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), versionId, block.type, sortOrder, block.anchorId || null, JSON.stringify(block.zh || {}), JSON.stringify(block.en || {}), JSON.stringify(block.settings || {}));
}

function replaceDraft(conn, page, publish) {
  const node = conn.prepare('SELECT * FROM page_nodes WHERE path = ? AND deleted_at IS NULL').get(page.path);
  if (!node) throw new Error(`Missing system page ${page.path}`);
  const revision = conn.prepare('SELECT COALESCE(MAX(revision), 0) + 1 AS revision FROM page_versions WHERE page_id = ?').get(node.id).revision;
  if (node.draft_version_id) conn.prepare("UPDATE page_versions SET status = 'superseded' WHERE id = ?").run(node.draft_version_id);
  const versionId = crypto.randomUUID();
  const status = publish ? 'published' : 'draft';
  conn.prepare(
    `INSERT INTO page_versions (id, page_id, revision, status, seo, published_at)
     VALUES (?, ?, ?, ?, ?, ${publish ? "datetime('now')" : 'NULL'})`
  ).run(versionId, node.id, revision, status, JSON.stringify({ titleZh: page.titleZh, titleEn: page.titleEn }));
  page.blocks.forEach((block, index) => insertBlock(conn, versionId, block, index + 1));
  if (publish) {
    conn.prepare("UPDATE page_versions SET status = 'superseded' WHERE page_id = ? AND status = 'published' AND id != ?").run(node.id, versionId);
    conn.prepare('UPDATE page_nodes SET title_zh = ?, title_en = ?, published_version_id = ?, draft_version_id = NULL, updated_at = datetime(\'now\') WHERE id = ?').run(page.titleZh, page.titleEn, versionId, node.id);
  } else {
    conn.prepare('UPDATE page_nodes SET title_zh = ?, title_en = ?, draft_version_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(page.titleZh, page.titleEn, versionId, node.id);
  }
}

function importMembers(conn, members) {
  conn.prepare('UPDATE team_members SET is_active = 0').run();
  const find = conn.prepare('SELECT id FROM team_members WHERE name_zh = ? AND name_en = ? ORDER BY id LIMIT 1');
  const update = conn.prepare(
    `UPDATE team_members SET title_zh = ?, title_en = ?, bio_zh = ?, bio_en = ?, avatar_url = ?, group_name = ?,
       social_facebook = ?, social_twitter = ?, social_linkedin = ?, social_instagram = ?, sort_order = ?, is_active = 1 WHERE id = ?`
  );
  const insert = conn.prepare(
    `INSERT INTO team_members
      (name_zh, name_en, title_zh, title_en, bio_zh, bio_en, avatar_url, group_name,
       social_facebook, social_twitter, social_linkedin, social_instagram, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );
  members.forEach((member, index) => {
    const values = [member.titleZh, member.titleEn, member.bioZh, member.bioEn, member.avatarUrl, member.group, member.socials.facebook || '', member.socials.twitter || '', member.socials.linkedin || '', member.socials.instagram || '', index + 1];
    const existing = find.get(member.nameZh, member.nameEn);
    if (existing) update.run(...values, existing.id);
    else insert.run(member.nameZh, member.nameEn, ...values);
  });
}

function importOfficialContent(conn, snapshot, options = {}) {
  const { publish = false, force = false } = options;
  migrate(conn);
  const existing = conn.prepare('SELECT new_id FROM legacy_id_map WHERE old_table = ? AND old_id = ? AND new_table = ?').get(MARKER.oldTable, MARKER.oldId, MARKER.newTable);
  if (existing && !force) return { skipped: true, members: 0, pages: [] };

  const report = { skipped: false, members: snapshot.members.length, pages: [] };
  conn.transaction(() => {
    ensureSystemPages(conn);
    importMembers(conn, snapshot.members);
    const upsertContact = conn.prepare('INSERT INTO contact_info (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP');
    Object.entries(snapshot.contact).forEach(([key, value]) => upsertContact.run(key, String(value)));
    for (const page of pageDefinitions(snapshot)) {
      replaceDraft(conn, page, publish);
      report.pages.push(page.path);
    }
    conn.prepare('DELETE FROM legacy_id_map WHERE old_table = ? AND old_id = ? AND new_table = ?').run(MARKER.oldTable, MARKER.oldId, MARKER.newTable);
    conn.prepare(
      `INSERT INTO legacy_id_map (id, old_table, old_id, new_table, new_id, source, status)
       VALUES (?, ?, ?, ?, ?, ?, 'done')`
    ).run(crypto.randomUUID(), MARKER.oldTable, MARKER.oldId, MARKER.newTable, snapshot.source.capturedAt, snapshot.source.pages.join(','));
  })();
  return report;
}

function parseArgs(argv) {
  const args = { db: process.env.HKBA_DB_PATH || path.join(__dirname, '..', 'db', 'hkba.db'), publish: false, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--db') args.db = argv[++index];
    else if (argv[index] === '--publish') args.publish = true;
    else if (argv[index] === '--force') args.force = true;
  }
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'official-content.json'), 'utf8'));
  const conn = new Database(args.db);
  conn.pragma('foreign_keys = ON');
  try {
    console.log(JSON.stringify(importOfficialContent(conn, snapshot, args), null, 2));
  } finally {
    conn.close();
  }
}

module.exports = { importOfficialContent, pageDefinitions };
