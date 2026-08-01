// General page content components (catalog §4.1-4.5).

const { linkField, optionalLinkField, optionalLinkRule, mediaRefField } = require('./shared');

function contentComponent({ type, name, description, contentFields, contentRules = [], settingsFields = {} }) {
  return {
    type,
    version: 1,
    category: 'content',
    name,
    description,
    allowedPageTypes: ['page'],
    isLayout: false,
    schema: {
      content: { fields: contentFields, rules: contentRules },
      settings: { fields: settingsFields },
    },
    migrations: {},
  };
}

module.exports = [
  contentComponent({
    type: 'content.hero',
    name: { zh: '主視覺', en: 'Hero' },
    description: '標題、副標題、背景媒體、主次按鈕和遮罩強度。',
    contentFields: {
      title: { type: 'string', maxLength: 120, required: true, label: '標題' },
      subtitle: { type: 'string', maxLength: 300, default: '', label: '副標題' },
      backgroundMediaId: mediaRefField('背景媒體'),
      primaryButton: { ...linkField, label: '主要按鈕' },
      secondaryButton: { ...optionalLinkField, label: '次要按鈕' },
    },
    contentRules: [optionalLinkRule('secondaryButton', '次要按鈕')],
    settingsFields: {
      variant: { type: 'enum', values: ['full', 'left', 'center', 'split', 'network-news'], default: 'full', label: '變體' },
      overlay: { type: 'integer', min: 0, max: 100, default: 40, label: '遮罩強度 %' },
    },
  }),
  contentComponent({
    type: 'content.image-text',
    name: { zh: '圖文區', en: 'Image + Text' },
    contentFields: {
      title: { type: 'string', maxLength: 120, required: true, label: '標題' },
      body: { type: 'string', maxLength: 5000, default: '', label: '正文' },
      mediaId: mediaRefField('媒體庫圖片'),
      externalMediaUrl: { type: 'string', maxLength: 500, default: '', label: '外部圖片地址' },
      button: { ...linkField, label: '按鈕' },
    },
    settingsFields: {
      mediaPosition: { type: 'enum', values: ['left', 'right'], default: 'left', label: '圖片位置' },
      variant: { type: 'enum', values: ['two-col', 'narrow', 'highlight'], default: 'two-col', label: '變體' },
    },
  }),
  contentComponent({
    type: 'content.cta',
    name: { zh: 'CTA', en: 'Call to Action' },
    description: '加入協會、聯繫和活動報名入口。',
    contentFields: {
      title: { type: 'string', maxLength: 120, required: true, label: '標題' },
      description: { type: 'string', maxLength: 300, default: '', label: '說明' },
      button: { ...linkField, required: true, label: '按鈕' },
    },
    settingsFields: {
      backgroundVariant: { type: 'enum', values: ['brand', 'dark', 'light'], default: 'brand', label: '背景變體' },
    },
  }),
  contentComponent({
    type: 'content.faq',
    name: { zh: 'FAQ', en: 'FAQ' },
    description: '問答數組；前台輸出 FAQ 結構化數據。',
    contentFields: {
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 30,
        required: true,
        label: '問答',
        item: {
          type: 'object',
          fields: {
            question: { type: 'string', maxLength: 200, required: true, label: '問題' },
            answer: { type: 'string', maxLength: 2000, required: true, label: '回答' },
          },
        },
      },
    },
  }),
  contentComponent({
    type: 'content.stats',
    name: { zh: '數據統計', en: 'Stats' },
    description: '2-6 個統計項；動畫只作漸進增強。',
    contentFields: {
      title: { type: 'string', maxLength: 120, default: '', label: '標題' },
      items: {
        type: 'array',
        minItems: 2,
        maxItems: 6,
        required: true,
        label: '統計項',
        item: {
          type: 'object',
          fields: {
            value: { type: 'string', maxLength: 20, required: true, label: '數值' },
            unit: { type: 'string', maxLength: 10, default: '', label: '單位' },
            label: { type: 'string', maxLength: 60, required: true, label: '標籤' },
            description: { type: 'string', maxLength: 120, default: '', label: '說明' },
          },
        },
      },
    },
    settingsFields: {
      variant: { type: 'enum', values: ['metrics', 'features'], default: 'metrics', label: '展示模式' },
    },
  }),
  contentComponent({
    type: 'content.membership-plans',
    name: { zh: '會員方案', en: 'Membership Plans' },
    description: '可編輯會籍名稱、年費、權益與申請表下載連結。',
    contentFields: {
      title: { type: 'string', maxLength: 120, required: true, label: '標題' },
      description: { type: 'string', maxLength: 500, default: '', label: '說明' },
      plans: {
        type: 'array', minItems: 1, maxItems: 12, required: true, label: '會員方案',
        item: {
          type: 'object',
          fields: {
            name: { type: 'string', maxLength: 80, required: true, label: '方案名稱' },
            price: { type: 'string', maxLength: 40, required: true, label: '年費' },
            benefits: { type: 'array', item: { type: 'string', maxLength: 160 }, default: [], label: '會員權益' },
            buttonLabel: { type: 'string', maxLength: 40, default: '下載登記表格', label: '按鈕文字' },
            buttonUrl: { type: 'string', maxLength: 500, default: '', label: '申請表連結' },
          },
        },
      },
    },
    settingsFields: {
      columns: { type: 'integer', min: 1, max: 4, default: 3, label: '每行方案數' },
    },
  }),
  contentComponent({
    type: 'content.contact-form',
    name: { zh: '留言表單', en: 'Contact Form' },
    description: '前台訪客留言會進入後台留言中心並觸發未讀紅點。',
    contentFields: {
      title: { type: 'string', maxLength: 120, required: true, label: '標題' },
      description: { type: 'string', maxLength: 300, default: '', label: '說明' },
      submitLabel: { type: 'string', maxLength: 40, default: '提交', label: '提交按鈕' },
    },
    settingsFields: {
      showSubject: { type: 'boolean', default: true, label: '顯示主旨欄位' },
    },
  }),
];
