'use client';
import { useEffect, useState } from 'react';
import { adminGet, adminPost, adminPut, adminDelete, adminRequestError, notifyAdminDataChanged } from '@/lib/adminApi';
import { FormField, Input, BilingualField, ImageField, Toggle, AdminCard } from '@/components/admin/FormControls';
import { ActionButton } from '@/components/admin/ActionButton';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, Toast } from '@/components/ui/Feedback';

interface EventItem { id: number; title_zh: string; title_en: string; description_zh: string; description_en: string; content_zh: string; content_en: string; cover_image: string; event_date: string; end_date: string; location_zh: string; location_en: string; max_attendees: number; registration_url: string; is_published: number; }
const empty = { title_zh:'', title_en:'', description_zh:'', description_en:'', content_zh:'', content_en:'', cover_image:'', event_date:'', end_date:'', location_zh:'', location_en:'', max_attendees:0, registration_url:'', is_published:0 };
const badge = (pub: boolean): React.CSSProperties => ({ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: pub ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: pub ? '#22c55e' : '#f59e0b' });

export default function EventsAdmin() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
  const load = async () => {
    setLoading(true); setError('');
    try { setItems(await adminGet<EventItem[]>('/api/events/admin/all')); } catch (requestError) { setError(adminRequestError(requestError)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.title_zh.trim() && !form.title_en.trim()) { setToast({ tone: 'error', message: '請至少填寫一個活動名稱。' }); return; }
    setSaving(true);
    try {
      if (editing) await adminPut(`/api/events/${editing.id}`, form); else await adminPost('/api/events', form);
      setShowForm(false); setEditing(null); setForm(empty); notifyAdminDataChanged('content-updated'); setToast({ tone: 'success', message: '活動已保存。' }); await load();
    } catch (requestError) { setToast({ tone: 'error', message: adminRequestError(requestError) }); } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await adminDelete(`/api/events/${deleteTarget.id}`); setDeleteTarget(null); notifyAdminDataChanged('content-updated'); setToast({ tone: 'success', message: '活動已刪除。' }); await load(); }
    catch (requestError) { setToast({ tone: 'error', message: adminRequestError(requestError) }); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="admin-page-heading">
        <h1 className="admin-page-title">活動管理</h1>
        <button onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }} className="btn-accent" style={{ fontSize: 13 }}>+ 新增活動</button>
      </div>
      {showForm && (
        <AdminCard title={editing ? '編輯活動' : '新增活動'} actions={<button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="admin-action is-muted">取消</button>}>
          <BilingualField label="活動名稱" valueZh={form.title_zh} valueEn={form.title_en} onChangeZh={v => setForm(f => ({...f, title_zh: v}))} onChangeEn={v => setForm(f => ({...f, title_en: v}))} required />
          <BilingualField label="描述" type="textarea" rows={3} valueZh={form.description_zh} valueEn={form.description_en} onChangeZh={v => setForm(f => ({...f, description_zh: v}))} onChangeEn={v => setForm(f => ({...f, description_en: v}))} />
          <ImageField value={form.cover_image} onChange={v => setForm(f => ({...f, cover_image: v}))} label="封面圖" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormField label="開始日期"><Input type="datetime-local" value={form.event_date} onChange={v => setForm(f => ({...f, event_date: v}))} /></FormField>
            <FormField label="結束日期"><Input type="datetime-local" value={form.end_date} onChange={v => setForm(f => ({...f, end_date: v}))} /></FormField>
          </div>
          <BilingualField label="地點" valueZh={form.location_zh} valueEn={form.location_en} onChangeZh={v => setForm(f => ({...f, location_zh: v}))} onChangeEn={v => setForm(f => ({...f, location_en: v}))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormField label="報名連結"><Input value={form.registration_url} onChange={v => setForm(f => ({...f, registration_url: v}))} /></FormField>
            <FormField label="最大人數"><Input type="number" value={String(form.max_attendees)} onChange={v => setForm(f => ({...f, max_attendees: +v}))} /></FormField>
          </div>
          <Toggle checked={!!form.is_published} onChange={v => setForm(f => ({...f, is_published: v ? 1 : 0}))} label="發佈" />
          <ActionButton type="button" onClick={handleSave} pending={saving} style={{ fontSize: 13, marginTop: 12 }}>保存</ActionButton>
        </AdminCard>
      )}
      {loading && <LoadingState label="正在載入活動..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && <div className="admin-list-stack">
        {items.map(item => (
          <div key={item.id} className="admin-content-row">
            {item.cover_image && <img src={item.cover_image} alt="" style={{ width: 80, height: 48, objectFit: 'cover', borderRadius: 8 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{item.title_zh || item.title_en}</div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>{item.event_date ? new Date(item.event_date).toLocaleDateString() : '-'} · {item.location_zh || item.location_en || '-'}</div>
            </div>
            <span style={badge(!!item.is_published)}>{item.is_published ? '已發佈' : '草稿'}</span>
            <button type="button" onClick={() => { setEditing(item); setForm(item); setShowForm(true); }} className="admin-action">編輯</button>
            <button type="button" onClick={() => setDeleteTarget(item)} className="admin-action is-danger">刪除</button>
          </div>
        ))}
        {items.length === 0 && <EmptyState title="暫無活動" description="建立活動後，訪客可以在活動中心查看。" action={<button type="button" onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }} className="btn-secondary">新增活動</button>} />}
      </div>}
      {deleteTarget && <ConfirmDialog title="刪除這個活動？" description={`刪除「${deleteTarget.title_zh || deleteTarget.title_en || '未命名活動'}」後將無法復原。`} onCancel={() => setDeleteTarget(null)} onConfirm={remove} pending={deleting} />}
      {toast && <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
