// Shared field maps for the component registry (catalog §2).

// Every news display component shares these query settings. `year` is
// required only when yearMode is `specific` (cross-field rule below).
const newsQueryFields = {
  yearMode: { type: 'enum', values: ['latest', 'specific', 'all', 'visitor-select'], required: true, default: 'latest', label: '年份模式' },
  year: { type: 'integer', min: 1000, max: 9999, label: '指定年份' },
  categoryIds: { type: 'array', item: { type: 'string' }, default: [], label: '新聞欄目' },
  tagIds: { type: 'array', item: { type: 'string' }, default: [], label: '標籤' },
  limit: { type: 'integer', min: 1, max: 24, default: 6, label: '數量' },
  sort: { type: 'enum', values: ['newest', 'oldest', 'manual-featured'], default: 'newest', label: '排序' },
  showYearFilter: { type: 'boolean', default: false, label: '顯示年份篩選' },
  showMoreLink: { type: 'boolean', default: false, label: '顯示更多連結' },
  moreLinkTarget: { type: 'string', maxLength: 500, default: '', label: '更多連結目標' },
};

const specificYearRule = (config) => {
  if (config.yearMode === 'specific' && !Number.isInteger(config.year)) {
    return { field: 'year', code: 'required', message: '年份模式為「指定」時必須填寫四位年份' };
  }
  return null;
};

const linkField = {
  type: 'object',
  fields: {
    label: { type: 'string', maxLength: 80, required: true, label: '按鈕文字' },
    url: { type: 'string', maxLength: 500, required: true, label: '連結' },
  },
};

const mediaRefField = (label, required = false) => ({ type: 'string', maxLength: 64, required, label });

module.exports = { newsQueryFields, specificYearRule, linkField, mediaRefField };
