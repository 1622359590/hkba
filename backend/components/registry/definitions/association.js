// Association data components (catalog §5.1-5.6). These read structured
// association data through controlled resolvers; editors never copy member or
// partner content into the page.

function associationComponent({ type, name, description, contentFields = {}, settingsFields = {} }) {
  return {
    type,
    version: 1,
    category: 'association',
    name,
    description,
    allowedPageTypes: ['page'],
    isLayout: false,
    schema: {
      content: {
        fields: {
          title: { type: 'string', maxLength: 120, default: '', label: '標題' },
          description: { type: 'string', maxLength: 300, default: '', label: '說明' },
          ...contentFields,
        },
      },
      settings: { fields: settingsFields },
    },
    migrations: {},
  };
}

module.exports = [
  associationComponent({
    type: 'association.board',
    name: { zh: '理事成員', en: 'Board Members' },
    description: '來源為結構化成員數據，不把人物信息複製進頁面。',
    settingsFields: {
      term: { type: 'string', maxLength: 20, default: '', label: '屆次/年份' },
      roles: { type: 'array', item: { type: 'string' }, default: [], label: '角色篩選' },
      status: { type: 'enum', values: ['current', 'past', 'all'], default: 'current', label: '狀態' },
      showBio: { type: 'boolean', default: true, label: '顯示簡介' },
      showSocial: { type: 'boolean', default: true, label: '顯示社交連結' },
    },
  }),
  associationComponent({
    type: 'association.members',
    name: { zh: '會員名錄', en: 'Member Directory' },
    description: '首期只展示公開字段；聯繫信息默認不公開。',
    settingsFields: {
      memberType: { type: 'string', maxLength: 40, default: '', label: '會員類型' },
      industry: { type: 'string', maxLength: 40, default: '', label: '行業' },
      letter: { type: 'string', maxLength: 1, default: '', label: '首字母' },
    },
  }),
  associationComponent({
    type: 'association.partners',
    name: { zh: '合作夥伴', en: 'Partners' },
    description: 'Logo 牆、卡片和輪播變體；統一視覺框。',
    settingsFields: {
      group: { type: 'string', maxLength: 40, default: '', label: '夥伴類別' },
      variant: { type: 'enum', values: ['logo-wall', 'cards', 'carousel'], default: 'logo-wall', label: '變體' },
    },
  }),
  associationComponent({
    type: 'association.timeline',
    name: { zh: '發展歷程', en: 'Timeline' },
    description: '年份、標題、說明、圖片和連結；支持順序和倒序。',
    settingsFields: {
      order: { type: 'enum', values: ['asc', 'desc'], default: 'asc', label: '排序' },
    },
  }),
  associationComponent({
    type: 'association.resources',
    name: { zh: '資源下載', en: 'Resources' },
    description: '文件、年份、類別、語言和說明；支持年份及類別篩選。',
    settingsFields: {
      year: { type: 'integer', min: 1000, max: 9999, label: '年份' },
      resourceCategory: { type: 'string', maxLength: 40, default: '', label: '類別' },
      lang: { type: 'enum', values: ['all', 'zh', 'en'], default: 'all', label: '語言' },
    },
  }),
  associationComponent({
    type: 'association.contact',
    name: { zh: '聯繫方式', en: 'Contact' },
    description: '敏感配置從站點設置引用，不在多個頁面重複維護。',
    settingsFields: {
      showMap: { type: 'boolean', default: true, label: '顯示地圖連結' },
      showSocial: { type: 'boolean', default: true, label: '顯示社交媒體' },
      showHours: { type: 'boolean', default: false, label: '顯示辦公時間' },
    },
  }),
];
