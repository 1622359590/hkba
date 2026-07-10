const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'hkba.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db = null; // 单例

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function removeExactDuplicates(conn, table, columns) {
  const groupedColumns = columns.join(', ');
  conn.prepare(`
    DELETE FROM ${table}
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM ${table}
      GROUP BY ${groupedColumns}
    )
  `).run();
}

function removeLegacyMilestones(conn) {
  const legacyRows = [
    ['2017', '協會成立', '香港區塊鏈協會正式成立'],
    ['2019', '首屆峰會', '舉辦首屆區塊鏈峰會'],
    ['2021', '會員突破', '會員數量突破100家'],
    ['2023', 'Web3 轉型', '全面推動 Web3 生態發展'],
  ];
  const remove = conn.prepare('DELETE FROM milestones WHERE year = ? AND title_zh = ? AND description_zh = ?');
  for (const row of legacyRows) remove.run(...row);
}

function normalizeLegacyPartnerNames(conn) {
  const migrations = [
    ['Com2000', 'Partner 2000', '%/2000.%'],
    ['TECHUB NEWS', 'Partner 1', '%/0926/1.jpg'],
    ['Cyberport', 'SMG', '%/0926/smg.jpg'],
    ['IDC Capital Vietnam', 'Partner 3', '%/0926/3.jpg'],
    ['iDom. Capital', 'Partner 4', '%/0926/4.png'],
    ['InvestHK FintechHK', 'Partner 5', '%/0926/5.png'],
    ['Trading Base', 'Partner 7', '%/0926/7.png'],
  ];
  const update = conn.prepare('UPDATE partners SET name = ? WHERE name = ? AND logo_url LIKE ?');
  for (const migration of migrations) update.run(...migration);
}

function initDatabase() {
  const conn = getDb();

  // 执行建表 SQL
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  conn.exec(schema);

  removeExactDuplicates(conn, 'stats', ['label_zh', 'label_en', 'value', 'icon', 'sort_order', 'is_active']);
  removeExactDuplicates(conn, 'milestones', ['year', 'title_zh', 'title_en', 'description_zh', 'description_en', 'sort_order', 'is_active']);
  removeLegacyMilestones(conn);
  normalizeLegacyPartnerNames(conn);

  // 插入默认管理员
  const adminExists = conn.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('hkba2024', 10);
    conn.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', hash);
    console.log('✅ Default admin created: admin / hkba2024');
  }

  // 插入默认联系信息
  const contactDefaults = [
    ['phone', '852 6224 4422'],
    ['email', 'info@hkba.club'],
    ['address_zh', '香港'],
    ['address_en', 'Hong Kong'],
    ['facebook', 'https://www.facebook.com/185793572074637'],
    ['twitter', 'https://www.twitter.com/HKBAclub'],
    ['youtube', 'https://www.youtube.com/channel/UCxdIHJTUX_rZSm-X9vDxiTg'],
    ['instagram', 'https://www.instagram.com/ttpact'],
    ['linkedin', 'https://www.linkedin.com/company/hongkongblockchainassociation'],
  ];
  const insertContact = conn.prepare('INSERT OR IGNORE INTO contact_info (key, value) VALUES (?, ?)');
  for (const [key, value] of contactDefaults) {
    insertContact.run(key, value);
  }

  // 插入默认页面
  const pageDefaults = [
    {
      slug: 'about',
      title_zh: '關於我們',
      title_en: 'About Us',
      content_zh: '<h2>關於香港區塊鏈協會</h2><p>香港區塊鏈協會（Hong Kong Blockchain Association）是一個致力於推動和發展區塊鏈技術的組織。協會成立於2017年，旨在促進香港的區塊鏈生態系統的發展，並推動區塊鏈技術在不同領域的應用。</p>',
      content_en: '<h2>About HKBA</h2><p>The Hong Kong Blockchain Association (HKBA) is an organization dedicated to promoting and developing blockchain technology. Founded in 2017, the association aims to foster the development of Hong Kong\'s blockchain ecosystem and promote the application of blockchain technology across different sectors.</p>',
    },
    {
      slug: 'membership',
      title_zh: '會員服務',
      title_en: 'Membership',
      content_zh: '<h2>成為會員</h2><p>加入香港區塊鏈協會，與業界精英共同推動區塊鏈技術發展。</p>',
      content_en: '<h2>Become a Member</h2><p>Join the Hong Kong Blockchain Association and work with industry leaders to advance blockchain technology.</p>',
    },
  ];
  const insertPage = conn.prepare(
    'INSERT OR IGNORE INTO pages (slug, title_zh, title_en, content_zh, content_en) VALUES (?, ?, ?, ?, ?)'
  );
  for (const p of pageDefaults) {
    insertPage.run(p.slug, p.title_zh, p.title_en, p.content_zh, p.content_en);
  }

  // 插入默认统计数据
  const statsDefaults = [
    { label_zh: '會員企業', label_en: 'Member Companies', value: '200+', icon: 'building', sort: 1 },
    { label_zh: '舉辦活動', label_en: 'Events Held', value: '50+', icon: 'calendar', sort: 2 },
    { label_zh: '行業夥伴', label_en: 'Industry Partners', value: '100+', icon: 'handshake', sort: 3 },
    { label_zh: '覆蓋國家', label_en: 'Countries', value: '20+', icon: 'globe', sort: 4 },
  ];
  const insertStat = conn.prepare(
    'INSERT OR IGNORE INTO stats (label_zh, label_en, value, icon, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  const statCount = conn.prepare('SELECT COUNT(*) AS count FROM stats').get().count;
  if (statCount === 0) {
    for (const s of statsDefaults) {
      insertStat.run(s.label_zh, s.label_en, s.value, s.icon, s.sort);
    }
  }

  // 插入默认里程碑
  const milestonesDefaults = [
    { year: '2017', title_zh: '協會成立', title_en: 'Association Founded', desc_zh: '香港區塊鏈協會正式成立', desc_en: 'HKBA officially established', sort: 1 },
    { year: '2019', title_zh: '首屆峰會', title_en: 'First Summit', desc_zh: '舉辦首屆區塊鏈峰會', desc_en: 'Hosted the first blockchain summit', sort: 2 },
    { year: '2021', title_zh: '會員突破', title_en: 'Membership Breakthrough', desc_zh: '會員數量突破100家', desc_en: 'Membership exceeded 100', sort: 3 },
    { year: '2023', title_zh: 'Web3 轉型', title_en: 'Web3 Transition', desc_zh: '全面推動 Web3 生態發展', desc_en: 'Fully promoting Web3 ecosystem development', sort: 4 },
  ];
  const insertMilestone = conn.prepare(
    'INSERT OR IGNORE INTO milestones (year, title_zh, title_en, description_zh, description_en, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const milestoneCount = conn.prepare('SELECT COUNT(*) AS count FROM milestones').get().count;
  if (milestoneCount === 0) {
    for (const m of milestonesDefaults) {
      insertMilestone.run(m.year, m.title_zh, m.title_en, m.desc_zh, m.desc_en, m.sort);
    }
  }

  console.log('✅ Database initialized at', DB_PATH);
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { initDatabase, getDb, closeDatabase, DB_PATH };
