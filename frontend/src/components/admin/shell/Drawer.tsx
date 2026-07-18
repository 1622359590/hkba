'use client';
// Overlay drawer mechanism (ui-interaction-system §5.1/§5.4).
//
// Side panels open as overlay drawers — they never permanently squeeze the
// canvas. Esc closes, backdrop click closes, focus lands on the close button
// for keyboard users. Pinning (canvas-narrowing preference) is a later
// enhancement; the mechanism is intentionally single-purpose now.

import { useEffect, useRef, ReactNode } from 'react';

export default function Drawer({
  open,
  side = 'right',
  title,
  subtitle,
  onClose,
  children,
  width,
}: {
  open: boolean;
  side?: 'left' | 'right';
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const timer = window.setTimeout(() => closeRef.current?.focus(), 40);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="hk-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className={`hk-drawer hk-drawer--${side}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        style={width ? { width: `min(${width}px, 92vw)` } : undefined}
      >
        <div className="hk-drawer__head">
          <div>
            <div className="hk-drawer__title">{title}</div>
            {subtitle ? <div className="hk-drawer__subtitle">{subtitle}</div> : null}
          </div>
          <button ref={closeRef} type="button" className="hk-drawer__close" onClick={onClose} aria-label="關閉面板">
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="hk-drawer__body">{children}</div>
      </aside>
    </>
  );
}
