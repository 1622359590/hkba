// Pure helpers for the page tree (spec: data-api §2.1).
//
// SQLite DDL enforces path uniqueness and per-parent slug uniqueness; these
// functions cover the rules DDL cannot express: cycle prevention and the
// maximum depth of 3. All functions are pure and operate on plain rows of
// shape { id, parent_id } so they can be unit-tested without a database.

const DEFAULT_MAX_DEPTH = 3;

// Joins a parent path and a slug into the canonical site path.
// joinPath('', 'about') -> '/about'; joinPath('/news', '2026') -> '/news/2026'
function joinPath(parentPath, slug) {
  const cleanSlug = String(slug || '').replace(/^\/+|\/+$/g, '');
  const cleanParent = String(parentPath || '').replace(/\/+$/g, '');
  if (!cleanParent) return `/${cleanSlug}`;
  return `${cleanParent}/${cleanSlug}`;
}

function buildParentMap(nodes) {
  const map = new Map();
  for (const node of nodes) {
    map.set(node.id, node.parent_id || null);
  }
  return map;
}

// Walks the parent chain of startId. Returns the ordered ancestor ids
// (starting with startId itself). Stops defensively on malformed cycles.
function ancestorChain(parentMap, startId) {
  const chain = [];
  const seen = new Set();
  let current = startId;
  while (current != null && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = parentMap.get(current) ?? null;
  }
  return chain;
}

// 1-based depth of a node: a root node has depth 1.
function depthOf(nodes, nodeId) {
  const parentMap = buildParentMap(nodes);
  if (!parentMap.has(nodeId)) return 0;
  return ancestorChain(parentMap, nodeId).length;
}

// Longest downward chain below nodeId, including nodeId itself.
// A leaf has height 1.
function subtreeHeight(nodes, nodeId) {
  const children = new Map();
  for (const node of nodes) {
    const parent = node.parent_id || null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(node.id);
  }
  const visit = (id, seen) => {
    if (seen.has(id)) return 0; // defensive against malformed cycles
    const nextSeen = new Set(seen).add(id);
    let best = 0;
    for (const child of children.get(id) || []) {
      best = Math.max(best, visit(child, nextSeen));
    }
    return best + 1;
  };
  return visit(nodeId, new Set());
}

// True when assigning newParentId as the parent of nodeId would make the node
// its own ancestor (spec: a node must never become its own descendant).
function wouldCreateCycle(nodes, nodeId, newParentId) {
  if (newParentId == null) return false;
  if (newParentId === nodeId) return true;
  const parentMap = buildParentMap(nodes);
  return ancestorChain(parentMap, newParentId).includes(nodeId);
}

// Validates moving nodeId under newParentId (null = root).
// Returns { ok: true } or { ok: false, reason } where reason is one of
// 'self' | 'missing_node' | 'missing_parent' | 'cycle' | 'depth'.
function validateMove(nodes, nodeId, newParentId, options = {}) {
  const maxDepth = options.maxDepth || DEFAULT_MAX_DEPTH;
  const ids = new Set(nodes.map((node) => node.id));
  if (newParentId === nodeId) return { ok: false, reason: 'self' };
  if (!ids.has(nodeId)) return { ok: false, reason: 'missing_node' };
  if (newParentId != null && !ids.has(newParentId)) {
    return { ok: false, reason: 'missing_parent' };
  }
  if (wouldCreateCycle(nodes, nodeId, newParentId)) {
    return { ok: false, reason: 'cycle' };
  }
  const parentDepth = newParentId == null ? 0 : depthOf(nodes, newParentId);
  if (parentDepth + subtreeHeight(nodes, nodeId) > maxDepth) {
    return { ok: false, reason: 'depth' };
  }
  return { ok: true };
}

// Validates creating a new node under parentId (null = root).
// Returns { ok: true } or { ok: false, reason: 'missing_parent' | 'depth' }.
function validateNewNode(nodes, parentId, options = {}) {
  const maxDepth = options.maxDepth || DEFAULT_MAX_DEPTH;
  if (parentId == null) {
    return maxDepth >= 1 ? { ok: true } : { ok: false, reason: 'depth' };
  }
  const ids = new Set(nodes.map((node) => node.id));
  if (!ids.has(parentId)) return { ok: false, reason: 'missing_parent' };
  if (depthOf(nodes, parentId) + 1 > maxDepth) return { ok: false, reason: 'depth' };
  return { ok: true };
}

module.exports = {
  DEFAULT_MAX_DEPTH,
  joinPath,
  buildParentMap,
  depthOf,
  subtreeHeight,
  wouldCreateCycle,
  validateMove,
  validateNewNode,
};
