// Block-tree validation (spec: component-catalog §6, §3.1; data-api §2.3).
//
// Layout components may nest at most two levels, and only layout components
// may act as parents. News bodies must contain exactly one `news.header`
// block. DDL adds foreign keys and the single-header partial unique index;
// these pure functions give the API precise, field-level error output.

const LAYOUT_PREFIX = 'layout.';
const NEWS_HEADER_TYPE = 'news.header';
const DEFAULT_MAX_NESTING = 2;

function isLayoutType(componentType) {
  return typeof componentType === 'string' && componentType.startsWith(LAYOUT_PREFIX);
}

// Validates one page version's blocks.
// Blocks: [{ id, component_type, parent_block_id }].
// Returns { ok, errors } where errors are
// { blockId, code: 'missing_parent' | 'cycle' | 'non_layout_parent' | 'nesting', message }.
function validateBlockTree(blocks, options = {}) {
  const maxNesting = options.maxNesting || DEFAULT_MAX_NESTING;
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const errors = [];

  const nestingDepth = (block) => {
    // Number of parent links above this block, with cycle protection.
    let depth = 0;
    const seen = new Set([block.id]);
    let current = block;
    while (current.parent_block_id != null) {
      const parent = byId.get(current.parent_block_id);
      if (!parent || seen.has(parent.id)) return { depth, broken: true };
      seen.add(parent.id);
      depth += 1;
      current = parent;
    }
    return { depth, broken: false };
  };

  for (const block of blocks) {
    if (block.parent_block_id == null) continue;
    const parent = byId.get(block.parent_block_id);
    if (!parent) {
      errors.push({
        blockId: block.id,
        code: 'missing_parent',
        message: `父组件 ${block.parent_block_id} 不存在于当前版本`,
      });
      continue;
    }
    if (parent.id === block.id) {
      errors.push({ blockId: block.id, code: 'cycle', message: '组件不能嵌套自身' });
      continue;
    }
    if (!isLayoutType(parent.component_type)) {
      errors.push({
        blockId: block.id,
        code: 'non_layout_parent',
        message: `只有布局组件可以容纳子组件（${parent.component_type} 不是布局组件）`,
      });
    }
    const { depth, broken } = nestingDepth(block);
    if (broken) {
      errors.push({ blockId: block.id, code: 'cycle', message: '组件嵌套存在循环' });
    } else if (depth > maxNesting) {
      errors.push({
        blockId: block.id,
        code: 'nesting',
        message: `布局组件最多嵌套 ${maxNesting} 层`,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

// Validates one news revision's blocks: exactly one header, and the header
// must be first (spec: header cannot be deleted, only edited).
// Returns { ok, errors } with code 'missing_header' | 'duplicate_header' | 'header_position'.
function validateNewsBlocks(blocks) {
  const errors = [];
  const headers = blocks.filter((block) => block.block_type === NEWS_HEADER_TYPE);
  if (headers.length === 0) {
    errors.push({ blockId: null, code: 'missing_header', message: '每篇新闻必须有一个标题区' });
  }
  if (headers.length > 1) {
    errors.push({
      blockId: headers[1].id,
      code: 'duplicate_header',
      message: '每篇新闻只允许一个标题区',
    });
  }
  if (headers.length === 1) {
    const top = [...blocks].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0];
    if (top && top.block_type !== NEWS_HEADER_TYPE) {
      errors.push({
        blockId: headers[0].id,
        code: 'header_position',
        message: '标题区必须位于正文最前',
      });
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  LAYOUT_PREFIX,
  NEWS_HEADER_TYPE,
  DEFAULT_MAX_NESTING,
  isLayoutType,
  validateBlockTree,
  validateNewsBlocks,
};
