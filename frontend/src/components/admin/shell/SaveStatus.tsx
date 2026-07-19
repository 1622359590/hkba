'use client';
// Autosave status indicator (ui-interaction-system §10).
//
// Four states only — saving / saved(at) / conflict / error(retry). Ordinary
// success never pops a toast; the quiet pill in the top bar is the whole
// feedback surface.

export type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

function formatTime(value: Date | null): string {
  if (!value) return '';
  const hh = String(value.getHours()).padStart(2, '0');
  const mm = String(value.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function SaveStatus({
  state,
  savedAt,
  onRetry,
}: {
  state: SaveState;
  savedAt: Date | null;
  onRetry?: () => void;
}) {
  if (state === 'idle') return null;

  if (state === 'saving') {
    return (
      <span className="hk-save-status hk-save-status--saving" role="status">
        <span className="hk-save-status__dot" />
        正在保存…
      </span>
    );
  }
  if (state === 'conflict') {
    return (
      <span className="hk-save-status hk-save-status--conflict" role="alert">
        <span className="hk-save-status__dot" />
        存在衝突
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="hk-save-status hk-save-status--error" role="alert">
        <span className="hk-save-status__dot" />
        保存失敗
        {onRetry ? (
          <button type="button" className="hk-save-status__retry" onClick={onRetry}>
            重試
          </button>
        ) : null}
      </span>
    );
  }
  return (
    <span className="hk-save-status hk-save-status--saved" role="status">
      <span className="hk-save-status__dot" />
      已保存{savedAt ? `於 ${formatTime(savedAt)}` : ''}
    </span>
  );
}
