'use client';
import { useEffect, useState } from 'react';
import { adminDelete, adminGet, adminPut } from '@/lib/adminApi';
import { adminRequestError, notifyAdminDataChanged } from '@/lib/adminApi';
import { ActionButton } from '@/components/admin/ActionButton';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, Toast } from '@/components/ui/Feedback';

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  is_read: number;
  created_at: string;
}

export default function MessagesAdmin() {
  const [items, setItems] = useState<ContactMessage[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState('');
  const [toast, setToast] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactMessage | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await adminGet<ContactMessage[]>('/api/contact/messages'));
    } catch (requestError) {
      setError(adminRequestError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: number) => {
    setPendingId(`read:${id}`);
    try {
      await adminPut(`/api/contact/messages/${id}/read`, {});
      notifyAdminDataChanged('messages-updated');
      setToast({ tone: 'success', message: '留言已標記為已讀。' });
      await load();
    } catch (requestError) {
      setToast({ tone: 'error', message: adminRequestError(requestError) });
    } finally {
      setPendingId('');
    }
  };

  const remove = async (id: number) => {
    setPendingId(`delete:${id}`);
    try {
      await adminDelete(`/api/contact/messages/${id}`);
      notifyAdminDataChanged('messages-updated');
      setDeleteTarget(null);
      setToast({ tone: 'success', message: '留言已刪除。' });
      await load();
    } catch (requestError) {
      setToast({ tone: 'error', message: adminRequestError(requestError) });
    } finally {
      setPendingId('');
    }
  };

  return (
    <div>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">留言管理</h1>
          <p className="admin-page-desc">查看前台聯絡表單提交，已處理後可標記已讀或刪除。</p>
        </div>
        <ActionButton type="button" onClick={load} pending={loading} variant="secondary" style={{ fontSize: 13 }}>刷新</ActionButton>
      </div>
      {loading && <LoadingState label="正在載入留言..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && <div className="admin-list-stack">
        {items.map(item => (
          <div key={item.id} className="admin-content-row" style={{ display: 'block', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{item.subject || '無主旨'}</h2>
                  {!item.is_read && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>未讀</span>}
                </div>
                <div style={{ fontSize: 12, color: '#71717a' }}>
                  {item.name} · <a href={`mailto:${item.email}`} style={{ color: 'var(--cyan)', textDecoration: 'none' }}>{item.email}</a>
                  {item.created_at && <> · {new Date(item.created_at).toLocaleString('zh-HK')}</>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {!item.is_read && <ActionButton type="button" onClick={() => markRead(item.id)} pending={pendingId === `read:${item.id}`} variant="muted" className="admin-action">標記已讀</ActionButton>}
                <ActionButton type="button" onClick={() => setDeleteTarget(item)} pending={pendingId === `delete:${item.id}`} variant="danger" className="admin-action is-danger">刪除</ActionButton>
              </div>
            </div>
            <p style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{item.message}</p>
          </div>
        ))}
      </div>}
      {!loading && !error && items.length === 0 && <EmptyState title="暫無留言" description="前台聯絡表單的新提交會在這裡顯示。" />}
      {deleteTarget && <ConfirmDialog title="刪除這則留言？" description={`刪除「${deleteTarget.subject || '無主旨'}」後將無法復原。`} onCancel={() => setDeleteTarget(null)} onConfirm={() => remove(deleteTarget.id)} pending={pendingId === `delete:${deleteTarget.id}`} />}
      {toast && <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
