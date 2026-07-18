'use client';
// Page studio (ui-interaction-system §4/§5): the M7c block editor.
//
// Layout: top bar (page title, save status, width + language switches,
// preview/publish) flanked by two icon rails; the shared BlockRenderer paints
// the draft on the central canvas. Side content opens as overlay drawers —
// page tree, block outline (with reorder), component library, media picker
// on the left; properties, SEO, history and publish checks on the right.
//
// Persistence: content edits debounce 800ms into per-block PATCHes; structure
// operations (add/delete/reorder/duplicate) save immediately. Every mutation
// carries expectedRevision + mutationId and runs on one serialized queue so
// optimistic UI never overtakes the server revision. A 409 marks the save
// state conflicted and offers a reload.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminGetData, adminPostData, adminPatchData, adminDeleteData, adminRequestError } from '@/lib/adminApi';
import BlockRenderer, { RenderBlock, MediaMap } from '@/components/blocks/BlockRenderer';
import Drawer from '@/components/admin/shell/Drawer';
import SaveStatus, { SaveState } from '@/components/admin/shell/SaveStatus';
import { ConfirmBar, UndoToast } from '@/components/admin/shell/ConfirmBar';
import PropertyForm, { Definition } from './PropertyForm';

type TreeNode = {
  id: string;
  parent_id: string | null;
  node_type: 'page' | 'section';
  slug: string;
  path: string;
  title_zh: string;
  title_en: string;
  navigation_status: string;
  has_draft: boolean;
  is_published: boolean;
  missing_en: boolean;
  children: TreeNode[];
};

type MediaItem = {
  id: string;
  url: string;
  kind: 'image' | 'pdf';
  altZh: string | null;
  altEn: string | null;
  originalFilename: string;
};

type DraftVersion = { id: string; revision: number; status: string; seo?: string };

type CheckProblem = { field?: string; code?: string; message?: string; blockId?: string };

type LeftPane = 'tree' | 'outline' | 'library' | null;
type RightPane = 'props' | 'seo' | 'history' | 'check' | null;

type SeoForm = { titleZh: string; titleEn: string; descriptionZh: string; descriptionEn: string; shareMediaId: string };

const EMPTY_SEO: SeoForm = { titleZh: '', titleEn: '', descriptionZh: '', descriptionEn: '', shareMediaId: '' };

function firstPage(nodes: TreeNode[]): TreeNode | null {
  for (const node of nodes) {
    if (node.node_type === 'page') return node;
    const child = firstPage(node.children || []);
    if (child) return child;
  }
  return null;
}

function flattenPages(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenPages(node.children || [])]);
}

function StudioInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageId = searchParams.get('id');

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [version, setVersion] = useState<DraftVersion | null>(null);
  const [blocks, setBlocks] = useState<RenderBlock[]>([]);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [canvasWidth, setCanvasWidth] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [leftPane, setLeftPane] = useState<LeftPane>(null);
  const [rightPane, setRightPane] = useState<RightPane>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaApply, setMediaApply] = useState<((id: string | null) => void) | null>(null);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [seoForm, setSeoForm] = useState<SeoForm>(EMPTY_SEO);
  const [checkProblems, setCheckProblems] = useState<CheckProblem[]>([]);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [undoBlock, setUndoBlock] = useState<RenderBlock | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null);

  const revisionRef = useRef(0);
  const blocksRef = useRef<RenderBlock[]>([]);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const dragIdRef = useRef<string | null>(null);
  blocksRef.current = blocks;

  // ---------- data loading ----------

  const loadTree = useCallback(async () => {
    try {
      const data = await adminGetData<{ tree: TreeNode[] }>('/api/admin/pages/tree');
      setTree(data.tree);
    } catch (error) {
      setBanner(adminRequestError(error));
    }
  }, []);

  const loadDraft = useCallback(async (id: string) => {
    setLoadingDraft(true);
    setBanner(null);
    try {
      const data = await adminGetData<{ version: DraftVersion; blocks: RenderBlock[] }>(`/api/admin/pages/${id}/draft`);
      setVersion(data.version);
      setBlocks(data.blocks);
      revisionRef.current = data.version.revision;
      let seo: Partial<SeoForm> = {};
      try {
        seo = data.version.seo ? JSON.parse(data.version.seo) : {};
      } catch {
        seo = {};
      }
      setSeoForm({ ...EMPTY_SEO, ...seo });
      setSelectedId(null);
      setSaveState('idle');
    } catch (error) {
      setBanner(adminRequestError(error));
    } finally {
      setLoadingDraft(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
    adminGetData<{ definitions: Definition[] }>('/api/admin/components/definitions')
      .then((data) => setDefinitions(data.definitions))
      .catch(() => setDefinitions([]));
    adminGetData<{ items: MediaItem[] }>('/api/admin/media?pageSize=100')
      .then((data) => setMediaItems(data.items))
      .catch(() => setMediaItems([]));
  }, [loadTree]);

  useEffect(() => {
    if (pageId) {
      loadDraft(pageId);
    } else if (tree.length) {
      const candidate = firstPage(tree);
      if (candidate) router.replace(`/admin/studio?id=${candidate.id}`);
    }
  }, [pageId, tree, loadDraft, router]);

  const mediaMap = useMemo<MediaMap>(() => {
    const map: MediaMap = {};
    for (const item of mediaItems) map[item.id] = { url: item.url, altZh: item.altZh || undefined, altEn: item.altEn || undefined };
    return map;
  }, [mediaItems]);

  const currentNode = useMemo(() => flattenPages(tree).find((node) => node.id === pageId) || null, [tree, pageId]);
  const selectedBlock = useMemo(() => blocks.find((block) => block.id === selectedId) || null, [blocks, selectedId]);
  const selectedDefinition = useMemo(
    () => (selectedBlock ? definitions.find((definition) => definition.type === selectedBlock.component_type) || null : null),
    [definitions, selectedBlock]
  );

  // ---------- serialized mutation queue ----------

  const enqueue = useCallback((task: () => Promise<void>) => {
    chainRef.current = chainRef.current.then(task).catch((error) => {
      const message = adminRequestError(error);
      if (message.includes('衝突') || message.includes('REVISION_CONFLICT') || message.includes('已被其他編輯')) {
        setSaveState('conflict');
      } else {
        setBanner(message);
        setSaveState('error');
      }
    });
  }, []);

  const saveBlockNow = useCallback(
    (blockId: string) => {
      if (!pageId) return;
      enqueue(async () => {
        const block = blocksRef.current.find((entry) => entry.id === blockId);
        if (!block) return;
        const response = await adminPatchData<{ revision: number }>(`/api/admin/pages/${pageId}/draft/blocks/${blockId}`, {
          expectedRevision: revisionRef.current,
          mutationId: crypto.randomUUID(),
          patch: { contentZh: block.contentZh, contentEn: block.contentEn, settings: block.settings },
        });
        revisionRef.current = response.revision;
        setSaveState('saved');
        setSavedAt(new Date());
      });
    },
    [enqueue, pageId]
  );

  const scheduleBlockSave = useCallback(
    (blockId: string) => {
      setSaveState('saving');
      const existing = timersRef.current.get(blockId);
      if (existing) clearTimeout(existing);
      timersRef.current.set(
        blockId,
        setTimeout(() => {
          timersRef.current.delete(blockId);
          saveBlockNow(blockId);
        }, 800)
      );
    },
    [saveBlockNow]
  );

  const editBlock = useCallback(
    (blockId: string, scope: 'contentZh' | 'contentEn' | 'settings', key: string, value: unknown) => {
      setBlocks((previous) => previous.map((block) => (block.id === blockId ? { ...block, [scope]: { ...(block[scope] as Record<string, unknown>), [key]: value } } : block)));
      scheduleBlockSave(blockId);
    },
    [scheduleBlockSave]
  );

  // ---------- structure operations (immediate save) ----------

  const addBlock = useCallback(
    (componentType: string, snapshot?: Partial<RenderBlock>) => {
      if (!pageId) return;
      const parentBlockId = snapshot?.parent_block_id !== undefined ? snapshot.parent_block_id : null;
      setSaveState('saving');
      enqueue(async () => {
        const response = await adminPostData<{ block: RenderBlock; revision: number }>(`/api/admin/pages/${pageId}/draft/blocks`, {
          expectedRevision: revisionRef.current,
          mutationId: crypto.randomUUID(),
          block: {
            componentType,
            parentBlockId: parentBlockId || null,
            ...(snapshot
              ? { contentZh: snapshot.contentZh, contentEn: snapshot.contentEn, settings: snapshot.settings }
              : {}),
          },
        });
        revisionRef.current = response.revision;
        setBlocks((previous) => [...previous, response.block]);
        setSelectedId(response.block.id);
        setSaveState('saved');
        setSavedAt(new Date());
      });
    },
    [enqueue, pageId]
  );

  const deleteBlock = useCallback(
    (blockId: string) => {
      if (!pageId) return;
      const snapshot = blocksRef.current.find((entry) => entry.id === blockId);
      setSaveState('saving');
      enqueue(async () => {
        const query = `expectedRevision=${revisionRef.current}&mutationId=${crypto.randomUUID()}`;
        const response = await adminDeleteData<{ revision: number }>(`/api/admin/pages/${pageId}/draft/blocks/${blockId}?${query}`);
        revisionRef.current = response.revision;
        setBlocks((previous) => previous.filter((entry) => entry.id !== blockId));
        if (selectedId === blockId) setSelectedId(null);
        if (snapshot) setUndoBlock(snapshot);
        setSaveState('saved');
        setSavedAt(new Date());
      });
    },
    [enqueue, pageId, selectedId]
  );

  const reorderAll = useCallback(
    (orderedIds: string[]) => {
      if (!pageId) return;
      setSaveState('saving');
      enqueue(async () => {
        const response = await adminPostData<{ blocks: RenderBlock[]; revision: number }>(`/api/admin/pages/${pageId}/draft/blocks/reorder`, {
          expectedRevision: revisionRef.current,
          mutationId: crypto.randomUUID(),
          order: orderedIds,
        });
        revisionRef.current = response.revision;
        setBlocks(response.blocks);
        setSaveState('saved');
        setSavedAt(new Date());
      });
    },
    [enqueue, pageId]
  );

  const sortedIds = useCallback(
    () => [...blocksRef.current].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((block) => block.id),
    []
  );

  const moveBlock = useCallback(
    (blockId: string, direction: -1 | 1) => {
      const list = blocksRef.current;
      const block = list.find((entry) => entry.id === blockId);
      if (!block) return;
      const siblings = list
        .filter((entry) => (entry.parent_block_id || null) === (block.parent_block_id || null))
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const index = siblings.findIndex((entry) => entry.id === blockId);
      const swap = siblings[index + direction];
      if (!swap) return;
      const ids = sortedIds();
      const from = ids.indexOf(blockId);
      const to = ids.indexOf(swap.id);
      [ids[from], ids[to]] = [ids[to], ids[from]];
      reorderAll(ids);
    },
    [reorderAll, sortedIds]
  );

  const dropOn = useCallback(
    (targetId: string, position: 'before' | 'after') => {
      const dragId = dragIdRef.current;
      setDropTarget(null);
      if (!dragId || dragId === targetId) return;
      const list = blocksRef.current;
      const dragged = list.find((entry) => entry.id === dragId);
      const target = list.find((entry) => entry.id === targetId);
      // v1: reorder stays within the same parent container.
      if (!dragged || !target || (dragged.parent_block_id || null) !== (target.parent_block_id || null)) return;
      const ids = sortedIds().filter((id) => id !== dragId);
      const at = ids.indexOf(targetId) + (position === 'after' ? 1 : 0);
      ids.splice(at, 0, dragId);
      reorderAll(ids);
    },
    [reorderAll, sortedIds]
  );

  // ---------- SEO / preview / publish ----------

  const saveSeo = useCallback(() => {
    if (!pageId) return;
    setSaveState('saving');
    enqueue(async () => {
      const response = await adminPatchData<{ revision: number }>(`/api/admin/pages/${pageId}/draft`, {
        expectedRevision: revisionRef.current,
        mutationId: crypto.randomUUID(),
        seo: seoForm,
      });
      revisionRef.current = response.revision;
      setSaveState('saved');
      setSavedAt(new Date());
    });
  }, [enqueue, pageId, seoForm]);

  const openPreview = useCallback(async () => {
    if (!pageId) return;
    setPreviewBusy(true);
    try {
      const response = await adminPostData<{ token: string }>(`/api/admin/pages/${pageId}/preview`, {});
      window.open(`/admin/preview/${response.token}`, '_blank', 'noopener');
    } catch (error) {
      setBanner(adminRequestError(error));
    } finally {
      setPreviewBusy(false);
    }
  }, [pageId]);

  const publish = useCallback(async () => {
    if (!pageId) return;
    setPublishing(true);
    try {
      // Raw fetch: the 422 check report (error.fields) must survive, and the
      // shared adminApi client collapses errors to their message string.
      const token = typeof window !== 'undefined' ? localStorage.getItem('hkba_admin_token') : null;
      const res = await fetch(`/api/admin/pages/${pageId}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ expectedRevision: revisionRef.current }),
      });
      const body = (await res.json()) as { success?: boolean; error?: { code?: string; message?: string; fields?: CheckProblem[] } };
      if (res.ok) {
        setPublishConfirm(false);
        setCheckProblems([]);
        await Promise.all([loadDraft(pageId), loadTree()]);
        setBanner(null);
      } else if (res.status === 422) {
        setPublishConfirm(false);
        setCheckProblems(body.error?.fields || []);
        setRightPane('check');
      } else if (res.status === 409) {
        setPublishConfirm(false);
        setSaveState('conflict');
      } else {
        setBanner(body.error?.message || '發佈失敗，請稍後重試');
      }
    } catch {
      setBanner('網絡錯誤，請確認後端服務是否運行');
    } finally {
      setPublishing(false);
    }
  }, [pageId, loadDraft, loadTree]);

  // ---------- drawer helpers ----------

  const openMediaPicker = useCallback((apply: (id: string | null) => void) => {
    setMediaApply(() => apply);
    setMediaOpen(true);
  }, []);

  const pickMedia = useCallback(
    (id: string | null) => {
      mediaApply?.(id);
      setMediaOpen(false);
      setMediaApply(null);
    },
    [mediaApply]
  );

  const toggleLeft = (pane: LeftPane) => setLeftPane((current) => (current === pane ? null : pane));
  const toggleRight = (pane: RightPane) => setRightPane((current) => (current === pane ? null : pane));

  const railIcon = (path: string) => (
    <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={path} />
    </svg>
  );

  // ---------- outline rows ----------

  const renderOutlineRows = (parentId: string | null, depth: number) => {
    const rows = blocks
      .filter((block) => (block.parent_block_id || null) === parentId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return rows.map((block, index) => {
      const definition = definitions.find((entry) => entry.type === block.component_type);
      const hasChildren = blocks.some((entry) => entry.parent_block_id === block.id);
      return (
        <div key={block.id}>
          {dropTarget?.id === block.id && dropTarget.position === 'before' ? <div className="hk-dropline" /> : null}
          <div
            className={`hk-tree-row${selectedId === block.id ? ' is-active' : ''}`}
            style={{ paddingLeft: 8 + depth * 14, cursor: 'grab' }}
            draggable
            onDragStart={() => {
              dragIdRef.current = block.id;
            }}
            onDragOver={(event) => {
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              setDropTarget({ id: block.id, position: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after' });
            }}
            onDrop={(event) => {
              event.preventDefault();
              dropOn(block.id, event.clientY < event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2 ? 'before' : 'after');
            }}
            onDragEnd={() => setDropTarget(null)}
            onClick={() => setSelectedId(block.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setSelectedId(block.id);
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {definition?.name.zh || block.component_type}
            </span>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '2px 7px', fontSize: 11 }}
              aria-label="上移"
              disabled={index === 0}
              onClick={(event) => {
                event.stopPropagation();
                moveBlock(block.id, -1);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '2px 7px', fontSize: 11 }}
              aria-label="下移"
              disabled={index === rows.length - 1}
              onClick={(event) => {
                event.stopPropagation();
                moveBlock(block.id, 1);
              }}
            >
              ↓
            </button>
            {!hasChildren ? (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '2px 7px', fontSize: 11 }}
                aria-label="刪除"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteBlock(block.id);
                }}
              >
                ✕
              </button>
            ) : null}
          </div>
          {dropTarget?.id === block.id && dropTarget.position === 'after' ? <div className="hk-dropline" /> : null}
          {renderOutlineRows(block.id, depth + 1)}
        </div>
      );
    });
  };

  const renderTreeRows = (nodes: TreeNode[], depth: number) =>
    nodes.map((node) => (
      <div key={node.id}>
        <button
          type="button"
          className={`hk-tree-row${node.id === pageId ? ' is-active' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => {
            if (node.node_type === 'page') router.replace(`/admin/studio?id=${node.id}`);
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.title_zh || node.slug}
            {node.node_type === 'section' ? '（欄目）' : ''}
          </span>
          {node.has_draft ? <span title="有草稿" style={{ color: 'var(--gold)', fontSize: 10 }}>●</span> : null}
          {node.missing_en ? <span title="缺少英文標題" style={{ color: 'var(--warn)', fontSize: 10 }}>⚠</span> : null}
        </button>
        {renderTreeRows(node.children || [], depth + 1)}
      </div>
    ));

  // ---------- render ----------

  const libraryGroups = useMemo(() => {
    const groups = new Map<string, Definition[]>();
    for (const definition of definitions) {
      if (!definition.allowedPageTypes.includes('page')) continue;
      const list = groups.get(definition.category) || [];
      list.push(definition);
      groups.set(definition.category, list);
    }
    return groups;
  }, [definitions]);

  return (
    <div className="hk-studio">
      <div className="hk-studio__topbar">
        <div>
          <div className="hk-studio__title">{currentNode ? currentNode.title_zh || currentNode.slug : '頁面工作室'}</div>
          <div className="hk-studio__crumb">
            {currentNode ? currentNode.path : '未選擇頁面'}
            {version ? ` · 草稿修訂 ${revisionRef.current}` : ''}
          </div>
        </div>
        <div className="hk-studio__spacer" />
        <SaveStatus state={saveState} savedAt={savedAt} onRetry={() => selectedId && saveBlockNow(selectedId)} />
        {saveState === 'conflict' ? (
          <button type="button" className="btn-secondary" style={{ padding: '7px 12px', fontSize: 12 }} onClick={() => pageId && loadDraft(pageId)}>
            重新載入草稿
          </button>
        ) : null}
        <div className="hk-segmented" role="group" aria-label="畫布寬度">
          {(['desktop', 'tablet', 'mobile'] as const).map((width) => (
            <button key={width} type="button" className={canvasWidth === width ? 'is-active' : ''} onClick={() => setCanvasWidth(width)}>
              {width === 'desktop' ? '桌面' : width === 'tablet' ? '平板' : '手機'}
            </button>
          ))}
        </div>
        <div className="hk-lang-switch" role="group" aria-label="編輯語言">
          <button type="button" className={lang === 'zh' ? 'is-active' : ''} onClick={() => setLang('zh')}>
            中文
          </button>
          <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
            EN
          </button>
        </div>
        <button type="button" className="btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={openPreview} disabled={!pageId || previewBusy}>
          {previewBusy ? '產生中…' : '預覽'}
        </button>
        <button type="button" className="btn-accent" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setPublishConfirm(true)} disabled={!pageId || publishing}>
          發佈
        </button>
      </div>

      {banner ? (
        <div style={{ padding: '8px 16px', fontSize: 12.5, color: 'var(--warn)', background: 'rgba(240,140,90,0.08)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 12 }}>
          <span style={{ flex: 1 }}>{banner}</span>
          <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }} onClick={() => setBanner(null)} aria-label="關閉提示">
            ✕
          </button>
        </div>
      ) : null}

      <div className="hk-studio__body">
        <div className="hk-rail" role="toolbar" aria-label="左側面板">
          <button type="button" className={`hk-rail__btn${leftPane === 'tree' ? ' is-active' : ''}`} title="頁面樹" aria-label="頁面樹" onClick={() => toggleLeft('tree')}>
            {railIcon('M4 6h16M4 12h10M4 18h7')}
          </button>
          <button type="button" className={`hk-rail__btn${leftPane === 'outline' ? ' is-active' : ''}`} title="組件結構" aria-label="組件結構" onClick={() => toggleLeft('outline')}>
            {railIcon('M4 5h7v5H4zM13 5h7v5h-7zM8.5 14h7v5h-7z')}
          </button>
          <button type="button" className={`hk-rail__btn${leftPane === 'library' ? ' is-active' : ''}`} title="組件庫" aria-label="組件庫" onClick={() => toggleLeft('library')}>
            {railIcon('M12 5v14m-7-7h14')}
          </button>
          <button
            type="button"
            className={`hk-rail__btn${mediaOpen ? ' is-active' : ''}`}
            title="媒體庫"
            aria-label="媒體庫"
            onClick={() => {
              setMediaApply(null);
              setMediaOpen(true);
            }}
          >
            {railIcon('M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z')}
          </button>
        </div>

        <div className="hk-canvas-wrap" onClick={() => setSelectedId(null)}>
          <div className={`hk-canvas${canvasWidth !== 'desktop' ? ` hk-canvas--${canvasWidth}` : ''}`} onClick={(event) => event.stopPropagation()}>
            {loadingDraft ? (
              <div className="hk-canvas-empty">載入草稿中…</div>
            ) : !pageId ? (
              <div className="hk-canvas-empty">
                從左側頁面樹選擇一個頁面開始編輯。
                <div style={{ marginTop: 14 }}>
                  <button type="button" className="btn-accent" style={{ padding: '9px 18px', fontSize: 13 }} onClick={() => setLeftPane('tree')}>
                    打開頁面樹
                  </button>
                </div>
              </div>
            ) : blocks.length === 0 ? (
              <div className="hk-canvas-empty">
                此頁面還沒有組件。
                <div style={{ marginTop: 14 }}>
                  <button type="button" className="btn-accent" style={{ padding: '9px 18px', fontSize: 13 }} onClick={() => setLeftPane('library')}>
                    從組件庫新增
                  </button>
                </div>
              </div>
            ) : (
              <BlockRenderer blocks={blocks} lang={lang} media={mediaMap} onSelect={setSelectedId} selectedId={selectedId} />
            )}
          </div>
        </div>

        <div className="hk-rail hk-rail--right" role="toolbar" aria-label="右側面板">
          <button
            type="button"
            className={`hk-rail__btn${rightPane === 'props' ? ' is-active' : ''}`}
            title="屬性"
            aria-label="屬性"
            onClick={() => {
              if (!selectedId && blocks.length) setSelectedId(blocks[0].id);
              toggleRight('props');
            }}
          >
            {railIcon('M12 6v6m0 0v6m0-6h6m-6 0H6')}
          </button>
          <button type="button" className={`hk-rail__btn${rightPane === 'seo' ? ' is-active' : ''}`} title="頁面設置 SEO" aria-label="頁面設置" onClick={() => toggleRight('seo')}>
            {railIcon('M10.3 4.3a1.7 1.7 0 013.4 0 1.7 1.7 0 002.5 1 1.7 1.7 0 012.4 2.4 1.7 1.7 0 001 2.6 1.7 1.7 0 010 3.4 1.7 1.7 0 00-1 2.5 1.7 1.7 0 01-2.4 2.4 1.7 1.7 0 00-2.5 1 1.7 1.7 0 01-3.4 0 1.7 1.7 0 00-2.6-1 1.7 1.7 0 01-2.4-2.4 1.7 1.7 0 00-1-2.5 1.7 1.7 0 010-3.4 1.7 1.7 0 001-2.6 1.7 1.7 0 012.4-2.4 1.7 1.7 0 002.6-1z')}
          </button>
          <button type="button" className={`hk-rail__btn${rightPane === 'history' ? ' is-active' : ''}`} title="版本歷史" aria-label="版本歷史" onClick={() => toggleRight('history')}>
            {railIcon('M12 8v4l3 3m6-3a9 9 0 11-9-9 9 9 0 019 9z')}
          </button>
          <button type="button" className={`hk-rail__btn${rightPane === 'check' ? ' is-active' : ''}`} title="發佈檢查" aria-label="發佈檢查" onClick={() => toggleRight('check')}>
            {railIcon('M9 12l2 2 4-4m6 2a9 9 0 11-9-9 9 9 0 019 9z')}
          </button>
        </div>
      </div>

      {/* ---- left drawers ---- */}
      <Drawer open={leftPane === 'tree'} side="left" title="頁面樹" subtitle="選擇要編輯的頁面" onClose={() => setLeftPane(null)}>
        {tree.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>尚未建立頁面。請先到「頁面」管理建立。</div> : renderTreeRows(tree, 0)}
      </Drawer>

      <Drawer open={leftPane === 'outline'} side="left" title="組件結構" subtitle="拖放排序，僅限同一容器內" onClose={() => setLeftPane(null)}>
        {blocks.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>此頁面還沒有組件。</div> : renderOutlineRows(null, 0)}
      </Drawer>

      <Drawer open={leftPane === 'library'} side="left" title="組件庫" subtitle="點擊新增到頁面末尾" onClose={() => setLeftPane(null)}>
        {[...libraryGroups.entries()].map(([category, list]) => (
          <div key={category} className="hk-form__group" style={{ marginBottom: 12 }}>
            <div className="hk-form__group-title">{category}</div>
            {list.map((definition) => (
              <button
                key={definition.type}
                type="button"
                className="hk-tree-row"
                disabled={!pageId}
                onClick={() => {
                  addBlock(definition.type);
                  setLeftPane(null);
                  setRightPane('props');
                }}
              >
                <span style={{ flex: 1 }}>{definition.name.zh}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{definition.type}</span>
              </button>
            ))}
          </div>
        ))}
      </Drawer>

      <Drawer open={mediaOpen} side="left" title="媒體庫" subtitle={mediaApply ? '點擊媒體回填到當前欄位' : '瀏覽已上傳媒體'} onClose={() => setMediaOpen(false)} width={430}>
        {mediaItems.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>媒體庫為空。</div>
        ) : (
          <div className="hk-media-grid">
            {mediaItems.map((item) => (
              <button key={item.id} type="button" className="hk-media-cell" onClick={() => pickMedia(item.id)} title={item.originalFilename}>
                {item.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.altZh || item.originalFilename} />
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '4/3', fontSize: 22, color: 'var(--text-3)' }}>PDF</span>
                )}
              </button>
            ))}
          </div>
        )}
      </Drawer>

      {/* ---- right drawers ---- */}
      <Drawer
        open={rightPane === 'props'}
        side="right"
        title={selectedDefinition ? selectedDefinition.name.zh : '屬性'}
        subtitle={selectedBlock ? selectedBlock.component_type : '未選中組件'}
        onClose={() => setRightPane(null)}
        width={400}
      >
        {selectedBlock && selectedDefinition ? (
          <PropertyForm definition={selectedDefinition} block={selectedBlock} lang={lang} onChange={(scope, key, value) => editBlock(selectedBlock.id, scope, key, value)} onPickMedia={openMediaPicker} />
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>在畫布或組件結構中選中一個組件後編輯其屬性。</div>
        )}
      </Drawer>

      <Drawer open={rightPane === 'seo'} side="right" title="頁面設置" subtitle="SEO 與分享" onClose={() => setRightPane(null)} width={380}>
        <div className="hk-form">
          <div className="hk-field">
            <span className="hk-field__label">SEO 標題（中文）</span>
            <input className="hk-input" value={seoForm.titleZh} onChange={(event) => setSeoForm({ ...seoForm, titleZh: event.target.value })} />
          </div>
          <div className="hk-field">
            <span className="hk-field__label">SEO 標題（英文）</span>
            <input className="hk-input" value={seoForm.titleEn} onChange={(event) => setSeoForm({ ...seoForm, titleEn: event.target.value })} />
          </div>
          <div className="hk-field">
            <span className="hk-field__label">描述（中文）</span>
            <textarea className="hk-textarea" value={seoForm.descriptionZh} onChange={(event) => setSeoForm({ ...seoForm, descriptionZh: event.target.value })} />
          </div>
          <div className="hk-field">
            <span className="hk-field__label">描述（英文）</span>
            <textarea className="hk-textarea" value={seoForm.descriptionEn} onChange={(event) => setSeoForm({ ...seoForm, descriptionEn: event.target.value })} />
          </div>
          <div className="hk-field">
            <span className="hk-field__label">分享圖</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="hk-input" value={seoForm.shareMediaId} readOnly placeholder="未選擇媒體" style={{ flex: 1, minWidth: 0 }} />
              <button type="button" className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => openMediaPicker((id) => setSeoForm((form) => ({ ...form, shareMediaId: id || '' })))}>
                選擇
              </button>
            </div>
          </div>
          <button type="button" className="btn-accent" style={{ padding: '10px 16px', fontSize: 13 }} onClick={saveSeo}>
            保存設置
          </button>
        </div>
      </Drawer>

      <Drawer open={rightPane === 'history'} side="right" title="版本歷史" onClose={() => setRightPane(null)}>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.7 }}>
          版本歷史列表端點將在後續里程碑提供；當前可通過 API 按修訂號回退。
          {version ? (
            <div style={{ marginTop: 10 }}>
              當前草稿修訂：<code style={{ color: 'var(--cyan)' }}>{revisionRef.current}</code>
            </div>
          ) : null}
        </div>
      </Drawer>

      <Drawer open={rightPane === 'check'} side="right" title="發佈檢查" subtitle={checkProblems.length ? `${checkProblems.length} 個待解決問題` : '最近一次的檢查結果'} onClose={() => setRightPane(null)} width={400}>
        {checkProblems.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>暫無待解決問題。點擊「發佈」時會自動進行完整檢查。</div>
        ) : (
          checkProblems.map((problem, index) => (
            <button
              key={index}
              type="button"
              className="hk-check-item"
              onClick={() => {
                if (problem.blockId) {
                  setSelectedId(problem.blockId);
                  setRightPane('props');
                }
              }}
            >
              <span style={{ flex: 1 }}>
                {problem.message || problem.code || '未知問題'}
                {problem.field ? <div style={{ marginTop: 4 }}><code>{problem.field}</code></div> : null}
              </span>
            </button>
          ))
        )}
      </Drawer>

      {/* ---- overlays ---- */}
      {publishConfirm ? (
        <ConfirmBar
          message={`確定發佈「${currentNode?.title_zh || currentNode?.path || '此頁面'}」嗎？發佈後前台立即可見，當前已發佈版本將被取代。`}
          confirmLabel="確認發佈"
          busy={publishing}
          onConfirm={publish}
          onCancel={() => setPublishConfirm(false)}
        />
      ) : null}
      {undoBlock ? (
        <UndoToast
          message={`已刪除組件 ${undoBlock.component_type}`}
          onUndo={() => {
            addBlock(undoBlock.component_type, undoBlock);
            setUndoBlock(null);
          }}
          onDismiss={() => setUndoBlock(null)}
        />
      ) : null}
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--text-3)', fontSize: 13 }}>載入中…</div>}>
      <StudioInner />
    </Suspense>
  );
}
