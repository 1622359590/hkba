'use client';
// News center (M7d): replaces the legacy CRUD table with the M5 entity API.
//
// List view filters by status / category / year / language completeness and
// free text. The editor works on the draft revision: metadata and taxonomy on
// the left, the body blocks (shared BlockRenderer + schema-driven
// PropertyForm) on the canvas. Unlike the page studio, news saves explicitly —
// one PATCH carries metadata plus the full replacement block list with
// expectedRevision + mutationId. Preview reuses the token flow; publishing
// surfaces the 422 check report as clickable problems.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { adminGetData, adminPostData, adminPatchData, adminDeleteData, adminRequestError } from '@/lib/adminApi';
import BlockRenderer, { RenderBlock, MediaMap } from '@/components/blocks/BlockRenderer';
import Drawer from '@/components/admin/shell/Drawer';
import SaveStatus, { SaveState } from '@/components/admin/shell/SaveStatus';
import { ConfirmBar } from '@/components/admin/shell/ConfirmBar';
import PropertyForm, { Definition } from '../studio/PropertyForm';
import { createNewsSlug } from '@/lib/newsSlug.mjs';

type NewsRow = {
  id: string;
  slug: string;
  title_zh: string;
  title_en: string;
  status: string;
  display_year: number | null;
  missing_en: boolean;
  updated_at: string;
};

type TaxonomyItem = { id: string; name_zh: string; slug: string };

type MetaForm = {
  slug: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  displayYear: string;
  coverMediaId: string;
  categoryIds: string[];
  tagIds: string[];
  seo: { titleZh: string; titleEn: string; descriptionZh: string; descriptionEn: string };
};

type MediaItem = { id: string; url: string; kind: 'image' | 'pdf'; altZh: string | null; altEn: string | null; originalFilename: string };

type CheckProblem = { field?: string; code?: string; message?: string; blockId?: string };

const EMPTY_META: MetaForm = {
  slug: '',
  titleZh: '',
  titleEn: '',
  summaryZh: '',
  summaryEn: '',
  displayYear: '',
  coverMediaId: '',
  categoryIds: [],
  tagIds: [],
  seo: { titleZh: '', titleEn: '', descriptionZh: '', descriptionEn: '' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRenderBlock(block: any): RenderBlock {
  return {
    id: block.id,
    component_type: block.block_type,
    parent_block_id: null,
    is_visible: 1,
    sort_order: block.sort_order,
    contentZh: block.contentZh || {},
    contentEn: block.contentEn || {},
    settings: block.settings || {},
  };
}

export default function NewsCenterPage() {
  const searchParams = useSearchParams();
  const requestedNewsId = searchParams.get('id');
  // ---- list state ----
  const [rows, setRows] = useState<NewsRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [year, setYear] = useState('');
  const [missingEnOnly, setMissingEnOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [tags, setTags] = useState<TaxonomyItem[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  // ---- editor state ----
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [meta, setMeta] = useState<MetaForm>(EMPTY_META);
  const [blocks, setBlocks] = useState<RenderBlock[]>([]);
  const [newsStatus, setNewsStatus] = useState('draft');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [checkProblems, setCheckProblems] = useState<CheckProblem[]>([]);
  const [checkOpen, setCheckOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [mediaApply, setMediaApply] = useState<((id: string | null) => void) | null>(null);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NewsRow | null>(null);
  const [acting, setActing] = useState(false);

  const revisionRef = useRef(0);
  const openedIntentRef = useRef<string | null>(null);

  // ---- data loading ----

  const loadList = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(targetPage), pageSize: '20' });
        if (q.trim()) params.set('q', q.trim());
        if (status) params.set('status', status);
        if (categoryId) params.set('categoryId', categoryId);
        if (year.trim()) params.set('year', year.trim());
        if (missingEnOnly) params.set('lang', 'missing-en');
        const data = await adminGetData<{ items: NewsRow[]; total: number }>(`/api/admin/news?${params}`);
        setRows(data.items);
        setTotal(data.total);
        setPage(targetPage);
      } catch (error) {
        setBanner(adminRequestError(error));
      } finally {
        setLoading(false);
      }
    },
    [page, q, status, categoryId, year, missingEnOnly]
  );

  useEffect(() => {
    adminGetData<{ items: TaxonomyItem[] }>('/api/admin/news-categories').then((data) => setCategories(data.items)).catch(() => {});
    adminGetData<{ items: TaxonomyItem[] }>('/api/admin/news-tags').then((data) => setTags(data.items)).catch(() => {});
    adminGetData<{ definitions: Definition[] }>('/api/admin/components/definitions').then((data) => setDefinitions(data.definitions)).catch(() => {});
    adminGetData<{ items: MediaItem[] }>('/api/admin/media?pageSize=100').then((data) => setMediaItems(data.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (editingId) return;
    const timer = setTimeout(() => loadList(1), q ? 350 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, categoryId, year, missingEnOnly, editingId]);

  const openEditor = useCallback(async (id: string) => {
    setBanner(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await adminGetData<{ news: any; draft: { revision: number } | null; blocks: any[] }>(`/api/admin/news/${id}`);
      const news = data.news;
      revisionRef.current = data.draft?.revision ?? news.current_draft_revision ?? 1;
      setMeta({
        slug: news.slug || '',
        titleZh: news.title_zh || '',
        titleEn: news.title_en || '',
        summaryZh: news.summary_zh || '',
        summaryEn: news.summary_en || '',
        displayYear: news.display_year ? String(news.display_year) : '',
        coverMediaId: news.cover_media_id || '',
        categoryIds: news.categoryIds || [],
        tagIds: news.tagIds || [],
        seo: { ...EMPTY_META.seo, ...(news.seo || {}) },
      });
      setBlocks(data.blocks.map(toRenderBlock));
      setNewsStatus(news.status);
      setEditingId(id);
      setSelectedId(null);
      setDirty(false);
      setSaveState('idle');
      setCheckProblems([]);
    } catch (error) {
      setBanner(adminRequestError(error));
    }
  }, []);

  useEffect(() => {
    if (!requestedNewsId || openedIntentRef.current === requestedNewsId) return;
    openedIntentRef.current = requestedNewsId;
    void openEditor(requestedNewsId);
  }, [openEditor, requestedNewsId]);

  // ---- editor mutations (local, saved explicitly) ----

  const markDirty = () => {
    setDirty(true);
    setSaveState('idle');
  };

  const editBlock = (blockId: string, scope: 'contentZh' | 'contentEn' | 'settings', key: string, value: unknown) => {
    setBlocks((previous) => previous.map((block) => (block.id === blockId ? { ...block, [scope]: { ...(block[scope] as Record<string, unknown>), [key]: value } } : block)));
    markDirty();
  };

  const addBlock = (componentType: string) => {
    const definition = definitions.find((entry) => entry.type === componentType);
    if (!definition) return;
    const block: RenderBlock = {
      id: crypto.randomUUID(),
      component_type: componentType,
      parent_block_id: null,
      is_visible: 1,
      sort_order: blocks.length + 1,
      contentZh: {},
      contentEn: {},
      settings: {},
    };
    setBlocks((previous) => [...previous, block]);
    setSelectedId(block.id);
    setLibraryOpen(false);
    markDirty();
  };

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    setBlocks((previous) => {
      const index = previous.findIndex((block) => block.id === blockId);
      const swap = index + direction;
      if (index < 0 || swap < 0 || swap >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[swap]] = [next[swap], next[index]];
      return next.map((block, order) => ({ ...block, sort_order: order + 1 }));
    });
    markDirty();
  };

  const deleteBlock = (blockId: string) => {
    setBlocks((previous) => previous.filter((block) => block.id !== blockId).map((block, order) => ({ ...block, sort_order: order + 1 })));
    if (selectedId === blockId) setSelectedId(null);
    markDirty();
  };

  // ---- save / preview / publish ----

  const save = useCallback(async () => {
    if (!editingId || editingId === 'new') return;
    setSaveState('saving');
    try {
      const payload: Record<string, unknown> = {
        expectedRevision: revisionRef.current,
        mutationId: crypto.randomUUID(),
        titleZh: meta.titleZh,
        titleEn: meta.titleEn,
        summaryZh: meta.summaryZh,
        summaryEn: meta.summaryEn,
        displayYear: meta.displayYear.trim() ? Number(meta.displayYear) : null,
        coverMediaId: meta.coverMediaId || null,
        categoryIds: meta.categoryIds,
        tagIds: meta.tagIds,
        seo: meta.seo,
        blocks: blocks.map((block) => ({
          id: block.id,
          blockType: block.component_type,
          contentZh: block.contentZh,
          contentEn: block.contentEn,
          settings: block.settings,
        })),
      };
      if (meta.slug.trim()) payload.slug = meta.slug.trim();
      const response = await adminPatchData<{ revision: number }>(`/api/admin/news/${editingId}`, payload);
      revisionRef.current = response.revision;
      setDirty(false);
      setSaveState('saved');
      setSavedAt(new Date());
      setBanner(null);
    } catch (error) {
      const message = adminRequestError(error);
      if (message.includes('衝突') || message.includes('已被其他編輯')) setSaveState('conflict');
      else {
        setSaveState('error');
        setBanner(message);
      }
    }
  }, [editingId, meta, blocks]);

  const createNews = useCallback(async () => {
    setActing(true);
    try {
      const slug = meta.slug.trim();
      const data = await adminPostData<{ news: { id: string } }>('/api/admin/news', {
        ...(slug ? { slug } : {}),
        titleZh: meta.titleZh,
        titleEn: meta.titleEn,
        summaryZh: meta.summaryZh,
        summaryEn: meta.summaryEn,
        displayYear: meta.displayYear.trim() ? Number(meta.displayYear) : null,
        categoryIds: meta.categoryIds,
        tagIds: meta.tagIds,
      });
      await openEditor(data.news.id);
    } catch (error) {
      setBanner(adminRequestError(error));
    } finally {
      setActing(false);
    }
  }, [meta, openEditor]);

  const openPreview = useCallback(async () => {
    if (!editingId || editingId === 'new') return;
    try {
      const response = await adminPostData<{ token: string }>(`/api/admin/news/${editingId}/preview`, {});
      window.open(`/preview/${response.token}`, '_blank', 'noopener');
    } catch (error) {
      setBanner(adminRequestError(error));
    }
  }, [editingId]);

  const publish = useCallback(async () => {
    if (!editingId || editingId === 'new') return;
    setPublishing(true);
    try {
      const token = localStorage.getItem('hkba_admin_token');
      const res = await fetch(`/api/admin/news/${editingId}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'XMLHttpRequest', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ expectedRevision: revisionRef.current }),
      });
      const body = await res.json();
      if (res.ok) {
        setPublishConfirm(false);
        setCheckProblems([]);
        await openEditor(editingId);
      } else if (res.status === 422) {
        setPublishConfirm(false);
        setCheckProblems(body.error?.fields || []);
        setCheckOpen(true);
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
  }, [editingId, openEditor]);

  const removeNews = useCallback(async () => {
    if (!deleteTarget) return;
    setActing(true);
    try {
      await adminDeleteData(`/api/admin/news/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadList();
    } catch (error) {
      setBanner(adminRequestError(error));
      setDeleteTarget(null);
    } finally {
      setActing(false);
    }
  }, [deleteTarget, loadList]);

  // ---- memoized lookups ----

  const mediaMap = useMemo<MediaMap>(() => {
    const map: MediaMap = {};
    for (const item of mediaItems) map[item.id] = { url: item.url, altZh: item.altZh || undefined, altEn: item.altEn || undefined };
    return map;
  }, [mediaItems]);

  const newsDefinitions = useMemo(
    () => definitions.filter((definition) => definition.allowedPageTypes.includes('news') && definition.type !== 'news.header'),
    [definitions]
  );
  const selectedBlock = blocks.find((block) => block.id === selectedId) || null;
  const selectedDefinition = selectedBlock ? definitions.find((definition) => definition.type === selectedBlock.component_type) || null : null;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  // ==================== editor ====================

  if (editingId === 'new') {
    return (
      <div style={{ maxWidth: 640 }}>
        <button type="button" className="btn-secondary" style={{ padding: '7px 12px', fontSize: 12, marginBottom: 16 }} onClick={() => setEditingId(null)}>
          ← 返回列表
        </button>
        <h2 style={{ color: 'var(--text-1)', fontSize: 18, fontWeight: 750, marginBottom: 16 }}>新建新聞</h2>
        {banner ? <div style={{ padding: '9px 14px', marginBottom: 14, fontSize: 12.5, color: 'var(--warn)', background: 'rgba(240,140,90,0.08)', borderRadius: 10 }}>{banner}</div> : null}
        <div className="hk-form">
          <div className="hk-field">
            <span className="hk-field__label">slug<small>已自動生成，可修改；僅小寫字母、數字和連字符</small></span>
            <input className="hk-input" value={meta.slug} onChange={(event) => setMeta({ ...meta, slug: event.target.value })} placeholder="2026-annual-conference" />
          </div>
          <div className="hk-field">
            <span className="hk-field__label">標題（中文）<small>必填</small></span>
            <input className="hk-input" value={meta.titleZh} onChange={(event) => setMeta({ ...meta, titleZh: event.target.value })} />
          </div>
          <div className="hk-field">
            <span className="hk-field__label">標題（英文）</span>
            <input className="hk-input" value={meta.titleEn} onChange={(event) => setMeta({ ...meta, titleEn: event.target.value })} />
          </div>
          <div className="hk-field">
            <span className="hk-field__label">摘要（中文）</span>
            <textarea className="hk-textarea" value={meta.summaryZh} onChange={(event) => setMeta({ ...meta, summaryZh: event.target.value })} />
          </div>
          <button type="button" className="btn-accent" style={{ padding: '10px 18px', fontSize: 13 }} disabled={acting || !meta.titleZh.trim()} onClick={createNews}>
            {acting ? '建立中…' : '建立並進入編輯器'}
          </button>
        </div>
      </div>
    );
  }

  if (editingId) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <button type="button" className="btn-secondary" style={{ padding: '7px 12px', fontSize: 12 }} onClick={() => { setEditingId(null); loadList(); }}>
            ← 返回列表
          </button>
          <strong style={{ color: 'var(--text-1)', fontSize: 15 }}>{meta.titleZh || meta.slug}</strong>
          <span style={{ fontSize: 11, color: newsStatus === 'published' ? 'var(--cyan)' : 'var(--text-3)', border: '1px solid var(--border-subtle)', borderRadius: 999, padding: '3px 10px' }}>
            {newsStatus === 'published' ? '已發佈' : '草稿'} · 修訂 {revisionRef.current}
          </span>
          {dirty ? <span style={{ fontSize: 11, color: 'var(--gold)' }}>● 未保存修改</span> : null}
          <span style={{ flex: 1 }} />
          <SaveStatus state={saveState} savedAt={savedAt} onRetry={save} />
          {saveState === 'conflict' ? (
            <button type="button" className="btn-secondary" style={{ padding: '7px 12px', fontSize: 12 }} onClick={() => openEditor(editingId)}>
              重新載入
            </button>
          ) : null}
          <div className="hk-lang-switch" role="group" aria-label="編輯語言">
            <button type="button" className={lang === 'zh' ? 'is-active' : ''} onClick={() => setLang('zh')}>中文</button>
            <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
          <button type="button" className="btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={openPreview}>預覽</button>
          <button type="button" className="btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }} disabled={!dirty && saveState !== 'error'} onClick={save}>
            保存
          </button>
          <button type="button" className="btn-accent" style={{ padding: '8px 16px', fontSize: 13 }} disabled={publishing || dirty} title={dirty ? '請先保存' : undefined} onClick={() => setPublishConfirm(true)}>
            發佈
          </button>
        </div>

        {banner ? (
          <div style={{ padding: '9px 14px', marginBottom: 14, fontSize: 12.5, color: 'var(--warn)', background: 'rgba(240,140,90,0.08)', borderRadius: 10, display: 'flex', gap: 12 }}>
            <span style={{ flex: 1 }}>{banner}</span>
            <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }} onClick={() => setBanner(null)} aria-label="關閉提示">✕</button>
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
          {/* metadata column */}
          <div className="hk-form" style={{ position: 'sticky', top: 0 }}>
            <div className="hk-form__group">
              <div className="hk-form__group-title">元數據</div>
              <div className="hk-field">
                <span className="hk-field__label">slug</span>
                <input className="hk-input" value={meta.slug} onChange={(event) => { setMeta({ ...meta, slug: event.target.value }); markDirty(); }} />
              </div>
              <div className="hk-field">
                <span className="hk-field__label">標題（{lang === 'en' ? '英文' : '中文'}）</span>
                <input
                  className="hk-input"
                  value={lang === 'en' ? meta.titleEn : meta.titleZh}
                  onChange={(event) => { setMeta(lang === 'en' ? { ...meta, titleEn: event.target.value } : { ...meta, titleZh: event.target.value }); markDirty(); }}
                />
              </div>
              <div className="hk-field">
                <span className="hk-field__label">摘要（{lang === 'en' ? '英文' : '中文'}）</span>
                <textarea
                  className="hk-textarea"
                  value={lang === 'en' ? meta.summaryEn : meta.summaryZh}
                  onChange={(event) => { setMeta(lang === 'en' ? { ...meta, summaryEn: event.target.value } : { ...meta, summaryZh: event.target.value }); markDirty(); }}
                />
              </div>
              <div className="hk-field">
                <span className="hk-field__label">顯示年份<small>留空按發佈日期</small></span>
                <input className="hk-input" type="number" value={meta.displayYear} onChange={(event) => { setMeta({ ...meta, displayYear: event.target.value }); markDirty(); }} />
              </div>
              <div className="hk-field">
                <span className="hk-field__label">封面媒體</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="hk-input" value={meta.coverMediaId} readOnly placeholder="未選擇" style={{ flex: 1, minWidth: 0 }} />
                  <button type="button" className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => setMediaApply(() => (id: string | null) => { setMeta((form) => ({ ...form, coverMediaId: id || '' })); markDirty(); })}>
                    選擇
                  </button>
                </div>
              </div>
            </div>
            <div className="hk-form__group">
              <div className="hk-form__group-title">欄目與標籤</div>
              {categories.map((category) => (
                <label key={category.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={meta.categoryIds.includes(category.id)}
                    onChange={(event) => {
                      setMeta({ ...meta, categoryIds: event.target.checked ? [...meta.categoryIds, category.id] : meta.categoryIds.filter((id) => id !== category.id) });
                      markDirty();
                    }}
                  />
                  {category.name_zh}
                </label>
              ))}
              {tags.map((tag) => (
                <label key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={meta.tagIds.includes(tag.id)}
                    onChange={(event) => {
                      setMeta({ ...meta, tagIds: event.target.checked ? [...meta.tagIds, tag.id] : meta.tagIds.filter((id) => id !== tag.id) });
                      markDirty();
                    }}
                  />
                  # {tag.name_zh}
                </label>
              ))}
            </div>
            <div className="hk-form__group">
              <div className="hk-form__group-title">SEO</div>
              <div className="hk-field">
                <span className="hk-field__label">SEO 標題（{lang === 'en' ? '英文' : '中文'}）</span>
                <input
                  className="hk-input"
                  value={lang === 'en' ? meta.seo.titleEn : meta.seo.titleZh}
                  onChange={(event) => { setMeta({ ...meta, seo: lang === 'en' ? { ...meta.seo, titleEn: event.target.value } : { ...meta.seo, titleZh: event.target.value } }); markDirty(); }}
                />
              </div>
              <div className="hk-field">
                <span className="hk-field__label">SEO 描述（{lang === 'en' ? '英文' : '中文'}）</span>
                <textarea
                  className="hk-textarea"
                  value={lang === 'en' ? meta.seo.descriptionEn : meta.seo.descriptionZh}
                  onChange={(event) => { setMeta({ ...meta, seo: lang === 'en' ? { ...meta.seo, descriptionEn: event.target.value } : { ...meta.seo, descriptionZh: event.target.value } }); markDirty(); }}
                />
              </div>
            </div>
          </div>

          {/* body blocks column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>正文組件</span>
              <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setLibraryOpen(true)}>
                ＋ 新增組件
              </button>
            </div>
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 18, background: 'var(--surface-1)' }}>
              <BlockRenderer blocks={blocks} lang={lang} media={mediaMap} onSelect={setSelectedId} selectedId={selectedId} />
            </div>
            {selectedBlock && selectedDefinition ? (
              <div style={{ marginTop: 16, border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <strong style={{ fontSize: 13, color: 'var(--text-1)', flex: 1 }}>{selectedDefinition.name.zh}</strong>
                  <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} disabled={selectedBlock.component_type === 'news.header'} onClick={() => moveBlock(selectedBlock.id, -1)}>↑</button>
                  <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} disabled={selectedBlock.component_type === 'news.header'} onClick={() => moveBlock(selectedBlock.id, 1)}>↓</button>
                  <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11, color: 'var(--warn)' }} disabled={selectedBlock.component_type === 'news.header'} onClick={() => deleteBlock(selectedBlock.id)}>刪除</button>
                </div>
                <PropertyForm definition={selectedDefinition} block={selectedBlock} lang={lang} onChange={(scope, key, value) => editBlock(selectedBlock.id, scope, key, value)} onPickMedia={(apply) => setMediaApply(() => apply)} />
              </div>
            ) : (
              <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--text-3)' }}>點擊畫布中的組件編輯屬性；news.header 由元數據驅動，不可刪除。</div>
            )}
          </div>
        </div>

        {/* block library drawer */}
        <Drawer open={libraryOpen} side="left" title="新增正文組件" onClose={() => setLibraryOpen(false)}>
          {newsDefinitions.map((definition) => (
            <button key={definition.type} type="button" className="hk-tree-row" onClick={() => addBlock(definition.type)}>
              <span style={{ flex: 1 }}>{definition.name.zh}</span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{definition.type}</span>
            </button>
          ))}
        </Drawer>

        {/* media picker drawer */}
        <Drawer open={Boolean(mediaApply)} side="left" title="選擇媒體" subtitle="點擊回填到當前欄位" onClose={() => setMediaApply(null)} width={430}>
          <div className="hk-media-grid">
            {mediaItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="hk-media-cell"
                onClick={() => {
                  mediaApply?.(item.id);
                  setMediaApply(null);
                }}
              >
                {item.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.altZh || item.originalFilename} />
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '4/3', fontSize: 22, color: 'var(--text-3)' }}>PDF</span>
                )}
              </button>
            ))}
          </div>
        </Drawer>

        {/* publish check drawer */}
        <Drawer open={checkOpen} side="right" title="發佈檢查" subtitle={`${checkProblems.length} 個待解決問題`} onClose={() => setCheckOpen(false)} width={400}>
          {checkProblems.map((problem, index) => (
            <button
              key={index}
              type="button"
              className="hk-check-item"
              onClick={() => {
                if (problem.blockId) {
                  setSelectedId(problem.blockId);
                  setCheckOpen(false);
                }
              }}
            >
              <span style={{ flex: 1 }}>
                {problem.message || problem.code || '未知問題'}
                {problem.field ? <div style={{ marginTop: 4 }}><code>{problem.field}</code></div> : null}
              </span>
            </button>
          ))}
        </Drawer>

        {publishConfirm ? (
          <ConfirmBar
            message={`確定發佈「${meta.titleZh || meta.slug}」嗎？發佈後前台立即可見。`}
            confirmLabel="確認發佈"
            busy={publishing}
            onConfirm={publish}
            onCancel={() => setPublishConfirm(false)}
          />
        ) : null}
      </div>
    );
  }

  // ==================== list ====================

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <input className="hk-input" style={{ maxWidth: 220 }} placeholder="搜尋標題或摘要…" value={q} onChange={(event) => setQ(event.target.value)} />
        <div className="hk-segmented" role="group" aria-label="狀態篩選">
          {([['', '全部'], ['draft', '草稿'], ['published', '已發佈']] as const).map(([value, label]) => (
            <button key={value} type="button" className={status === value ? 'is-active' : ''} onClick={() => setStatus(value)}>
              {label}
            </button>
          ))}
        </div>
        <select className="hk-select" style={{ maxWidth: 160 }} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">全部欄目</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name_zh}</option>
          ))}
        </select>
        <input className="hk-input" style={{ width: 110 }} type="number" placeholder="年份" value={year} onChange={(event) => setYear(event.target.value)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={missingEnOnly} onChange={(event) => setMissingEnOnly(event.target.checked)} />
          缺英文
        </label>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn-accent"
          style={{ padding: '9px 16px', fontSize: 13 }}
          onClick={() => {
            setMeta({
              ...EMPTY_META,
              slug: createNewsSlug(),
              categoryIds: [],
              tagIds: [],
              seo: { ...EMPTY_META.seo },
            });
            setEditingId('new');
          }}
        >
          新建新聞
        </button>
      </div>

      {banner ? (
        <div style={{ padding: '9px 14px', marginBottom: 14, fontSize: 12.5, color: 'var(--warn)', background: 'rgba(240,140,90,0.08)', borderRadius: 10, display: 'flex', gap: 12 }}>
          <span style={{ flex: 1 }}>{banner}</span>
          <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }} onClick={() => setBanner(null)} aria-label="關閉提示">✕</button>
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>載入中…</div>
      ) : rows.length === 0 ? (
        <div className="hk-canvas-empty">沒有符合條件的新聞。</div>
      ) : (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-1)', cursor: 'pointer' }}
              onClick={() => openEditor(row.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter') openEditor(row.id); }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.title_zh || row.slug}
                  {row.missing_en ? <span title="缺少英文" style={{ color: 'var(--warn)', marginLeft: 8, fontSize: 11 }}>⚠ 缺英文</span> : null}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>
                  {row.slug} · {row.display_year || '按發佈日期'} · 更新於 {String(row.updated_at || '').slice(0, 16)}
                </div>
              </div>
              <span style={{ fontSize: 11, color: row.status === 'published' ? 'var(--cyan)' : 'var(--text-3)', border: '1px solid var(--border-subtle)', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                {row.status === 'published' ? '已發佈' : '草稿'}
              </span>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '5px 10px', fontSize: 11, color: 'var(--warn)' }}
                onClick={(event) => {
                  event.stopPropagation();
                  setDeleteTarget(row);
                }}
              >
                刪除
              </button>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, fontSize: 12.5, color: 'var(--text-2)' }}>
          <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} disabled={page <= 1} onClick={() => loadList(page - 1)}>上一頁</button>
          <span>第 {page} / {totalPages} 頁 · 共 {total} 項</span>
          <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} disabled={page >= totalPages} onClick={() => loadList(page + 1)}>下一頁</button>
        </div>
      ) : null}

      {deleteTarget ? (
        <ConfirmBar
          message={`將新聞「${deleteTarget.title_zh || deleteTarget.slug}」移入回收站？可通過 API 恢復。`}
          confirmLabel="移入回收站"
          danger
          busy={acting}
          onConfirm={removeNews}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
