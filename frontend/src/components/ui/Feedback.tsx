'use client';

import { ReactNode } from 'react';

export function LoadingState({ label = '載入中...' }: { label?: string }) {
  return (
    <div className="feedback-state feedback-state--loading" role="status" aria-live="polite">
      <span className="feedback-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="feedback-state feedback-state--empty">
      <div className="feedback-state__mark" aria-hidden="true">—</div>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action && <div className="feedback-state__action">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="feedback-state feedback-state--error" role="alert">
      <div className="feedback-state__mark" aria-hidden="true">!</div>
      <strong>暫時無法載入</strong>
      <p>{message}</p>
      {onRetry && <button type="button" onClick={onRetry} className="btn-secondary feedback-state__retry">重新載入</button>}
    </div>
  );
}

export function Toast({
  tone,
  message,
  onDismiss,
}: {
  tone: 'success' | 'error' | 'info';
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className={`feedback-toast feedback-toast--${tone}`} role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="關閉提示" className="feedback-toast__close">×</button>
    </div>
  );
}

type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel = '確認刪除',
  onConfirm,
  onCancel,
  pending = false,
}: ConfirmDialogProps) {
  return (
    <div className="feedback-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !pending) onCancel(); }}>
      <div className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title">
        <div className="feedback-dialog__eyebrow">請確認操作</div>
        <h2 id="feedback-dialog-title">{title}</h2>
        <p>{description}</p>
        <div className="feedback-dialog__actions">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={pending}>取消</button>
          <button type="button" onClick={onConfirm} className="btn-danger" disabled={pending} aria-busy={pending}>
            {pending ? '處理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
