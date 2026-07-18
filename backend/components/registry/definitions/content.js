// General page content components (catalog §4.1-4.5).

const { linkField, mediaRefField } = require('./shared');

function contentComponent({ type, name, description, contentFields, settingsFields = {} }) {
  return {
    type,
    version: 1,
    category: 'content',
    name,
    description,
    allowedPageTypes: ['page'],
    isLayout: false,
    schema: {
      content: { fields: contentFields },
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
      secondaryButton: { ...linkField, label: '次要按鈕' },
    },
    settingsFields: {
      variant: { type: 'enum', values: ['full', 'left', 'center', 'split'], default: 'full', label: '變體' },
      overlay: { type: 'integer', min: 0, max: 100, default: 40, label: '遮罩強度 %' },
    },
  }),
  contentComponent({
    type: 'content.image-text',
    name: { zh: '圖文區', en: 'Image + Text' },
    contentFields: {
      title: { type: 'string', maxLength: 120, required: true, label: '標題' },
      body: { type: 'string', maxLength: 5000, default: '', label: '正文' },
      mediaId: mediaRefField('圖片', true),
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
  }),
];
