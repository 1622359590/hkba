'use client';

import { useState } from 'react';
import { adminDelete, adminPost, adminPut, adminRequestError } from '@/lib/adminApi';
import { moveTeamGroup } from '@/lib/teamGroupOrder.mjs';
import { ConfirmDialog, Toast } from '@/components/ui/Feedback';

export type TeamGroup = {
  code: string;
  label_zh: string;
  label_en: string;
  sort_order: number;
  is_active: number;
  is_legacy: number;
  member_count: number;
};

type GroupDraft = { code: string; label_zh: string; label_en: string };
const emptyDraft: GroupDraft = { code: '', label_zh: '', label_en: '' };

export default function TeamGroupManager({
  groups,
  onChange,
  onReload,
}: {
  groups: TeamGroup[];
  onChange: (groups: TeamGroup[]) => void;
  onReload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<GroupDraft | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragCode, setDragCode] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);

  const persistOrder = async (nextCodes: string[], previous: TeamGroup[]) => {
    const byCode = new Map(groups.map((group) => [group.code, group]));
    onChange(nextCodes.map((code, index) => ({ ...byCode.get(code)!, sort_order: (index + 1) * 10 })));
    try {
      await adminPut('/api/team/groups/order', { codes: nextCodes });
      await onReload();
    } catch (error) {
      onChange(previous);
      setToast({ tone: 'error', message: adminRequestError(error) });
    }
  };

  const move = (code: string, direction: -1 | 1) => {
    const previous = groups;
    const nextCodes = moveTeamGroup(groups.map((group) => group.code), code, direction);
    if (nextCodes.every((entry, index) => entry === previous[index]?.code)) return;
    void persistOrder(nextCodes, previous);
  };

  const dropBefore = (targetCode: string) => {
    if (!dragCode || dragCode === targetCode) return;
    const previous = groups;
    const codes = groups.map((group) => group.code).filter((code) => code !== dragCode);
    codes.splice(codes.indexOf(targetCode), 0, dragCode);
    setDragCode(null);
    void persistOrder(codes, previous);
  };

  const openCreate = () => { setEditingCode(null); setDraft(emptyDraft); };
  const openEdit = (group: TeamGroup) => {
    setEditingCode(group.code);
    setDraft({ code: group.code, label_zh: group.label_zh, label_en: group.label_en });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      if (editingCode) await adminPut(`/api/team/groups/${editingCode}`, { label_zh: draft.label_zh, label_en: draft.label_en });
      else await adminPost('/api/team/groups', draft);
      setDraft(null);
      await onReload();
      setToast({ tone: 'success', message: editingCode ? '身份名稱已更新。' : '身份已建立。' });
    } catch (error) {
      setToast({ tone: 'error', message: adminRequestError(error) });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (group: TeamGroup) => {
    try {
      await adminPut(`/api/team/groups/${group.code}`, {
        label_zh: group.label_zh,
        label_en: group.label_en,
        is_active: !group.is_active,
      });
      await onReload();
    } catch (error) {
      setToast({ tone: 'error', message: adminRequestError(error) });
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await adminDelete(`/api/team/groups/${deleteTarget.code}`);
      setDeleteTarget(null);
      await onReload();
      setToast({ tone: 'success', message: '身份已刪除。' });
    } catch (error) {
      setToast({ tone: 'error', message: adminRequestError(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hk-team-groups">
      <div className="hk-team-groups__intro">
        <div><h2>身份結構</h2><p>身份順序會成為會員組件的全局預設順序。</p></div>
        <button type="button" className="btn-accent" onClick={openCreate}>＋ 新增身份</button>
      </div>
      <div className="hk-team-groups__list">
        {groups.map((group, index) => (
          <div
            key={group.code}
            className={`hk-team-group-row${dragCode === group.code ? ' is-dragging' : ''}`}
            draggable
            onDragStart={() => setDragCode(group.code)}
            onDragEnd={() => setDragCode(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropBefore(group.code)}
          >
            <span className="hk-team-group-row__drag" aria-hidden="true">⠿</span>
            <div className="hk-team-group-row__copy">
              <strong>{group.label_zh}</strong><span>{group.label_en}</span><code>{group.code}</code>
            </div>
            <span className="hk-team-group-row__count">{group.member_count} 位成員</span>
            <span className={`hk-team-group-row__status${group.is_active ? ' is-active' : ''}`}>{group.is_active ? '啟用' : '停用'}</span>
            <div className="hk-team-group-row__actions">
              <button type="button" onClick={() => move(group.code, -1)} disabled={index === 0} aria-label={`${group.label_zh}向上`}>↑</button>
              <button type="button" onClick={() => move(group.code, 1)} disabled={index === groups.length - 1} aria-label={`${group.label_zh}向下`}>↓</button>
              <button type="button" onClick={() => void toggle(group)}>{group.is_active ? '停用' : '啟用'}</button>
              <button type="button" onClick={() => openEdit(group)}>編輯</button>
              <button
                type="button"
                className="is-danger"
                onClick={() => group.member_count ? setToast({ tone: 'info', message: `請先轉移 ${group.member_count} 位成員。` }) : setDeleteTarget(group)}
              >刪除</button>
            </div>
          </div>
        ))}
      </div>

      {draft ? (
        <div className="admin-editor-modal" role="presentation">
          <section className="admin-editor-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="group-editor-title">
            <header className="admin-editor-modal__header">
              <div><span className="admin-editor-modal__eyebrow">身份結構</span><h2 id="group-editor-title">{editingCode ? '編輯身份' : '新增身份'}</h2></div>
              <button type="button" className="admin-editor-modal__close" onClick={() => setDraft(null)} aria-label="關閉">×</button>
            </header>
            <div className="admin-editor-modal__body">
              <label className="hk-team-group-field"><span>身份代碼</span><input className="form-input" value={draft.code} disabled={Boolean(editingCode)} onChange={(event) => setDraft({ ...draft, code: event.target.value.toLowerCase() })} placeholder="example_role" /></label>
              <label className="hk-team-group-field"><span>繁體中文名稱</span><input className="form-input" value={draft.label_zh} onChange={(event) => setDraft({ ...draft, label_zh: event.target.value })} /></label>
              <label className="hk-team-group-field"><span>English name</span><input className="form-input" value={draft.label_en} onChange={(event) => setDraft({ ...draft, label_en: event.target.value })} /></label>
            </div>
            <footer className="admin-editor-modal__footer"><button type="button" className="btn-secondary" onClick={() => setDraft(null)}>取消</button><button type="button" className="btn-accent" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存身份'}</button></footer>
          </section>
        </div>
      ) : null}
      {deleteTarget ? <ConfirmDialog title="刪除這個身份？" description={`將刪除「${deleteTarget.label_zh}」。身份代碼建立後不會保留。`} onCancel={() => setDeleteTarget(null)} onConfirm={remove} pending={saving} /> : null}
      {toast ? <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
