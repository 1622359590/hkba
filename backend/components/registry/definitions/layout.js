// Layout components (catalog §6). Only layout components may contain child
// blocks, and nesting is capped at two levels (enforced by lib/blockTree.js).

function layoutComponent({ type, name, description, settingsFields = {} }) {
  return {
    type,
    version: 1,
    category: 'layout',
    name,
    description,
    allowedPageTypes: ['page'],
    isLayout: true,
    schema: {
      content: { fields: {} },
      settings: { fields: settingsFields },
    },
    migrations: {},
  };
}

module.exports = [
  layoutComponent({
    type: 'layout.section',
    name: { zh: '區段', en: 'Section' },
    description: '頁面區段，控制允許的寬度和背景變體。',
    settingsFields: {
      widthVariant: { type: 'enum', values: ['narrow', 'normal', 'wide', 'full'], default: 'normal', label: '寬度' },
      backgroundVariant: { type: 'enum', values: ['none', 'surface', 'brand', 'dark'], default: 'none', label: '背景' },
    },
  }),
  layoutComponent({
    type: 'layout.columns',
    name: { zh: '分欄', en: 'Columns' },
    description: '一至三欄；移動端固定堆疊。',
    settingsFields: {
      columns: { type: 'integer', min: 1, max: 3, default: 2, label: '欄數' },
      gap: { type: 'enum', values: ['small', 'medium', 'large'], default: 'medium', label: '間距' },
    },
  }),
  layoutComponent({
    type: 'layout.grid',
    name: { zh: '卡片網格', en: 'Grid' },
    description: '二至四列卡片網格。',
    settingsFields: {
      columns: { type: 'integer', min: 2, max: 4, default: 3, label: '列數' },
    },
  }),
  layoutComponent({
    type: 'layout.tabs',
    name: { zh: '標籤頁', en: 'Tabs' },
    description: '2-8 個標籤，不允許嵌套標籤頁。',
    settingsFields: {
      tabs: {
        type: 'array',
        minItems: 2,
        maxItems: 8,
        required: true,
        label: '標籤',
        item: {
          type: 'object',
          fields: {
            label: { type: 'string', maxLength: 40, required: true, label: '標籤名' },
          },
        },
      },
    },
  }),
  layoutComponent({
    type: 'layout.accordion',
    name: { zh: '折疊內容', en: 'Accordion' },
    description: '可訪問的折疊內容。',
    settingsFields: {
      allowMultiple: { type: 'boolean', default: false, label: '允許同時展開多項' },
    },
  }),
];
