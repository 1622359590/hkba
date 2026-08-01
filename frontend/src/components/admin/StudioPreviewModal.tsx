'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type StudioPreviewSession = {
  token: string;
  revision: number;
  expiresAt: string;
};

type Device = 'desktop' | 'tablet' | 'mobile';

const DEVICE_LABELS: Record<Device, string> = {
  desktop: '桌面',
  tablet: '平板',
  mobile: '手機',
};

export default function StudioPreviewModal({
  session,
  title,
  refreshing,
  onRefresh,
  onClose,
}: {
  session: StudioPreviewSession | null;
  title: string;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}) {
  const [device, setDevice] = useState<Device>('desktop');
  const [frameLoading, setFrameLoading] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!session) return;
    setFrameLoading(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => closeRef.current?.focus(), 30);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], iframe, [tabindex]:not([tabindex="-1"])')
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, session]);

  if (!session || typeof document === 'undefined') return null;

  const expires = new Date(`${session.expiresAt.replace(' ', 'T')}Z`);
  const expiryLabel = Number.isNaN(expires.getTime())
    ? ''
    : expires.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });
  const previewUrl = `/preview/${session.token}?embed=1`;

  return createPortal(
    <div className="hk-preview-modal" role="presentation">
      <div ref={dialogRef} className="hk-preview-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="studio-preview-title">
        <header className="hk-preview-modal__toolbar">
          <div className="hk-preview-modal__identity">
            <span className="hk-preview-modal__eyebrow">實時預覽</span>
            <div id="studio-preview-title" className="hk-preview-modal__title">{title}</div>
            <span className="hk-preview-modal__meta">修訂 {session.revision}{expiryLabel ? ` · ${expiryLabel} 前有效` : ''}</span>
          </div>
          <div className="hk-preview-modal__devices" role="group" aria-label="預覽寬度">
            {(Object.keys(DEVICE_LABELS) as Device[]).map((item) => (
              <button key={item} type="button" className={device === item ? 'is-active' : ''} onClick={() => setDevice(item)}>
                {DEVICE_LABELS[item]}
              </button>
            ))}
          </div>
          <div className="hk-preview-modal__actions">
            <button type="button" className="hk-preview-modal__action" onClick={onRefresh} disabled={refreshing} aria-label="重新生成預覽">
              <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20 11a8 8 0 10-2.34 5.66M20 4v7h-7" /></svg>
              <span>{refreshing ? '更新中…' : '更新'}</span>
            </button>
            <a className="hk-preview-modal__action" href={previewUrl} target="_blank" rel="noreferrer">
              <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M14 5h5v5M19 5l-8 8M19 14v5H5V5h5" /></svg>
              <span>新視窗</span>
            </a>
            <button ref={closeRef} type="button" className="hk-preview-modal__close" onClick={onClose} aria-label="關閉預覽">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </header>
        <div className="hk-preview-modal__stage">
          <div className={`hk-preview-modal__frame hk-preview-modal__frame--${device}`}>
            {frameLoading ? <div className="hk-preview-modal__loading"><span />正在載入真實頁面…</div> : null}
            <iframe key={session.token} title={`${title} 預覽`} src={previewUrl} onLoad={() => setFrameLoading(false)} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
