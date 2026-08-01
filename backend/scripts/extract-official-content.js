#!/usr/bin/env node

// Builds the reviewed, structured import snapshot from locally downloaded
// official HKBA pages. Keeping extraction separate from import makes the live
// database update deterministic and lets the source HTML be audited first.

const fs = require('fs');
const path = require('path');

const sourceDir = process.argv[2] || '/private/tmp';
const output = process.argv[3] || path.join(__dirname, '..', 'data', 'official-content.json');

function read(name) {
  return fs.readFileSync(path.join(sourceDir, name), 'utf8');
}

function decode(value) {
  const named = {
    amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '-', mdash: '-', middot: '·',
  };
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity) => {
      if (entity[0] === '#') {
        const hex = entity[1].toLowerCase() === 'x';
        return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
      }
      return named[entity.toLowerCase()] ?? `&${entity};`;
    })
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function absoluteUrl(value, page) {
  try {
    return new URL(String(value || '').trim(), `https://hkba.club/${page}`).href;
  } catch {
    return '';
  }
}

function extractMembers(html) {
  const headings = [];
  const headingRe = /<div class="section-title-3[^"]*"[\s\S]*?<h2>([\s\S]*?)<\/h2>/gi;
  let headingMatch;
  while ((headingMatch = headingRe.exec(html))) {
    headings.push({ index: headingMatch.index, label: decode(headingMatch[1]) });
  }

  const groupMap = [
    [/Honorary Chairman/i, 'honorary_chairman'],
    [/Co-Chairman/i, 'co_chairman'],
    [/Vice Chairman/i, 'vice_chairman'],
    [/Industry Experts/i, 'industry_expert'],
    [/Ambassadors/i, 'ambassador'],
    [/Secretary General/i, 'secretary_general'],
  ];
  const starts = [];
  const contentRe = /<div class="experts-content">/gi;
  let contentMatch;
  while ((contentMatch = contentRe.exec(html))) starts.push(contentMatch.index);

  const members = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = starts[index + 1] || html.length;
    const segment = html.slice(start, end);
    const heading = [...headings].reverse().find((item) => item.index < start);
    const group = groupMap.find(([pattern]) => pattern.test(heading?.label || ''))?.[1];
    if (!group) continue;

    const h4 = segment.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1] || '';
    const nameParts = h4.split(/<br\s*\/?>/i).map(decode).filter(Boolean);
    if (!nameParts.length) continue;

    const paragraphs = [...segment.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => decode(match[1]))
      .filter(Boolean)
      .slice(0, 12);
    const before = html.slice(Math.max(0, start - 3200), start);
    const imageMatches = [...before.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
    const avatarUrl = absoluteUrl(imageMatches.at(-1)?.[1], 'membership.html');
    const social = {};
    for (const [kind, pattern] of Object.entries({
      facebook: /facebook\.com/i,
      twitter: /(twitter\.com|x\.com)/i,
      linkedin: /linkedin\.com/i,
      instagram: /instagram\.com/i,
    })) {
      const links = [...before.slice(-1800).matchAll(/<a[^>]+href=["']([^"']+)["']/gi)];
      social[kind] = links.map((match) => match[1]).reverse().find((url) => pattern.test(url)) || '';
    }

    members.push({
      nameZh: nameParts[0],
      nameEn: nameParts[1] || '',
      titleZh: paragraphs[0] || '',
      titleEn: paragraphs[0] || '',
      bioZh: paragraphs.slice(1).join('\n'),
      bioEn: paragraphs.slice(1).join('\n'),
      avatarUrl,
      group,
      socials: social,
    });
  }
  const unique = new Map();
  for (const member of members) {
    const key = `${member.group}|${member.nameZh}|${member.nameEn}`;
    if (!unique.has(key)) unique.set(key, member);
  }
  return [...unique.values()];
}

function extractPlans(html) {
  const starts = [...html.matchAll(/<div class="pricing-card two">/gi)].map((match) => match.index);
  return starts.map((start, index) => {
    const segment = html.slice(start, starts[index + 1] || html.length);
    const name = decode(segment.match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    const price = decode(segment.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]);
    const benefits = [...segment.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((match) => decode(match[1]))
      .filter(Boolean)
      .slice(0, 8);
    const button = [...segment.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => ({ url: absoluteUrl(match[1], 'member.html'), label: decode(match[2]) }))
      .find((item) => /下載|下载|download/i.test(item.label));
    return { name, price, benefits, buttonLabel: button?.label || '下載登記表格', buttonUrl: button?.url || '' };
  }).filter((plan) => plan.name && plan.price);
}

const membership = read('hkba-membership.html');
const join = read('hkba-join.html');

const snapshot = {
  source: {
    capturedAt: new Date().toISOString(),
    pages: [
      'https://hkba.club/',
      'https://hkba.club/abouthkba.html',
      'https://hkba.club/membership.html',
      'https://hkba.club/member.html',
      'https://hkba.club/contact.html',
      'https://hkba.club/news.html',
    ],
  },
  home: {
    introZh: 'HongKongBlockchain.org 香港區塊鏈協會 HKBA.club 是一個區塊鏈組織，致力於推動區塊鏈技術在香港及其周邊地區的發展，並為人們提供一個交流和合作的平台。',
    introEn: 'HKBA aims to promote blockchain literacy and build a strong talent pipeline for the Web3 ecosystem in Hong Kong and the Greater Bay Area. Hong Kong has become a burgeoning hub for Web3 and blockchain, and HKBA is here to facilitate and encourage a healthy and sustainable development of the industry.',
  },
  about: {
    zh: [
      '香港區塊鏈協會（Hong Kong Blockchain Association）是一個致力於推動和發展區塊鏈技術的組織。協會成立於2017年，旨在促進香港的區塊鏈生態系統發展，並推動區塊鏈技術在不同領域的應用。協會的使命是通過教育、研究和推廣來提高公眾對區塊鏈技術的認識和理解。協會組織各類活動，包括會議、研討會和培訓課程，旨在促進區塊鏈技術的知識分享和合作。',
      '協會的成員來自不同領域，包括學術界、企業界和政府部門，他們共同致力於推動香港成為一個區塊鏈創新和應用的中心。協會與相關機構和組織建立了廣泛的合作夥伴關係，以推動區塊鏈技術的發展，並與國際社群進行交流與合作。',
      '香港區塊鏈協會是一個重要的組織，致力於推動區塊鏈技術在香港及其周邊地區的發展，並為人們提供一個交流和合作的平台。',
    ],
    en: [
      'Hong Kong Blockchain Association was formed in 2017 by co-founders TonyTong.co, Thomas Cheung, Julian GSRMatrix.vc, Madison Blockchain, Since then, HKBA has grown to become the leading industry association for the Blockchain and Web3 community in Hong Kong and the Greater Bay Area.',
      'HKBA seeks to empower its members and the community to leverage blockchain and Web3 technologies for business growth and transformation. HKBA is dedicated to being an open platform for members to engage with multiple stakeholders, and promote best practices in a collaborative, open, and transparent manner.',
      'HKBA aims to promote blockchain literacy and build a strong talent pipeline for the Web3 ecosystem in Hong Kong and the Greater Bay Area. Hong Kong has become a burgeoning hub for Web3 and Blockchain and HKBA is here to facilitate and encourage a healthy and sustainable development of the industry.',
    ],
  },
  stats: [
    { value: '2017', labelZh: '協會成立', labelEn: 'Founded' },
    { value: '1.8K+', labelZh: '社群成員', labelEn: 'Community members' },
    { value: '86+', labelZh: '合作項目', labelEn: 'Projects' },
    { value: '63+', labelZh: '行業榮譽', labelEn: 'Awards' },
  ],
  members: extractMembers(membership),
  membershipPlans: extractPlans(join),
  membership: {
    imageUrl: 'https://hkba.club/assets/img/inner-pages/about.webp',
    introZh: 'HKBA 香港區塊鏈協會（聯盟）成立於 2017 年，是一個開放、自主、平等的去中心化組織 Decentralized Organization DAO。亞洲元宇宙聯盟 AsiaMeta.club 為大中華區業內專家提供交流的渠道，通過學習、交流及推廣區塊鏈技術及應用，致力於成為鏈接大中華及元宇宙世界的銜接平台，並將香港打造成新時代的金融科技中心。',
    introEn: 'Founded in 2017, Hong Kong Blockchain Association (HKBA.club) is an organization with open mind, equality and decentralization. Through learning, communication and promotion of blockchain technology and its applications, HKBA aims to establish a platform to connect blockchain practitioners in Greater China and around the world. HKBA is also committed to building Hong Kong as the financial technology center in the new blockchain and fintech era.',
    benefitsZh: [
      { label: '開拓人脈', description: '香港區塊鏈協會 HKBA 是香港最國際化的本地區塊鏈商會，助您擴闊商業圈和開拓新業務。' },
      { label: '緊貼市場', description: 'HKBA 雄厚和具廣泛代表性的會員網絡，主導我們成為金融科技界之聲，締造更佳的營商環境，同時盡早掌握大中華地區的區塊鏈發展趨勢。' },
      { label: '最新資訊', description: '只需一個 HKBA 企業會籍，貴公司的所有全職員工均可享用本會的各項服務和優惠。' },
      { label: '免費培訓', description: '參加 Blockchain、NFT、Metaverse Education 知識型活動和培訓坊，緊貼市場最新發展和更新技能。' },
      { label: '發表建議', description: '反映您對 FinTech 與 Virtual Assets Management 政策的意見，締造更佳的營商環境。' },
    ],
    benefitsEn: [
      { label: 'Grow Your Network', description: 'Connect with HKBA\'s international blockchain community in Hong Kong to expand your business network and discover new opportunities.' },
      { label: 'Stay Close to the Market', description: 'Join a broad member network, contribute to the fintech industry voice and keep pace with blockchain trends across Greater China.' },
      { label: 'Latest Information', description: 'One HKBA corporate membership gives all full-time employees access to association services and member benefits.' },
      { label: 'Free Training', description: 'Join blockchain, NFT and metaverse education events and workshops to keep knowledge and skills current.' },
      { label: 'Make Your Voice Heard', description: 'Share views on fintech and virtual asset management policy to help create a better business environment.' },
    ],
  },
  contact: {
    address_zh: '香港九龍尖沙咀漢口道5-15號漢口中心217室',
    address_en: 'Hankow Centre, Room 217, 5-15 Hankow Road, Tsim Sha Tsui TST, Kowloon, Hong Kong',
    phone: '+852 6224 4422',
    email: 'info@HKBA.club',
    business: '商務合作：WhatsApp David +852 6224 4422',
    education: 'EDI.college 課程查詢或客制化服務：WhatsApp Cindy +852 6182 0903',
    enquiries: '會務查詢：WhatsApp Ms So +852 9097 1709 / 6182 0903 / 5509 4404 Phillip',
    facebook: 'https://www.facebook.com/185793572074637',
    twitter: 'https://www.twitter.com/HKBAclub',
    youtube: 'https://www.youtube.com/channel/UCxdIHJTUX_rZSm-X9vDxiTg',
    instagram: 'https://www.instagram.com/ttpact',
    linkedin: 'https://www.linkedin.com/company/hongkongblockchainassociation',
    map_embed_url: 'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3691.4693788371087!2d114.1755445!3d22.2980814!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x340400efc13fffff%3A0x5f67cd1fc2b196cf!2sTsim%20Sha%20Tsui%20Centre!5e0!3m2!1szh-CN!2sus!4v1690441801691!5m2!1szh-CN!2sus',
  },
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({ output, members: snapshot.members.length, groups: snapshot.members.reduce((acc, member) => ({ ...acc, [member.group]: (acc[member.group] || 0) + 1 }), {}), plans: snapshot.membershipPlans.length }, null, 2));
