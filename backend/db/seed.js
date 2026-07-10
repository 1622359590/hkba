const Database = require('better-sqlite3');
const path = require('path');
const { DB_PATH } = require('./init');

const db = new Database(DB_PATH);

// ===== Banners =====
const banners = [
  {
    title_zh: '香港區塊鏈協會 HKBA.club',
    title_en: 'Hong Kong Blockchain Association HKBA.club',
    subtitle_zh: 'HongKongBlockchain.org',
    subtitle_en: 'HongKongBlockchain.org',
    description_zh: '香港區塊鏈協會 HKBA.club 是一個重要的組織，致力於推動區塊鏈技術在香港及其周邊地區的發展，並為人們提供了一個交流和合作的平臺。HKBA aims to promote blockchain literacy and build a strong talent pipeline for the Web3 ecosystem in Hong Kong and the Greater Bay Area.',
    description_en: 'The Hong Kong Blockchain Association (HKBA) is a vital organization dedicated to promoting blockchain technology development in Hong Kong and the Greater Bay Area, providing a platform for exchange and collaboration.',
    image_url: 'https://hkba.club/assets/img/home-3/home3-banner-img.png',
    link_url: 'https://Link1.in/HKBA',
    video_url: 'https://www.youtube.com/watch?v=4FA8EMOc0VQ',
    sort_order: 1,
  },
  {
    title_zh: '香港區塊鏈協會 HKBA.club',
    title_en: 'Hong Kong Blockchain Association HKBA.club',
    subtitle_zh: '推動 Web3 生態發展',
    subtitle_en: 'Promoting Web3 Ecosystem Development',
    description_zh: 'Hong Kong has become a burgeoning hub for Web3 & Blockchain and HKBA is here to facilitate and encourage a healthy and sustainable development of Web3 & Blockchain industry.',
    description_en: 'Hong Kong has become a burgeoning hub for Web3 & Blockchain and HKBA is here to facilitate and encourage a healthy and sustainable development of Web3 & Blockchain industry.',
    image_url: 'https://hkba.club/assets/img/home-3/home3-banner-img2.png',
    link_url: '',
    video_url: '',
    sort_order: 2,
  },
  {
    title_zh: '香港區塊鏈協會 HKBA.club',
    title_en: 'Hong Kong Blockchain Association HKBA.club',
    subtitle_zh: '連接全球區塊鏈生態',
    subtitle_en: 'Connecting Global Blockchain Ecosystem',
    description_zh: 'HongKongBlockchain.org 香港區塊鏈協會國際站，連接全球區塊鏈生態，推動技術創新與產業合作。',
    description_en: 'HongKongBlockchain.org - HKBA International Hub, connecting global blockchain ecosystems and driving technology innovation and industry collaboration.',
    image_url: 'https://hkba.club/assets/img/home-3/home3-banner-img3.png',
    link_url: '',
    video_url: '',
    sort_order: 3,
  },
];

// ===== Team Members =====
const team = [
  {
    name_zh: '林家禮博士', name_en: 'Dr. Lee George Lam',
    title_zh: '香港數碼港董事局前主席', title_en: 'Former Chairman of Hong Kong Cyberport',
    bio_zh: '林家禮博士是香港數碼港董事局前主席，在科技和金融領域擁有豐富經驗。', bio_en: 'Dr. Lee George Lam is the former Chairman of Hong Kong Cyberport, with extensive experience in technology and finance.',
    avatar_url: 'https://hkba.club/assets/img/home-4/GeorgeLam.png',
    group_name: 'honorary_chairman', sort_order: 1,
  },
  {
    name_zh: '王兟', name_en: 'Sing Wang',
    title_zh: '香港我哋家主席', title_en: 'Chairman of Our Hong Kong Foundation',
    bio_zh: '王兟先生是香港我哋家主席，積極推動香港科技創新發展。', bio_en: 'Sing Wang is Chairman of Our Hong Kong Foundation, actively promoting technology innovation in Hong Kong.',
    avatar_url: 'https://hkba.club/assets/img/home-4/singwang.png',
    group_name: 'honorary_chairman', sort_order: 2,
  },
  {
    name_zh: '汪揚教授', name_en: 'Prof. Yang Wang',
    title_zh: '香港科技大學副校長', title_en: 'Vice-President of HKUST',
    bio_zh: '汪揚教授是香港科技大學副校長，BS, MS, PhD，在學術和研究領域享有盛譽。', bio_en: 'Prof. Yang Wang is Vice-President of HKUST (BS, MS, PhD), renowned in academia and research.',
    avatar_url: 'https://hkba.club/assets/img/home-4/wy.png',
    group_name: 'honorary_chairman', sort_order: 3,
  },
  {
    name_zh: '唐儀', name_en: 'Tony Tong',
    title_zh: '香港區塊鏈協會會長', title_en: 'President of HKBA',
    bio_zh: 'Com2000.com Web3 Incubator 香港區塊鏈協會 HKBA.club 亞洲元宇宙聯盟 AsiaMeta.club', bio_en: 'Com2000.com Web3 Incubator, Hong Kong Blockchain Association HKBA.club, Asia Meta Alliance AsiaMeta.club',
    avatar_url: 'https://hkba.club/assets/img/home-4/ty.jpg',
    group_name: 'honorary_chairman', sort_order: 4,
  },
];

// ===== Partners =====
const partners = [
  { name: 'AsiaMeta', logo_url: 'https://hkba.club/assets/img/home-3/asiameta2.jpg', website_url: '', sort_order: 1 },
  { name: 'Com2000', logo_url: 'https://hkba.club/assets/img/home-3/2000.jpeg', website_url: '', sort_order: 2 },
  { name: 'BTY', logo_url: 'https://hkba.club/assets/img/home-3/0926/bty.png', website_url: '', sort_order: 3 },
  { name: 'TECHUB NEWS', logo_url: 'https://hkba.club/assets/img/home-3/0926/1.jpg', website_url: '', sort_order: 4 },
  { name: 'Cyberport', logo_url: 'https://hkba.club/assets/img/home-3/0926/smg.jpg', website_url: '', sort_order: 5 },
  { name: 'IDC Capital Vietnam', logo_url: 'https://hkba.club/assets/img/home-3/0926/3.jpg', website_url: '', sort_order: 6 },
  { name: 'iDom. Capital', logo_url: 'https://hkba.club/assets/img/home-3/0926/4.png', website_url: '', sort_order: 7 },
  { name: 'InvestHK FintechHK', logo_url: 'https://hkba.club/assets/img/home-3/0926/5.png', website_url: '', sort_order: 8 },
  { name: 'MetaEra', logo_url: 'https://hkba.club/assets/img/home-3/0926/metaera.png', website_url: '', sort_order: 9 },
  { name: '金色財經', logo_url: 'https://hkba.club/assets/img/home-3/0926/jinsecaijing-logo.jpg', website_url: '', sort_order: 10 },
  { name: 'Trading Base', logo_url: 'https://hkba.club/assets/img/home-3/0926/7.png', website_url: '', sort_order: 11 },
];

// ===== News =====
const news = [
  {
    title_zh: '關於冒認香港區塊鏈協會（幣王APP）的不法行為', title_en: 'Unauthorized Use of HKBA Name (BiWang APP)',
    summary_zh: '近日發現有關我們協會的不實言論及行為，特此發布此澄清公告，釐清事實，以免造成任何誤解。', summary_en: 'Recently discovered false statements and actions regarding our association, hereby issuing this clarification announcement.',
    content_zh: '<p>近日發現有關我們協會的不實言論及行為，特此發布此澄清公告，釐清事實，以免造成任何誤解。有人利用不法WhatsApp號碼：+852-5913 8307、+852 6211 1804 在社群推廣非授權的項目(幣王APP)，並冒認成我們協會共同會長TonyTong唐儀先生作出推廣，唐儀先生已向我會澄清並沒任何關係，全屬冒認！如有發現，請撥打警方熱線舉報虛假身份。</p>',
    content_en: '<p>Recently discovered false statements and actions regarding our association. Unauthorized WhatsApp numbers +852-5913 8307 and +852 6211 1804 have been promoting an unauthorized project (BiWang APP) while impersonating our co-chairman Tony Tong. Mr. Tong has clarified to our association that he has no involvement. If discovered, please report to police.</p>',
    cover_image: 'https://hkba.club/assets/img/news/0828/gg.webp',
    category: '公告', is_published: 1, published_at: '2023-08-28',
  },
  {
    title_zh: 'RWA 帶來港元國際化契機，發行政府支撐港元穩定幣迫在眉睫', title_en: 'RWA Brings Opportunities for HKD Internationalization',
    summary_zh: '現實世界資產（RWA）代幣化，即將有形或無形資產轉化為數字代幣，是數字資產領域的壹次突破性轉變。', summary_en: 'Real World Asset (RWA) tokenization represents a breakthrough transformation in the digital asset field.',
    content_zh: '<p>現實世界資產（RWA）代幣化，即將有形或無形資產轉化為數字代幣，是數字資產領域的壹次突破性轉變，有潛力重新定義市場格局。通過區塊鏈技術，RWA 代幣化提升了交易透明度，加強了安全性，並通過實現部分所有權拓廣了流動性。</p>',
    content_en: '<p>Real World Asset (RWA) tokenization, converting tangible or intangible assets into digital tokens, represents a breakthrough transformation in the digital asset field with potential to redefine market dynamics.</p>',
    cover_image: 'https://hkbaweb.oss-cn-shenzhen.aliyuncs.com/web/hkdg.webp',
    category: 'HKDG＆RWA', is_published: 1, published_at: '2023-08-22',
  },
  {
    title_zh: '香港爭當Web3頭號玩家，誰能吃到第壹波紅利', title_en: 'Hong Kong Aims to Be Web3 Leader',
    summary_zh: '2023年以來，香港本地Web3氛圍熾熱。2023年1月，香港成立數碼港Web3基地，財政預算案更宣布將撥款五千萬港元推動Web3生態圈發展。', summary_en: 'Since 2023, Hong Kong has seen a blazing Web3 atmosphere with the establishment of Cyberport Web3 base.',
    content_zh: '<p>2023年以來，香港本地Web3氛圍熾熱。2023年1月，香港成立數碼港Web3基地，財政預算案更宣布將撥款五千萬港元推動Web3生態圈發展。4月11日，香港再成立Web3.0協會，未來還將設立Web3Hub基金，支持更多海外Web3企業落戶香港。</p>',
    content_en: '<p>Since 2023, Hong Kong local Web3 atmosphere has been blazing. In January 2023, Hong Kong established the Cyberport Web3 base, and the budget announced HK$50 million to promote Web3 ecosystem development.</p>',
    cover_image: 'https://hkbaweb.oss-cn-shenzhen.aliyuncs.com/web/0809/wx/18.png',
    category: 'AI＆Web3', is_published: 1, published_at: '2023-08-09',
  },
  {
    title_zh: 'EDGE全球AI和Web3投資峰會揭幕 創新合作在香港孕育突破', title_en: 'EDGE Global AI and Web3 Investment Summit',
    summary_zh: '作為備受矚目的「EDGE 全球 AI 和 Web3 投資峰會」主辦中心，新一輪科技風暴即將席捲香港。', summary_en: 'As the host center of the EDGE Global AI and Web3 Investment Summit, a new wave of tech innovation is coming to Hong Kong.',
    content_zh: '<p>作為備受矚目的「EDGE 全球 AI 和 Web3 投資峰會」主辦中心，一輪新的科技⻛暴即將席捲香港。 EDGE 跨國投資峰會將於 2023 年 9 月 25 日至 27 日在香港亞洲國際博覽館舉行，將匯聚來自全球最具遠⻅的企業家、投資者、學者、開發者和行業領袖。</p>',
    content_en: '<p>As the host center of the EDGE Global AI and Web3 Investment Summit, a new wave of tech innovation is about to sweep Hong Kong. The EDGE summit will be held at AsiaWorld-Expo from September 25-27, 2023.</p>',
    cover_image: 'https://hkbaweb.oss-cn-shenzhen.aliyuncs.com/web/edge.jpg',
    category: 'AI＆Web3', is_published: 1, published_at: '2023-08-01',
  },
  {
    title_zh: '前海 Web3 Hub 揭牌仪式 圓滿舉辦 綻放啟程', title_en: 'Qianhai Web3 Hub Unveiling Ceremony',
    summary_zh: '8月3日下午兩點，由前海Web3Hub、EDGE、HKBA主辦的揭牌儀式圓滿舉辦。', summary_en: 'On August 3rd, the unveiling ceremony hosted by Qianhai Web3Hub, EDGE, and HKBA was successfully held.',
    content_zh: '<p>8月3日下午兩點，由前海Web3Hub、EDGE、HKBA主辦的"前海Web3 Hub 揭牌儀式 暨全球AI&Web3投資峰會中國區介紹會"圓滿舉辦，前海 Web3 Hub開啟了新的篇章。</p>',
    content_en: '<p>On August 3rd at 2pm, the "Qianhai Web3 Hub Unveiling Ceremony & Global AI&Web3 Investment Summit China Introduction" hosted by Qianhai Web3Hub, EDGE, and HKBA was successfully held.</p>',
    cover_image: 'https://hkbaweb.oss-cn-shenzhen.aliyuncs.com/web/4.jpg',
    category: 'AI＆Web3', is_published: 1, published_at: '2023-08-03',
  },
  {
    title_zh: '火大教育于佳宁受聘出任香港區塊鏈協會榮譽主席', title_en: 'Yu Jianing Appointed as HKBA Honorary Chairman',
    summary_zh: '火大教育校長于佳寧博士受聘成為香港區塊鏈協會榮譽主席。', summary_en: 'Dr. Yu Jianing, President of Huobi University, appointed as HKBA Honorary Chairman.',
    content_zh: '<p>近日，火大教育校長于佳寧博士受聘成為新加坡亞洲區塊鏈產業研究院元宇宙專業委員會主席、香港區塊鏈協會榮譽主席、Alibaba Cloud新加坡創新加速器顧問等職務。</p>',
    content_en: '<p>Dr. Yu Jianing, President of Huobi University, has been appointed as Chairman of the Metaverse Professional Committee of Singapore Asia Blockchain Industry Research Institute, Honorary Chairman of HKBA, and Advisor to Alibaba Cloud Singapore Innovation Accelerator.</p>',
    cover_image: 'https://hkbaweb.oss-cn-shenzhen.aliyuncs.com/web/n1.jpeg',
    category: 'AI＆Web3', is_published: 1, published_at: '2022-11-09',
  },
];

// ===== Announcements =====
const announcements = [
  { content_zh: '點擊訪問：HongKongBlockchain.org 香港區塊鏈協會 HKBA.club 國際站', content_en: 'Visit: HongKongBlockchain.org HKBA International Hub', link_url: 'https://sites.google.com/view/hongkongblockchain', sort_order: 1 },
];

// ===== Milestones =====
const milestones = [
  { year: '2017', title_zh: '協會成立', title_en: 'Association Founded', description_zh: '香港區塊鏈協會正式成立，致力於推動區塊鏈技術在香港的發展', description_en: 'HKBA officially established, dedicated to promoting blockchain technology in Hong Kong', sort_order: 1 },
  { year: '2019', title_zh: '首屆區塊鏈峰會', title_en: 'First Blockchain Summit', description_zh: '成功舉辦首屆香港區塊鏈峰會，吸引數百位業界精英參與', description_en: 'Successfully held the first Hong Kong Blockchain Summit, attracting hundreds of industry leaders', sort_order: 2 },
  { year: '2021', title_zh: '會員規模突破', title_en: 'Membership Breakthrough', description_zh: '協會會員規模突破100家企業，覆蓋多個行業領域', description_en: 'Association membership exceeded 100 companies across multiple industry sectors', sort_order: 3 },
  { year: '2023', title_zh: 'Web3 全面轉型', title_en: 'Full Web3 Transition', description_zh: '全面推動 Web3 生態發展，舉辦 EDGE 全球 AI 和 Web3 投資峰會', description_en: 'Fully promoting Web3 ecosystem development, hosting EDGE Global AI and Web3 Investment Summit', sort_order: 4 },
];

// ===== Stats =====
const stats = [
  { label_zh: '會員企業', label_en: 'Member Companies', value: '200+', icon: 'building', sort_order: 1 },
  { label_zh: '舉辦活動', label_en: 'Events Held', value: '50+', icon: 'calendar', sort_order: 2 },
  { label_zh: '行業夥伴', label_en: 'Industry Partners', value: '100+', icon: 'handshake', sort_order: 3 },
  { label_zh: '覆蓋國家', label_en: 'Countries', value: '20+', icon: 'globe', sort_order: 4 },
];

// ===== Insert all data =====
console.log('🌱 Seeding database...');

// Clear existing data
db.exec('DELETE FROM banners; DELETE FROM team_members; DELETE FROM partners; DELETE FROM news; DELETE FROM announcements; DELETE FROM milestones; DELETE FROM stats;');

// Banners
const insertBanner = db.prepare('INSERT INTO banners (title_zh, title_en, subtitle_zh, subtitle_en, description_zh, description_en, image_url, link_url, video_url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)');
for (const b of banners) {
  insertBanner.run(b.title_zh, b.title_en, b.subtitle_zh, b.subtitle_en, b.description_zh, b.description_en, b.image_url, b.link_url, b.video_url, b.sort_order);
}
console.log(`  ✅ ${banners.length} banners`);

// Team
const insertTeam = db.prepare('INSERT INTO team_members (name_zh, name_en, title_zh, title_en, bio_zh, bio_en, avatar_url, group_name, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)');
for (const t of team) {
  insertTeam.run(t.name_zh, t.name_en, t.title_zh, t.title_en, t.bio_zh, t.bio_en, t.avatar_url, t.group_name, t.sort_order);
}
console.log(`  ✅ ${team.length} team members`);

// Partners
const insertPartner = db.prepare('INSERT INTO partners (name, logo_url, website_url, group_name, sort_order, is_active) VALUES (?, ?, ?, ?, ?, 1)');
for (const p of partners) {
  insertPartner.run(p.name, p.logo_url, p.website_url, 'default', p.sort_order);
}
console.log(`  ✅ ${partners.length} partners`);

// News
const insertNews = db.prepare('INSERT INTO news (title_zh, title_en, summary_zh, summary_en, content_zh, content_en, cover_image, category, is_published, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
for (const n of news) {
  insertNews.run(n.title_zh, n.title_en, n.summary_zh, n.summary_en, n.content_zh, n.content_en, n.cover_image, n.category, n.is_published, n.published_at);
}
console.log(`  ✅ ${news.length} news articles`);

// Announcements
const insertAnnouncement = db.prepare('INSERT INTO announcements (content_zh, content_en, link_url, is_active, sort_order) VALUES (?, ?, ?, 1, ?)');
for (const a of announcements) {
  insertAnnouncement.run(a.content_zh, a.content_en, a.link_url, a.sort_order);
}
console.log(`  ✅ ${announcements.length} announcements`);

// Milestones
const insertMilestone = db.prepare('INSERT INTO milestones (year, title_zh, title_en, description_zh, description_en, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)');
for (const m of milestones) {
  insertMilestone.run(m.year, m.title_zh, m.title_en, m.description_zh, m.description_en, m.sort_order);
}
console.log(`  ✅ ${milestones.length} milestones`);

// Stats
const insertStat = db.prepare('INSERT INTO stats (label_zh, label_en, value, icon, sort_order, is_active) VALUES (?, ?, ?, ?, ?, 1)');
for (const s of stats) {
  insertStat.run(s.label_zh, s.label_en, s.value, s.icon, s.sort_order);
}
console.log(`  ✅ ${stats.length} stats`);

db.close();
console.log('🎉 Seed complete!');
