// Publish gate checks (spec: data-api §9).
//
// Both checkers return structured problem arrays —
// { objectId, blockId?, lang?, field, code, hint } — so the admin UI can jump
// straight to the fix. Draft saves are lenient (Chinese-first allowed);
// publishing is strict: every check here must pass before the publish
// transaction starts (422 PUBLISH_CHECK_FAILED otherwise).

const registry = require('../components/registry');
const { validateBlockTree, validateNewsBlocks } = require('./blockTree');
const { isValidDisplayYear } = require('./newsYear');
const { extractMediaIds } = require('./mediaReferences');

function problem(objectId, field, code, hint, extra = {}) {
  return { objectId, field, code, hint, ...extra };
}

// Collects media IDs referenced by one page block's config (all scopes).
function blockMediaIds(definition, block) {
  const config = {
    contentZh: JSON.parse(block.content_zh || '{}'),
    contentEn: JSON.parse(block.content_en || '{}'),
    settings: JSON.parse(block.settings || '{}'),
  };
  // Reuse the registry-marked extraction (media: true fields).
  return { ids: extractMediaIds(definition, config), config };
}

// Internal link targets (leading '/') must resolve to a published page path
// or a recorded redirect.
function checkInternalLinks(conn, objectId, blockId, value, field) {
  const problems = [];
  if (typeof value !== 'string' || !value.startsWith('/')) return problems;
  const target = value.split('#')[0].split('?')[0];
  if (!target || target.startsWith('/api/') || target.startsWith('/uploads/')) return problems;
  const published = conn
    .prepare('SELECT 1 FROM page_nodes WHERE path = ? AND deleted_at IS NULL AND published_version_id IS NOT NULL')
    .get(target);
  const redirected = conn.prepare('SELECT 1 FROM redirects WHERE from_path = ?').get(target);
  if (!published && !redirected) {
    problems.push(
      problem(objectId, field, 'link_unresolved', `內部連結 ${target} 沒有對應的已發佈頁面`, { blockId })
    );
  }
  return problems;
}

function walkLinkFields(fields, config, fn, path = '') {
  if (!fields || config == null || typeof config !== 'object') return;
  for (const [name, spec] of Object.entries(fields)) {
    const value = config[name];
    if (value == null) continue;
    const here = path ? `${path}.${name}` : name;
    if (name === 'url' && spec.type === 'string') fn(value, here);
    if (spec.type === 'object' && spec.fields) walkLinkFields(spec.fields, value, fn, here);
    if (spec.type === 'array' && spec.item && Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (spec.item.type === 'object' && spec.item.fields) {
          walkLinkFields(spec.item.fields, entry, fn, `${here}[${index}]`);
        }
      });
    }
  }
}

// ---------- page ----------

// checkPage(conn, node, version, blocks) — spec §9 page list.
function checkPage(conn, node, version, blocks) {
  const problems = [];
  const objectId = node.id;

  // Path unique among live nodes; hierarchy intact (depth <= 3).
  const pathClash = conn
    .prepare('SELECT id FROM page_nodes WHERE path = ? AND id != ? AND deleted_at IS NULL')
    .get(node.path, node.id);
  if (pathClash) {
    problems.push(problem(objectId, 'path', 'path_conflict', `路徑 ${node.path} 與其他頁面衝突`));
  }
  let depth = 0;
  let parent = node.parent_id ? conn.prepare('SELECT * FROM page_nodes WHERE id = ?').get(node.parent_id) : null;
  while (parent) {
    depth += 1;
    if (parent.deleted_at) {
      problems.push(problem(objectId, 'parentId', 'parent_deleted', '上級欄目仍在回收站', { lang: null }));
      break;
    }
    parent = parent.parent_id ? conn.prepare('SELECT * FROM page_nodes WHERE id = ?').get(parent.parent_id) : null;
  }
  if (depth > 2) {
    problems.push(problem(objectId, 'parentId', 'depth', '欄目層級超過三級'));
  }

  // Block tree rules (nesting, layout parents).
  const tree = validateBlockTree(
    blocks.map((block) => ({ id: block.id, component_type: block.component_type, parent_block_id: block.parent_block_id }))
  );
  for (const error of tree.errors) {
    problems.push(problem(objectId, 'parentBlockId', error.code, error.message, { blockId: error.blockId }));
  }

  const mediaState = new Map();
  const mediaStatus = (id) => {
    if (!mediaState.has(id)) {
      mediaState.set(id, conn.prepare('SELECT status FROM media_assets WHERE id = ?').get(id) || null);
    }
    return mediaState.get(id);
  };

  for (const block of blocks) {
    const definition = registry.getDefinition(block.component_type);
    if (!definition) {
      problems.push(
        problem(objectId, 'componentType', 'unsupported_type', `組件 ${block.component_type} 未註冊`, { blockId: block.id })
      );
      continue;
    }
    if (block.component_version > definition.version) {
      problems.push(
        problem(objectId, 'componentVersion', 'unsupported_version',
          `組件 ${block.component_type} 版本 ${block.component_version} 高於註冊版本 ${definition.version}`,
          { blockId: block.id })
      );
    }
    const { ids, config } = blockMediaIds(definition, block);

    // Full bilingual validation — publishing requires English completeness.
    const contract = registry.validateBlockConfig(block.component_type, config);
    for (const error of contract.errors) {
      const lang = error.field.startsWith('contentEn') ? 'en' : error.field.startsWith('contentZh') ? 'zh' : null;
      problems.push(problem(objectId, error.field, error.code, error.message, { blockId: block.id, lang }));
    }

    // Referenced media must exist and be publicly usable (status active).
    for (const mediaId of ids) {
      const state = mediaStatus(mediaId);
      if (!state) {
        problems.push(problem(objectId, 'mediaId', 'media_missing', `媒體 ${mediaId} 不存在`, { blockId: block.id }));
      } else if (state.status !== 'active') {
        problems.push(
          problem(objectId, 'mediaId', 'media_unavailable', `媒體 ${mediaId} 狀態為 ${state.status}`, { blockId: block.id })
        );
      }
    }

    // Internal links resolve.
    for (const scope of ['content', 'settings']) {
      const fields = definition.schema[scope]?.fields;
      const configScope = scope === 'content' ? config.contentZh : config.settings;
      walkLinkFields(fields, configScope, (value, field) => {
        problems.push(...checkInternalLinks(conn, objectId, block.id, value, field));
      });
      if (scope === 'content') {
        walkLinkFields(fields, config.contentEn, (value, field) => {
          problems.push(...checkInternalLinks(conn, objectId, block.id, value, `en:${field}`));
        });
      }
    }
  }

  // SEO completeness for publishable pages (sections are navigation-only).
  if (node.node_type === 'page') {
    const seo = JSON.parse(version.seo || '{}');
    if (!(seo.titleZh || seo.title)) {
      problems.push(problem(objectId, 'seo.title', 'seo_incomplete', '缺少 SEO 標題', { lang: 'zh' }));
    }
    if (!(seo.descriptionZh || seo.description)) {
      problems.push(problem(objectId, 'seo.description', 'seo_incomplete', '缺少 SEO 描述', { lang: 'zh' }));
    }
    const share = seo.shareMediaId || seo.ogImage;
    if (!share) {
      problems.push(problem(objectId, 'seo.shareImage', 'seo_incomplete', '缺少社交分享圖片'));
    } else {
      const state = mediaStatus(share);
      if (!state) problems.push(problem(objectId, 'seo.shareImage', 'media_missing', '分享圖片媒體不存在'));
      else if (state.status !== 'active') {
        problems.push(problem(objectId, 'seo.shareImage', 'media_unavailable', `分享圖片狀態為 ${state.status}`));
      }
    }
  }

  return problems;
}

// ---------- news ----------

// checkNews(conn, news, draftRevisionRow, blocks) — spec §9 news list.
function checkNews(conn, news, revisionRow, blocks) {
  const problems = [];
  const objectId = news.id;

  if (!news.title_zh) problems.push(problem(objectId, 'titleZh', 'required', '缺少中文標題', { lang: 'zh' }));
  if (!news.title_en) problems.push(problem(objectId, 'titleEn', 'required', '缺少英文標題', { lang: 'en' }));
  if (!news.summary_zh) problems.push(problem(objectId, 'summaryZh', 'required', '缺少中文摘要', { lang: 'zh' }));
  if (!news.summary_en) problems.push(problem(objectId, 'summaryEn', 'required', '缺少英文摘要', { lang: 'en' }));

  const categoryCount = conn
    .prepare('SELECT COUNT(*) AS n FROM news_category_map WHERE news_id = ?')
    .get(news.id).n;
  if (categoryCount === 0) {
    problems.push(problem(objectId, 'categoryIds', 'required', '至少選擇一個欄目'));
  }

  if (news.display_year != null && !isValidDisplayYear(news.display_year)) {
    problems.push(problem(objectId, 'displayYear', 'range', 'displayYear 必須是四位年份'));
  }

  const slugClash = conn.prepare('SELECT id FROM news_items WHERE slug = ? AND id != ?').get(news.slug, news.id);
  if (slugClash) problems.push(problem(objectId, 'slug', 'duplicate', 'slug 已被使用'));

  if (news.cover_media_id) {
    const cover = conn.prepare('SELECT status FROM media_assets WHERE id = ?').get(news.cover_media_id);
    if (!cover) problems.push(problem(objectId, 'coverMediaId', 'media_missing', '封面媒體不存在'));
    else if (cover.status !== 'active') {
      problems.push(problem(objectId, 'coverMediaId', 'media_unavailable', `封面媒體狀態為 ${cover.status}`));
    }
  }

  // Body: header rules + full bilingual config validation + media validity.
  const tree = validateNewsBlocks(blocks);
  for (const error of tree.errors) {
    problems.push(problem(objectId, 'blocks', error.code, error.message, { blockId: error.blockId }));
  }
  for (const block of blocks) {
    const definition = registry.getDefinition(block.block_type);
    if (!definition) {
      problems.push(
        problem(objectId, 'blockType', 'unsupported_type', `組件 ${block.block_type} 未註冊`, { blockId: block.id })
      );
      continue;
    }
    const { ids, config } = blockMediaIds(definition, block);
    const contract = registry.validateBlockConfig(block.block_type, config);
    for (const error of contract.errors) {
      const lang = error.field.startsWith('contentEn') ? 'en' : error.field.startsWith('contentZh') ? 'zh' : null;
      problems.push(problem(objectId, error.field, error.code, error.message, { blockId: block.id, lang }));
    }
    for (const mediaId of ids) {
      const state = conn.prepare('SELECT status FROM media_assets WHERE id = ?').get(mediaId);
      if (!state) {
        problems.push(problem(objectId, 'mediaId', 'media_missing', `媒體 ${mediaId} 不存在`, { blockId: block.id }));
      } else if (state.status !== 'active') {
        problems.push(
          problem(objectId, 'mediaId', 'media_unavailable', `媒體 ${mediaId} 狀態為 ${state.status}`, { blockId: block.id })
        );
      }
    }
  }

  return problems;
}

module.exports = { checkPage, checkNews };
