'use client';
import { useEffect, useState } from 'react';
import { adminGet, adminPost, adminPut, adminDelete, adminRequestError, notifyAdminDataChanged } from '@/lib/adminApi';
import { FormField, Input, BilingualField, ImageField, Select, Toggle } from '@/components/admin/FormControls';
import { ActionButton } from '@/components/admin/ActionButton';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, Toast } from '@/components/ui/Feedback';
import TeamGroupManager, { TeamGroup } from '@/components/admin/team/TeamGroupManager';

interface TeamMember { id: number; name_zh: string; name_en: string; title_zh: string; title_en: string; bio_zh: string; bio_en: string; avatar_url: string; group_name: string; social_facebook: string; social_twitter: string; social_linkedin: string; social_instagram: string; sort_order: number; is_active: number; }
const empty = { name_zh:'', name_en:'', title_zh:'', title_en:'', bio_zh:'', bio_en:'', avatar_url:'', group_name:'committee', social_facebook:'', social_twitter:'', social_linkedin:'', social_instagram:'', sort_order:0, is_active:1 };

export default function TeamAdmin() {
  const [items, setItems] = useState<TeamMember[]>([]);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [activeTab, setActiveTab] = useState<'members' | 'groups'>('members');
  const loadGroups = async () => {
    const rows = await adminGet<TeamGroup[]>('/api/team/groups/all');
    setGroups(rows);
  };
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [members, identityGroups] = await Promise.all([
        adminGet<TeamMember[]>('/api/team/all'),
        adminGet<TeamGroup[]>('/api/team/groups/all'),
      ]);
      setItems(members); setGroups(identityGroups);
    } catch (requestError) { setError(adminRequestError(requestError)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!showForm) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        setShowForm(false);
        setEditing(null);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [showForm, saving]);

  const handleSave = async () => {
    if (!form.name_zh.trim() && !form.name_en.trim()) { setToast({ tone: 'error', message: '請至少填寫一個姓名。' }); return; }
    if (!form.title_zh.trim() && !form.title_en.trim()) { setToast({ tone: 'error', message: '請至少填寫一個職位。' }); return; }
    setSaving(true);
    try {
      if (editing) await adminPut(`/api/team/${editing.id}`, form); else await adminPost('/api/team', form);
      setShowForm(false); setEditing(null); setForm(empty); notifyAdminDataChanged('content-updated'); setToast({ tone: 'success', message: '團隊資料已保存。' }); await load();
    } catch (requestError) { setToast({ tone: 'error', message: adminRequestError(requestError) }); } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await adminDelete(`/api/team/${deleteTarget.id}`); setDeleteTarget(null); notifyAdminDataChanged('content-updated'); setToast({ tone: 'success', message: '團隊資料已刪除。' }); await load(); }
    catch (requestError) { setToast({ tone: 'error', message: adminRequestError(requestError) }); }
    finally { setDeleting(false); }
  };

  const groupOptions = groups
    .filter((group) => group.is_active || group.code === editing?.group_name)
    .map((group) => ({ value: group.code, label: `${group.label_zh}${group.is_active ? '' : '（已停用）'}` }));

  return (
    <div>
      <div className="admin-page-heading">
        <h1 className="admin-page-title">團隊管理</h1>
        {activeTab === 'members' ? <button onClick={() => { setEditing(null); setForm({ ...empty, group_name: groups.find((group) => group.is_active)?.code || 'committee' }); setShowForm(true); }} className="btn-accent" style={{ fontSize: 13 }}>+ 新增成員</button> : null}
      </div>
      <div className="hk-team-tabs" role="tablist" aria-label="團隊管理分頁">
        <button type="button" role="tab" aria-selected={activeTab === 'members'} className={activeTab === 'members' ? 'is-active' : ''} onClick={() => setActiveTab('members')}>成員管理</button>
        <button type="button" role="tab" aria-selected={activeTab === 'groups'} className={activeTab === 'groups' ? 'is-active' : ''} onClick={() => setActiveTab('groups')}>身份結構</button>
      </div>
      {activeTab === 'groups' ? <TeamGroupManager groups={groups} onChange={setGroups} onReload={loadGroups} /> : null}
      {activeTab === 'members' && showForm && (
        <div className="admin-editor-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) { setShowForm(false); setEditing(null); } }}>
          <section className="admin-editor-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="team-editor-title">
            <header className="admin-editor-modal__header">
              <div>
                <span className="admin-editor-modal__eyebrow">團隊資料</span>
                <h2 id="team-editor-title">{editing ? '編輯成員' : '新增成員'}</h2>
              </div>
              <button type="button" className="admin-editor-modal__close" onClick={() => { setShowForm(false); setEditing(null); }} aria-label="關閉編輯視窗" disabled={saving}>×</button>
            </header>
            <div className="admin-editor-modal__body">
              <BilingualField label="姓名" valueZh={form.name_zh} valueEn={form.name_en} onChangeZh={v => setForm(f => ({...f, name_zh: v}))} onChangeEn={v => setForm(f => ({...f, name_en: v}))} required />
              <BilingualField label="職位" valueZh={form.title_zh} valueEn={form.title_en} onChangeZh={v => setForm(f => ({...f, title_zh: v}))} onChangeEn={v => setForm(f => ({...f, title_en: v}))} required />
              <BilingualField label="簡介" type="textarea" valueZh={form.bio_zh} valueEn={form.bio_en} onChangeZh={v => setForm(f => ({...f, bio_zh: v}))} onChangeEn={v => setForm(f => ({...f, bio_en: v}))} />
              <ImageField value={form.avatar_url} onChange={v => setForm(f => ({...f, avatar_url: v}))} label="頭像" />
              <div className="admin-editor-modal__grid">
                <FormField label="身份"><Select value={form.group_name} onChange={v => setForm(f => ({...f, group_name: v}))} options={groupOptions} /></FormField>
                <FormField label="排序"><Input type="number" value={String(form.sort_order)} onChange={v => setForm(f => ({...f, sort_order: +v}))} /></FormField>
              </div>
              <div className="admin-editor-modal__socials">
                <FormField label="Facebook"><Input value={form.social_facebook} onChange={v => setForm(f => ({...f, social_facebook: v}))} placeholder="https://facebook.com/..." /></FormField>
                <FormField label="X / Twitter"><Input value={form.social_twitter} onChange={v => setForm(f => ({...f, social_twitter: v}))} placeholder="https://x.com/..." /></FormField>
                <FormField label="LinkedIn"><Input value={form.social_linkedin} onChange={v => setForm(f => ({...f, social_linkedin: v}))} placeholder="https://linkedin.com/in/..." /></FormField>
                <FormField label="Instagram"><Input value={form.social_instagram} onChange={v => setForm(f => ({...f, social_instagram: v}))} placeholder="https://instagram.com/..." /></FormField>
              </div>
              <Toggle checked={!!form.is_active} onChange={v => setForm(f => ({...f, is_active: v ? 1 : 0}))} label="啟用" />
            </div>
            <footer className="admin-editor-modal__footer">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary" disabled={saving}>取消</button>
              <ActionButton type="button" onClick={handleSave} pending={saving}>保存成員</ActionButton>
            </footer>
          </section>
        </div>
      )}
      {activeTab === 'members' && loading && <LoadingState label="正在載入團隊資料..." />}
      {activeTab === 'members' && !loading && error && <ErrorState message={error} onRetry={load} />}
      {activeTab === 'members' && !loading && !error && <div className="admin-list-stack">
        {items.map(item => (
          <div key={item.id} className="admin-content-row">
            {item.avatar_url && <img src={item.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{item.name_zh || item.name_en}</div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>{item.title_zh || item.title_en} · {groups.find(g => g.code === item.group_name)?.label_zh || item.group_name}</div>
            </div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: item.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(113,113,122,0.1)', color: item.is_active ? '#22c55e' : '#71717a' }}>{item.is_active ? '啟用' : '停用'}</span>
            <button type="button" onClick={() => { setEditing(item); setForm(item); setShowForm(true); }} className="admin-action">編輯</button>
            <button type="button" onClick={() => setDeleteTarget(item)} className="admin-action is-danger">刪除</button>
          </div>
        ))}
        {items.length === 0 && <EmptyState title="暫無團隊成員" description="新增顧問或委員資料後，前台會展示正式身份與職位。" action={<button type="button" onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }} className="btn-secondary">新增成員</button>} />}
      </div>}
      {deleteTarget && <ConfirmDialog title="刪除這位團隊成員？" description={`刪除「${deleteTarget.name_zh || deleteTarget.name_en || '未命名成員'}」後將無法復原。`} onCancel={() => setDeleteTarget(null)} onConfirm={remove} pending={deleting} />}
      {toast && <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
