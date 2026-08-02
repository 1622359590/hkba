'use client';

import { useRef, useState } from 'react';

type UploadedAsset = { id: string; originalFilename?: string; kind?: string };

export default function MediaField({
  value,
  onChange,
  label,
  required = false,
  onPickMedia,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  onPickMedia: (apply: (mediaId: string | null) => void) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [filename, setFilename] = useState('');

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const token = localStorage.getItem('hkba_admin_token');
      const response = await fetch('/api/admin/media/uploads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-requested-with': 'XMLHttpRequest', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || body?.error || `上傳失敗（${response.status}）`);
      const asset = body?.data?.asset as UploadedAsset | undefined;
      if (!asset?.id) throw new Error('伺服器沒有返回媒體編號');
      setFilename(asset.originalFilename || file.name);
      onChange(asset.id);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上傳失敗，請稍後再試');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="hk-field hk-media-field">
      <div className="hk-field__head">
        <span className="hk-field__label">{label}{required ? <small>必填</small> : null}</span>
        <span className="hk-field__meta">{value ? '已選擇' : '選填'}</span>
      </div>
      <div
        className={`hk-media-drop${dragging ? ' is-dragging' : ''}${value ? ' has-value' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files?.[0]); }}
      >
        <div className="hk-media-drop__icon" aria-hidden="true">▧</div>
        <div className="hk-media-drop__copy">
          <strong>{uploading ? '正在上傳…' : value ? filename || '已連結媒體資產' : '拖放圖片或 PDF 到這裡'}</strong>
          <span>{value ? `媒體 ID：${value}` : 'JPEG、PNG、WebP、AVIF、SVG（15MB）；PDF（30MB）'}</span>
        </div>
        <div className="hk-media-drop__actions">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>{value ? '替換' : '上傳'}</button>
          <button type="button" onClick={() => onPickMedia((id) => { if (id) onChange(id); })} disabled={uploading}>媒體庫</button>
          {value ? <button type="button" className="is-danger" onClick={() => { setFilename(''); onChange(''); }} disabled={uploading}>移除</button> : null}
        </div>
      </div>
      <input ref={inputRef} className="hk-visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml,application/pdf" onChange={(event) => void upload(event.target.files?.[0])} />
      {error ? <p className="hk-field__error" role="alert">{error}</p> : null}
    </div>
  );
}
