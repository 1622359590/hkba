'use client';
import { useEffect, useState } from 'react';
import { adminGet, adminPost, adminPut, adminDelete, adminRequestError, notifyAdminDataChanged } from '@/lib/adminApi';
import { FormField, Input, Textarea, BilingualField, ImageField, Toggle, Select, AdminCard } from '@/components/admin/FormControls';
import { ActionButton } from '@/components/admin/ActionButton';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, Toast } from '@/components/ui/Feedback';

interface NewsItem { id: number; title_zh: string; title_en: string; summary_zh: string; summary_en: string; content_zh: string; content_en: string; cover_image: string; category: string; is_published: number; published_at: string; }
const empty = { title_zh:'', title_en:'', summary_zh:'', summary_en:'', content_zh:'', content_en:'', cover_image:'', category:'general', is_published:0 };
const badge = (pub: boolean): React.CSSProperties => ({ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: pub ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: pub ? '#22c55e' : '#f59e0b' });

export default function NewsAdmin() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<NewsItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
  const load = async () => {
    setLoading(true); setError('');
    try { setItems(await adminGet<NewsItem[]>('/api/news/admin/all')); } catch (requestError) { setError(adminRequestError(requestError)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.title_zh.trim() && !form.title_en.trim()) { setToast({ tone: 'error', message: '請至少填寫一個新聞標題。' }); return; }
    setSaving(true);
    try {
      if (editing) await adminPut(`/api/news/${editing.id}`, form); else await adminPost('/api/news', form);
      setShowForm(false); setEditing(null); setForm(empty); notifyAdminDataChanged('content-updated'); setToast({ tone: 'success', message: '新聞已保存。' }); await load();
    } catch (requestError) { setToast({ tone: 'error', message: adminRequestError(requestError) }); } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await adminDelete(`/api/news/${deleteTarget.id}`); setDeleteTarget(null); notifyAdminDataChanged('content-updated'); setToast({ tone: 'success', message: '新聞已刪除。' }); await load(); }
    catch (requestError) { setToast({ tone: 'error', message: adminRequestError(requestError) }); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="admin-page-heading">
        <h1 className="admin-page-title">新聞管理</h1>
        <button onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }} className="btn-accent" style={{ fontSize: 13 }}>+ 新增新聞</button>
      </div>
      {showForm && (
        <AdminCard title={editing ? '編輯新聞' : '新增新聞'} actions={<button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="admin-action is-muted">取消</button>}>
          <BilingualField label="標題" valueZh={form.title_zh} valueEn={form.title_en} onChangeZh={v => setForm(f => ({...f, title_zh: v}))} onChangeEn={v => setForm(f => ({...f, title_en: v}))} required />
          <BilingualField label="摘要" type="textarea" rows={2} valueZh={form.summary_zh} valueEn={form.summary_en} onChangeZh={v => setForm(f => ({...f, summary_zh: v}))} onChangeEn={v => setForm(f => ({...f, summary_en: v}))} />
          <BilingualField label="正文 (HTML)" type="textarea" rows={10} valueZh={form.content_zh} valueEn={form.content_en} onChangeZh={v => setForm(f => ({...f, content_zh: v}))} onChangeEn={v => setForm(f => ({...f, content_en: v}))} />
          <ImageField value={form.cover_image} onChange={v => setForm(f => ({...f, cover_image: v}))} label="封面圖" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormField label="分類"><Select value={form.category} onChange={v => setForm(f => ({...f, category: v}))} options={[{value:'general',label:'一般'},{value:'AI＆Web3',label:'AI＆Web3'},{value:'虛擬資產',label:'虛擬資產'},{value:'公告',label:'公告'},{value:'HKDG＆RWA',label:'HKDG＆RWA'}]} /></FormField>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 16 }}><Toggle checked={!!form.is_published} onChange={v => setForm(f => ({...f, is_published: v ? 1 : 0}))} label="發佈" /></div>
          </div>
          <ActionButton type="button" onClick={handleSave} pending={saving} style={{ fontSize: 13, marginTop: 8 }}>保存</ActionButton>
        </AdminCard>
      )}
      {loading && <LoadingState label="正在載入新聞..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && <div className="admin-list-stack">
        {items.map(item => (
          <div key={item.id} className="admin-content-row">
            {item.cover_image && <img src={item.cover_image} alt="" style={{ width: 80, height: 48, objectFit: 'cover', borderRadius: 8 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title_zh || item.title_en}</div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>{item.category} · {item.published_at ? new Date(item.published_at).toLocaleDateString() : '未發佈'}</div>
            </div>
            <span style={badge(!!item.is_published)}>{item.is_published ? '已發佈' : '草稿'}</span>
            <button type="button" onClick={() => { setEditing(item); setForm(item); setShowForm(true); }} className="admin-action">編輯</button>
            <button type="button" onClick={() => setDeleteTarget(item)} className="admin-action is-danger">刪除</button>
          </div>
        ))}
        {items.length === 0 && <EmptyState title="暫無新聞" description="建立一篇新聞後，前台會在最新動態中展示。" action={<button type="button" onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }} className="btn-secondary">新增新聞</button>} />}
      </div>}
      {deleteTarget && <ConfirmDialog title="刪除這篇新聞？" description={`刪除「${deleteTarget.title_zh || deleteTarget.title_en || '未命名新聞'}」後將無法復原。`} onCancel={() => setDeleteTarget(null)} onConfirm={remove} pending={deleting} />}
      {toast && <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
