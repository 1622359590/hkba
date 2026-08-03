'use client';
import { useEffect, useState } from 'react';
import { adminGetData, adminPatchData, adminPost, adminPostData, adminRequestError } from '@/lib/adminApi';
import { FormField, Input, AdminCard, Toggle } from '@/components/admin/FormControls';
import { ActionButton } from '@/components/admin/ActionButton';
import { Toast } from '@/components/ui/Feedback';

export default function SettingsAdmin() {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [ossLoading, setOssLoading] = useState(true);
  const [ossSaving, setOssSaving] = useState(false);
  const [ossTesting, setOssTesting] = useState(false);
  const [oss, setOss] = useState({
    enabled: false,
    region: 'oss-cn-hongkong',
    endpoint: '',
    bucket: '',
    accessKeyId: '',
    accessKeySecret: '',
    accessKeyIdMasked: '',
    accessKeySecretMasked: '',
    hasCredentials: false,
    customDomain: '',
    objectPrefix: 'hkba/media',
  });

  useEffect(() => {
    adminGetData<{ settings: typeof oss }>('/api/admin/storage-settings')
      .then(({ settings }) => setOss((current) => ({ ...current, ...settings, accessKeyId: '', accessKeySecret: '' })))
      .catch((error) => setToast({ tone: 'error', message: adminRequestError(error) }))
      .finally(() => setOssLoading(false));
  }, []);

  const updateOss = (key: keyof typeof oss, value: string | boolean) => setOss((current) => ({ ...current, [key]: value }));
  const endpointHost = oss.endpoint.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || `${oss.region.trim() || 'oss-cn-hongkong'}.aliyuncs.com`;
  const publicBaseUrl = oss.customDomain.trim().replace(/\/$/, '') || (oss.bucket.trim() ? `https://${oss.bucket.trim()}.${endpointHost}` : '');

  const ossPayload = () => ({
    enabled: oss.enabled,
    region: oss.region,
    endpoint: oss.endpoint,
    bucket: oss.bucket,
    accessKeyId: oss.accessKeyId,
    accessKeySecret: oss.accessKeySecret,
    customDomain: oss.customDomain,
    objectPrefix: oss.objectPrefix,
  });

  const handleSaveOss = async () => {
    setOssSaving(true);
    try {
      const { settings } = await adminPatchData<{ settings: typeof oss }>('/api/admin/storage-settings', ossPayload());
      setOss((current) => ({ ...current, ...settings, accessKeyId: '', accessKeySecret: '' }));
      setToast({ tone: 'success', message: settings.enabled ? 'OSS 已啟用，新上傳將儲存到阿里雲。' : '已切換至本地儲存。' });
    } catch (error) {
      setToast({ tone: 'error', message: adminRequestError(error) });
    } finally {
      setOssSaving(false);
    }
  };

  const handleTestOss = async () => {
    setOssTesting(true);
    try {
      const result = await adminPostData<{ connected: boolean; message: string }>('/api/admin/storage-settings/test', ossPayload());
      setToast({ tone: result.connected ? 'success' : 'error', message: result.message });
    } catch (error) {
      setToast({ tone: 'error', message: adminRequestError(error) });
    } finally {
      setOssTesting(false);
    }
  };

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
      <div className="admin-settings-grid">
        <AdminCard title="修改密碼">
          <FormField label="舊密碼"><Input type="password" value={oldPw} onChange={setOldPw} /></FormField>
          <FormField label="新密碼"><Input type="password" value={newPw} onChange={setNewPw} /></FormField>
          <FormField label="確認新密碼"><Input type="password" value={confirmPw} onChange={setConfirmPw} /></FormField>
          {msg && <p style={{ fontSize: 13, color: msg.includes('成功') ? '#22c55e' : '#ef4444', marginBottom: 12 }}>{msg}</p>}
          <ActionButton type="button" onClick={handleChangePassword} pending={saving} style={{ fontSize: 13 }}>修改密碼</ActionButton>
        </AdminCard>
        <AdminCard
          title="阿里雲 OSS"
          actions={<span className={`admin-storage-status${oss.enabled ? ' is-active' : ''}`}>{oss.enabled ? '使用中' : '本地儲存'}</span>}
        >
          {ossLoading ? (
            <div className="admin-settings-loading">載入儲存配置...</div>
          ) : (
            <>
              <div className="admin-storage-toggle">
                <Toggle checked={oss.enabled} onChange={(value) => updateOss('enabled', value)} label="啟用阿里雲 OSS" />
                <span>{oss.enabled ? '新媒體將上傳至 OSS' : '新媒體保存在伺服器本地'}</span>
              </div>
              <div className="admin-storage-fields">
                <FormField label="Region" required><Input value={oss.region} onChange={(value) => updateOss('region', value)} placeholder="oss-cn-hongkong" /></FormField>
                <FormField label="Bucket" required><Input value={oss.bucket} onChange={(value) => updateOss('bucket', value)} placeholder="hkba-media" /></FormField>
                <FormField label="外網 Endpoint"><Input value={oss.endpoint} onChange={(value) => updateOss('endpoint', value)} placeholder="https://oss-cn-hongkong.aliyuncs.com" /></FormField>
                <FormField label="自訂 CDN 域名"><Input value={oss.customDomain} onChange={(value) => updateOss('customDomain', value)} placeholder="https://cdn.hkba.club" /></FormField>
                <FormField label="AccessKey ID" required>
                  <Input type="password" value={oss.accessKeyId} onChange={(value) => updateOss('accessKeyId', value)} placeholder={oss.accessKeyIdMasked || '輸入 AccessKey ID'} />
                </FormField>
                <FormField label="AccessKey Secret" required>
                  <Input type="password" value={oss.accessKeySecret} onChange={(value) => updateOss('accessKeySecret', value)} placeholder={oss.accessKeySecretMasked || '輸入 AccessKey Secret'} />
                </FormField>
                <FormField label="儲存目錄"><Input value={oss.objectPrefix} onChange={(value) => updateOss('objectPrefix', value)} placeholder="hkba/media" /></FormField>
                <div className="admin-storage-public-url">
                  <span>OSS 外網訪問地址</span>
                  <strong>{publicBaseUrl || '填寫 Bucket 後自動生成'}</strong>
                  <small>上傳後的公開文件將使用此域名；配置 CDN 時會優先使用 CDN 域名。</small>
                </div>
              </div>
              <div className="admin-storage-actions">
                <ActionButton type="button" variant="secondary" pending={ossTesting} onClick={handleTestOss}>測試連接</ActionButton>
                <ActionButton type="button" pending={ossSaving} onClick={handleSaveOss}>保存配置</ActionButton>
              </div>
            </>
          )}
        </AdminCard>
      </div>
      {toast && <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
