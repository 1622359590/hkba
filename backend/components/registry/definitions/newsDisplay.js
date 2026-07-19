// News display components (catalog §2.1-2.6). Pages store query conditions,
// never copied article bodies (D7).

const { newsQueryFields, specificYearRule } = require('./shared');

function newsDisplay({ type, name, description, extraSettings = {}, contentFields = {}, allowedPageTypes = ['page'] }) {
  return {
    type,
    version: 1,
    category: 'news',
    name,
    description,
    allowedPageTypes,
    isLayout: false,
    schema: {
      content: {
        fields: {
          title: { type: 'string', maxLength: 120, default: '', label: '標題' },
          description: { type: 'string', maxLength: 300, default: '', label: '說明' },
          ...contentFields,
        },
      },
      settings: { fields: { ...newsQueryFields, ...extraSettings }, rules: [specificYearRule] },
    },
    migrations: {},
  };
}

module.exports = [
  newsDisplay({
    type: 'news.grid',
    name: { zh: '新聞卡片', en: 'News Grid' },
    description: '首頁、新聞欄目頁和專題頁的卡片網格。',
    extraSettings: {
      variant: { type: 'enum', values: ['two-col', 'three-col', 'four-col', 'first-large'], default: 'three-col', label: '變體' },
      imageRatio: { type: 'enum', values: ['16:9', '4:3', '1:1'], default: '16:9', label: '圖片比例' },
      showSummary: { type: 'boolean', default: true, label: '顯示摘要' },
      showDate: { type: 'boolean', default: true, label: '顯示日期' },
    },
  }),
  newsDisplay({
    type: 'news.list',
    name: { zh: '新聞列表', en: 'News List' },
    description: '新聞中心主列表和年度列表，支持前台篩選與分頁。',
    extraSettings: {
      variant: { type: 'enum', values: ['compact', 'thumb', 'timeline'], default: 'thumb', label: '變體' },
      pageSize: { type: 'integer', min: 5, max: 50, default: 10, label: '每頁數量' },
    },
  }),
  newsDisplay({
    type: 'news.featured',
    name: { zh: '焦點新聞', en: 'Featured News' },
    description: '一個主新聞加 2-4 個次要新聞。',
    extraSettings: {
      source: { type: 'enum', values: ['auto', 'pinned'], default: 'auto', label: '來源' },
      pinnedIds: { type: 'array', item: { type: 'string' }, default: [], label: '指定新聞' },
      secondaryCount: { type: 'integer', min: 2, max: 4, default: 3, label: '次要新聞數' },
      fallbackToLatest: { type: 'boolean', default: true, label: '指定新聞被撤回時回退到最新' },
    },
  }),
  newsDisplay({
    type: 'news.archive',
    name: { zh: '年度歸檔', en: 'News Archive' },
    description: '按年份列出新聞數量和條目，只顯示有已發佈新聞的年份。',
    extraSettings: {
      variant: { type: 'enum', values: ['collapsed', 'tags', 'timeline'], default: 'collapsed', label: '變體' },
    },
  }),
  newsDisplay({
    type: 'news.category-tabs',
    name: { zh: '分類標籤', en: 'Category Tabs' },
    description: '在組件內切換新聞欄目；最多 8 個一級標籤。',
    extraSettings: {
      maxTabs: { type: 'integer', min: 2, max: 8, default: 8, label: '標籤上限' },
    },
  }),
  newsDisplay({
    type: 'news.related',
    name: { zh: '相關新聞', en: 'Related News' },
    description: '只允許用於新聞詳情模板；按共同欄目和標籤計算。',
    allowedPageTypes: ['news'],
    extraSettings: {
      count: { type: 'integer', min: 2, max: 6, default: 3, label: '數量' },
      variant: { type: 'enum', values: ['card', 'list'], default: 'card', label: '變體' },
    },
  }),
];
