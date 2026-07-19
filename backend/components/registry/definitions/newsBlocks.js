// News body blocks (catalog §3.1-3.8) plus the shared media blocks reused by
// general pages (§4.6). media.* blocks allow both 'news' and 'page'.

const { linkField, mediaRefField } = require('./shared');

function newsBlock({ type, name, description, contentFields, settingsFields = {}, allowedPageTypes = ['news'] }) {
  return {
    type,
    version: 1,
    category: 'content',
    name,
    description,
    allowedPageTypes,
    isLayout: false,
    isNewsBlock: allowedPageTypes.includes('news'),
    schema: {
      content: { fields: contentFields },
      settings: { fields: settingsFields },
    },
    migrations: {},
  };
}

module.exports = [
  newsBlock({
    type: 'news.header',
    name: { zh: '標題區', en: 'News Header' },
    description: '每篇新聞只有一個標題區，不可刪除只能修改。',
    contentFields: {
      title: { type: 'string', maxLength: 200, required: true, label: '標題' },
      summary: { type: 'string', maxLength: 500, default: '', label: '摘要' },
      author: { type: 'string', maxLength: 80, default: '', label: '作者' },
      publishedAt: { type: 'string', maxLength: 40, default: '', label: '發佈日期' },
      displayYear: { type: 'integer', min: 1000, max: 9999, label: '顯示年份' },
      coverMediaId: mediaRefField('封面'),
    },
    settingsFields: {
      categoryIds: { type: 'array', item: { type: 'string' }, default: [], label: '欄目' },
      tagIds: { type: 'array', item: { type: 'string' }, default: [], label: '標籤' },
    },
  }),
  newsBlock({
    type: 'content.rich-text',
    name: { zh: '富文本', en: 'Rich Text' },
    description: '段落、二至四級標題、列表、連結、加粗和斜體；不允許腳本與任意 HTML。',
    contentFields: {
      html: { type: 'string', maxLength: 20000, required: true, label: '內容' },
    },
    allowedPageTypes: ['news', 'page'],
  }),
  newsBlock({
    type: 'media.image',
    name: { zh: '單圖', en: 'Image' },
    description: '內容圖片默認要求替代文字；裝飾圖片必須明確標記。',
    contentFields: {
      mediaId: mediaRefField('圖片', true),
      alt: { type: 'string', maxLength: 200, default: '', label: '替代文字' },
      caption: { type: 'string', maxLength: 300, default: '', label: '圖注' },
    },
    settingsFields: {
      widthVariant: { type: 'enum', values: ['content', 'wide', 'full'], default: 'content', label: '寬度變體' },
      align: { type: 'enum', values: ['left', 'center', 'right'], default: 'center', label: '對齊' },
      decorative: { type: 'boolean', default: false, label: '裝飾圖片（空替代文字）' },
    },
    allowedPageTypes: ['news', 'page'],
  }),
  newsBlock({
    type: 'media.gallery',
    name: { zh: '圖集', en: 'Gallery' },
    description: '2-20 張圖片，可拖動排序。',
    contentFields: {
      images: {
        type: 'array',
        minItems: 2,
        maxItems: 20,
        required: true,
        label: '圖片',
        item: {
          type: 'object',
          fields: {
            mediaId: mediaRefField('圖片', true),
            alt: { type: 'string', maxLength: 200, default: '', label: '替代文字' },
            caption: { type: 'string', maxLength: 300, default: '', label: '圖注' },
          },
        },
      },
    },
    settingsFields: {
      variant: { type: 'enum', values: ['grid', 'carousel', 'lightbox'], default: 'grid', label: '變體' },
    },
    allowedPageTypes: ['news', 'page'],
  }),
  newsBlock({
    type: 'media.video',
    name: { zh: '視頻', en: 'Video' },
    description: '受支持的視頻平台 URL 或媒體庫視頻；必須配置封面。',
    contentFields: {
      url: { type: 'string', maxLength: 500, default: '', label: '視頻 URL' },
      mediaId: mediaRefField('媒體庫視頻'),
      posterMediaId: mediaRefField('封面', true),
      captionsUrl: { type: 'string', maxLength: 500, default: '', label: '字幕文件' },
    },
    allowedPageTypes: ['news', 'page'],
  }),
  newsBlock({
    type: 'content.quote',
    name: { zh: '引用', en: 'Quote' },
    contentFields: {
      text: { type: 'string', maxLength: 1000, required: true, label: '引用正文' },
      sourceName: { type: 'string', maxLength: 80, default: '', label: '來源姓名' },
      sourceTitle: { type: 'string', maxLength: 120, default: '', label: '職務' },
      avatarMediaId: mediaRefField('頭像'),
    },
    allowedPageTypes: ['news', 'page'],
  }),
  newsBlock({
    type: 'content.downloads',
    name: { zh: '附件下載', en: 'Downloads' },
    contentFields: {
      files: {
        type: 'array',
        minItems: 1,
        maxItems: 20,
        required: true,
        label: '文件',
        item: {
          type: 'object',
          fields: {
            mediaId: mediaRefField('文件', true),
            label: { type: 'string', maxLength: 120, required: true, label: '顯示名稱' },
            description: { type: 'string', maxLength: 300, default: '', label: '說明' },
          },
        },
      },
    },
  }),
  newsBlock({
    type: 'content.links',
    name: { zh: '相關連結', en: 'Related Links' },
    description: '站內頁面或經驗證的外部 URL；外部連結明確標識。',
    contentFields: {
      links: {
        type: 'array',
        minItems: 1,
        maxItems: 12,
        required: true,
        label: '連結',
        item: {
          type: 'object',
          fields: {
            label: linkField.fields.label,
            url: linkField.fields.url,
            external: { type: 'boolean', default: false, label: '外部連結' },
          },
        },
      },
    },
    allowedPageTypes: ['news', 'page'],
  }),
];
