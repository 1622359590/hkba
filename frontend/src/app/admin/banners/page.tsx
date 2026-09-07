'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminGet, adminPost, adminPut, adminDelete, adminRequestError, notifyAdminDataChanged } from '@/lib/adminApi';
import { FormField, Input, BilingualField, Toggle } from '@/components/admin/FormControls';
import BannerImageUpload from '@/components/admin/BannerImageUpload';
import { ActionButton } from '@/components/admin/ActionButton';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, Toast } from '@/components/ui/Feedback';

interface Banner { id: number; title_zh: string; title_en: string; subtitle_zh: string; subtitle_en: string; description_zh: string; description_en: string; image_url: string; link_url: string; video_url: string; sort_order: number; is_active: number; }
const empty = { title_zh:'', title_en:'', subtitle_zh:'', subtitle_en:'', description_zh:'', description_en:'', image_url:'', link_url:'', video_url:'', sort_order:0, is_active:1 };

const badge = (active: boolean): React.CSSProperties => ({ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: active ? 'rgba(34,197,94,0.1)' : 'rgba(113,113,122,0.1)', color: active ? '#22c55e' : '#71717a' });

export default function BannersAdmin() {
  const [items, setItems] = useState<Banner[]>([]);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const locked = saving || uploading;
  const load = async () => {
    setLoading(true); setError('');
    try { setItems(await adminGet<Banner[]>('/api/banners/all')); } catch (requestError) { setError(adminRequestError(requestError)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openEditor = (opener: HTMLButtonElement, banner?: Banner) => {
    openerRef.current = opener;
    setEditing(banner || null);
    setForm(banner || empty);
    setUploading(false);
    setShowForm(true);
  };

  const closeEditor = useCallback(() => {
    if (saving || uploading) return;
    const opener = openerRef.current;
    setShowForm(false);
    setEditing(null);
    setForm(empty);
    requestAnimationFrame(() => opener?.focus());
  }, [saving, uploading]);

  useEffect(() => {
    if (!showForm) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showForm]);

  useEffect(() => {
    if (!showForm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !locked) closeEditor();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showForm, locked, closeEditor]);

  const handleSave = async () => {
    if (locked) return;
    setSaving(true);
    try {
      if (editing) await adminPut(`/api/banners/${editing.id}`, form); else await adminPost('/api/banners', form);
      const opener = openerRef.current;
      setShowForm(false); setEditing(null); setForm(empty); notifyAdminDataChanged('content-updated'); setToast({ tone: 'success', message: 'Banner 已保存。' }); await load(); requestAnimationFrame(() => opener?.focus());
    } catch (requestError) { setToast({ tone: 'error', message: adminRequestError(requestError) }); } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await adminDelete(`/api/banners/${deleteTarget.id}`); setDeleteTarget(null); notifyAdminDataChanged('content-updated'); setToast({ tone: 'success', message: 'Banner 已刪除。' }); await load(); }
    catch (requestError) { setToast({ tone: 'error', message: adminRequestError(requestError) }); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="admin-page-heading">
        <h1 className="admin-page-title">Banner 管理</h1>
        <button type="button" onClick={(event) => openEditor(event.currentTarget)} className="btn-accent" style={{ fontSize: 13 }}>+ 新增</button>
      </div>
      {showForm && (
        <div className="admin-editor-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !locked) closeEditor(); }}>
          <section className="admin-editor-modal__dialog admin-banner-modal" role="dialog" aria-modal="true" aria-labelledby="banner-editor-title" aria-busy={locked}>
            <header className="admin-editor-modal__header">
              <div>
                <span className="admin-editor-modal__eyebrow">BANNER CONTENT</span>
                <h2 id="banner-editor-title">{editing ? '編輯 Banner' : '新增 Banner'}</h2>
              </div>
              <button ref={closeButtonRef} type="button" className="admin-editor-modal__close" onClick={closeEditor} aria-label="關閉 Banner 編輯視窗" disabled={locked}>×</button>
            </header>
            <div className="admin-editor-modal__body">
              <BannerImageUpload value={form.image_url} onChange={(url) => setForm(f => ({...f, image_url: url}))} disabled={saving} onUploadingChange={setUploading} />
              <BilingualField label="標題" valueZh={form.title_zh} valueEn={form.title_en} onChangeZh={v => setForm(f => ({...f, title_zh: v}))} onChangeEn={v => setForm(f => ({...f, title_en: v}))} />
              <BilingualField label="副標題" valueZh={form.subtitle_zh} valueEn={form.subtitle_en} onChangeZh={v => setForm(f => ({...f, subtitle_zh: v}))} onChangeEn={v => setForm(f => ({...f, subtitle_en: v}))} />
              <BilingualField label="描述" type="textarea" rows={3} valueZh={form.description_zh} valueEn={form.description_en} onChangeZh={v => setForm(f => ({...f, description_zh: v}))} onChangeEn={v => setForm(f => ({...f, description_en: v}))} />
              <div className="admin-editor-modal__grid">
                <FormField label="連結 URL"><Input value={form.link_url} onChange={v => setForm(f => ({...f, link_url: v}))} /></FormField>
                <FormField label="視頻 URL"><Input value={form.video_url} onChange={v => setForm(f => ({...f, video_url: v}))} /></FormField>
              </div>
              <div className="admin-editor-modal__grid">
                <FormField label="排序"><Input type="number" value={String(form.sort_order)} onChange={v => setForm(f => ({...f, sort_order: +v}))} /></FormField>
                <div className="admin-banner-modal__toggle"><Toggle checked={!!form.is_active} onChange={v => setForm(f => ({...f, is_active: v ? 1 : 0}))} label="啟用" /></div>
              </div>
            </div>
            <footer className="admin-editor-modal__footer">
              <span className="admin-banner-modal__hint">上傳的圖片會自動進入媒體庫</span>
              <div className="admin-banner-modal__actions">
                <button type="button" onClick={closeEditor} className="btn-secondary" disabled={locked}>取消</button>
                <ActionButton type="button" onClick={handleSave} pending={saving} disabled={uploading}>保存 Banner</ActionButton>
              </div>
            </footer>
          </section>
        </div>
      )}
      {loading && <LoadingState label="正在載入 Banner..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && <div className="admin-list-stack">
        {items.map(item => (
          <div key={item.id} className="admin-content-row">
            {item.image_url && <img src={item.image_url} alt="" style={{ width: 96, height: 48, objectFit: 'cover', borderRadius: 8 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title_zh || item.title_en}</div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>{item.subtitle_zh || item.subtitle_en}</div>
            </div>
            <span style={badge(!!item.is_active)}>{item.is_active ? '啟用' : '停用'}</span>
            <button type="button" onClick={(event) => openEditor(event.currentTarget, item)} className="admin-action">編輯</button>
            <button type="button" onClick={() => setDeleteTarget(item)} className="admin-action is-danger">刪除</button>
          </div>
        ))}
        {items.length === 0 && <EmptyState title="暫無 Banner" description="新增首頁主視覺後，內容會顯示在前台首頁。" action={<button type="button" onClick={(event) => openEditor(event.currentTarget)} className="btn-secondary">新增 Banner</button>} />}
      </div>}
      {deleteTarget && <ConfirmDialog title="刪除這個 Banner？" description={`刪除「${deleteTarget.title_zh || deleteTarget.title_en || '未命名 Banner'}」後將無法復原。`} onCancel={() => setDeleteTarget(null)} onConfirm={remove} pending={deleting} />}
      {toast && <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
