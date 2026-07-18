'use client';
// Confirmation & undo bars (ui-interaction-system §12).
//
// Dangerous actions (publish, rollback, withdraw, permanent delete, published
// path changes) confirm through a bottom bar with plain-language consequences
// — not a centered modal that hides the context. Component deletion prefers a
// short-lived undo toast over a confirmation at all.

import { ReactNode } from 'react';

export function ConfirmBar({
  message,
  confirmLabel = '確認',
  cancelLabel = '取消',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={`hk-confirm-bar${danger ? ' hk-confirm-bar--danger' : ''}`} role="alertdialog" aria-live="assertive">
      <div className="hk-confirm-bar__message">{message}</div>
      <div className="hk-confirm-bar__actions">
        <button type="button" className="btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={danger ? 'btn-danger' : 'btn-accent'}
          style={{ padding: '8px 16px', fontSize: 13 }}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? '處理中…' : confirmLabel}
        </button>
      </div>
    </div>
  );
}

export function UndoToast({
  message,
  undoLabel = '復原',
  onUndo,
  onDismiss,
}: {
  message: ReactNode;
  undoLabel?: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="hk-undo-toast" role="status">
      <span>{message}</span>
      <button type="button" className="hk-undo-toast__action" onClick={onUndo}>
        {undoLabel}
      </button>
      <button type="button" className="hk-drawer__close" style={{ width: 28, height: 28 }} onClick={onDismiss} aria-label="關閉">
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
