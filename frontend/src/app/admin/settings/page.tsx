'use client';
import { useState } from 'react';
import { adminPost, adminRequestError } from '@/lib/adminApi';
import { FormField, Input, AdminCard } from '@/components/admin/FormControls';
import { ActionButton } from '@/components/admin/ActionButton';
import { Toast } from '@/components/ui/Feedback';

export default function SettingsAdmin() {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleChangePassword = async () => {
    if (!oldPw) { setMsg('請輸入舊密碼'); return; }
    if (newPw.length < 8) { setMsg('新密碼至少需要 8 個字符'); return; }
    if (newPw !== confirmPw) { setMsg('兩次密碼不一致'); return; }
    setSaving(true); setMsg('');
    try { await adminPost('/api/auth/change-password', { oldPassword: oldPw, newPassword: newPw }); setMsg('密碼修改成功'); setOldPw(''); setNewPw(''); setConfirmPw(''); setToast({ tone: 'success', message: '密碼已修改，請使用新密碼登入。' }); }
    catch (requestError) { setMsg(adminRequestError(requestError)); setToast({ tone: 'error', message: adminRequestError(requestError) }); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="admin-page-heading">
        <h1 className="admin-page-title">系統設置</h1>
      </div>
      <div style={{ maxWidth: 400 }}>
        <AdminCard title="修改密碼">
          <FormField label="舊密碼"><Input type="password" value={oldPw} onChange={setOldPw} /></FormField>
          <FormField label="新密碼"><Input type="password" value={newPw} onChange={setNewPw} /></FormField>
          <FormField label="確認新密碼"><Input type="password" value={confirmPw} onChange={setConfirmPw} /></FormField>
          {msg && <p style={{ fontSize: 13, color: msg.includes('成功') ? '#22c55e' : '#ef4444', marginBottom: 12 }}>{msg}</p>}
          <ActionButton type="button" onClick={handleChangePassword} pending={saving} style={{ fontSize: 13 }}>修改密碼</ActionButton>
        </AdminCard>
      </div>
      {toast && <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
