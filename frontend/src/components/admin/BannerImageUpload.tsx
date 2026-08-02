'use client';

import { useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { parseBannerMediaUpload, validateBannerImageFiles } from '@/lib/bannerImageUpload.mjs';

type BannerImageUploadProps = {
  value: string;
  onChange: (url: string, filename?: string) => void;
  disabled?: boolean;
  onUploadingChange: (uploading: boolean) => void;
};

function filenameFromUrl(value: string): string {
  if (!value) return '';
  const segment = value.split('/').pop()?.split('?')[0] || '';
  try { return decodeURIComponent(segment); } catch { return segment; }
}

export default function BannerImageUpload({ value, onChange, disabled = false, onUploadingChange }: BannerImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [filename, setFilename] = useState('');
  const locked = disabled || uploading;

  const uploadFiles = async (files: FileList | File[]) => {
    const validation = validateBannerImageFiles(files);
    if (!validation.ok) {
      setError(validation.error || '圖片未通過校驗。');
      return;
    }

    setError('');
    setUploading(true);
    onUploadingChange(true);
    try {
      const form = new FormData();
      form.append('file', validation.file);
      const token = localStorage.getItem('hkba_admin_token');
      const response = await fetch('/api/admin/media/uploads', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error?.message || payload?.error || `上傳失敗（${response.status}）`;
        throw new Error(typeof message === 'string' ? message : `上傳失敗（${response.status}）`);
      }
      const uploaded = parseBannerMediaUpload(payload);
      const nextFilename = uploaded.originalFilename || validation.file.name;
      setFilename(nextFilename);
      onChange(uploaded.url, nextFilename);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上傳失敗，請稍後再試。');
    } finally {
      setUploading(false);
      onUploadingChange(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const openPicker = () => {
    if (!locked) inputRef.current?.click();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!locked) void uploadFiles(event.dataTransfer.files);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && !locked) {
      event.preventDefault();
      openPicker();
    }
  };

  const stopAnd = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.stopPropagation();
    action();
  };

  const displayFilename = filename || filenameFromUrl(value) || 'Banner 圖片';

  return (
    <div className="banner-image-upload-field">
      <div className="banner-image-upload-field__head">
        <span>Banner 圖片</span>
        <small>{value ? '已上傳' : '選填'}</small>
      </div>
      <div
        className={`banner-image-upload${dragging ? ' is-dragging' : ''}${value ? ' has-image' : ''}${locked ? ' is-disabled' : ''}`}
        role="button"
        tabIndex={locked ? -1 : 0}
        aria-disabled={locked}
        aria-label={value ? '更換 Banner 圖片' : '上傳 Banner 圖片'}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragEnter={(event) => { event.preventDefault(); if (!locked) setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={handleDrop}
      >
        {value ? (
          <>
            <img className="banner-image-upload__preview" src={value} alt="Banner 圖片預覽" />
            <div className="banner-image-upload__copy">
              <strong>{uploading ? '正在上傳圖片…' : displayFilename}</strong>
              <span>圖片已儲存至媒體庫，可更換或移除。</span>
            </div>
            <div className="banner-image-upload__actions">
              <button type="button" onClick={(event) => stopAnd(event, openPicker)} disabled={locked}>更換圖片</button>
              <button type="button" className="is-danger" onClick={(event) => stopAnd(event, () => { setFilename(''); setError(''); onChange(''); })} disabled={locked}>移除圖片</button>
            </div>
          </>
        ) : (
          <>
            <span className="banner-image-upload__icon" aria-hidden="true">▧</span>
            <div className="banner-image-upload__copy">
              <strong>{uploading ? '正在上傳圖片…' : dragging ? '放開以上傳圖片' : '拖動 Banner 圖片到這裡'}</strong>
              <span>或點擊選擇圖片 · JPG、PNG、WebP、AVIF、SVG · 建議 1920 × 720</span>
            </div>
            <button type="button" className="banner-image-upload__choose" onClick={(event) => stopAnd(event, openPicker)} disabled={locked}>選擇圖片</button>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        className="hk-visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
        onChange={(event) => void uploadFiles(event.target.files || [])}
        disabled={locked}
      />
      <div className="banner-image-upload-field__status" aria-live="polite">
        {uploading ? '圖片正在上傳並加入媒體庫。' : null}
      </div>
      {error ? <p className="banner-image-upload-field__error" role="alert">{error}</p> : null}
    </div>
  );
}
