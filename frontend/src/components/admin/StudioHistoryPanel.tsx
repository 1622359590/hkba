'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/Feedback';

export type DraftChangeSummary = {
  baseline?: boolean;
  added?: Array<{ blockId: string; componentType: string }>;
  removed?: Array<{ blockId: string; componentType: string }>;
  moved?: Array<{ blockId: string; componentType: string }>;
  changed?: Array<{ blockId: string; componentType: string; fields: string[] }>;
  seoFields?: string[];
};

export type DraftSnapshot = {
  id: string;
  revision: number;
  createdAt: string;
  createdByName: string | null;
  blockCount: number;
  summary: DraftChangeSummary;
};

export type PublishedVersion = {
  id: string;
  revision: number;
  status: 'published' | 'superseded';
  createdAt: string;
  publishedAt: string | null;
  blockCount: number;
};

export type StudioHistory = {
  currentDraft: { id: string; revision: number; blockCount: number; updatedAt: string } | null;
  snapshots: DraftSnapshot[];
  publishedVersions: PublishedVersion[];
  publishedVersionId: string | null;
};

function summaryLines(summary: DraftChangeSummary): string[] {
  if (summary.baseline) return ['建立初始快照'];
  const lines: string[] = [];
  if (summary.added?.length) lines.push(`新增 ${summary.added.length} 個組件`);
  if (summary.removed?.length) lines.push(`移除 ${summary.removed.length} 個組件`);
  if (summary.moved?.length) lines.push(`調整 ${summary.moved.length} 個組件的位置`);
  if (summary.changed?.length) lines.push(`修改 ${summary.changed.length} 個組件的內容或設置`);
  if (summary.seoFields?.length) lines.push(`更新 SEO：${summary.seoFields.join('、')}`);
  return lines.length ? lines : ['保存修訂（內容無可見差異）'];
}

export default function StudioHistoryPanel({
  history,
  loading,
  busyKey,
  onPreviewSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onRestorePublished,
}: {
  history: StudioHistory | null;
  loading: boolean;
  busyKey: string | null;
  onPreviewSnapshot: (snapshot: DraftSnapshot) => Promise<void>;
  onRestoreSnapshot: (snapshot: DraftSnapshot) => Promise<void>;
  onDeleteSnapshot: (snapshot: DraftSnapshot) => Promise<void>;
  onRestorePublished: (version: PublishedVersion) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'restore' | 'delete'; snapshot: DraftSnapshot } | null>(null);

  if (loading) return <div className="hk-history-empty">載入版本記錄中…</div>;
  if (!history) return <div className="hk-history-empty">此頁面尚無版本記錄。</div>;

  const currentRevision = history.currentDraft?.revision;
  const confirmBusy = confirm ? busyKey === `${confirm.kind}:${confirm.snapshot.id}` : false;

  return (
    <div className="hk-history">
      {history.currentDraft ? (
        <section className="hk-history__current" aria-label="當前草稿">
          <div>
            <span className="hk-history__section-label">當前草稿</span>
            <strong>修訂 {history.currentDraft.revision}</strong>
          </div>
          <div className="hk-history__current-meta">
            {history.currentDraft.blockCount} 個組件 · {new Date(history.currentDraft.updatedAt).toLocaleString('zh-HK')}
          </div>
        </section>
      ) : null}

      <section>
        <div className="hk-history__section-head">
          <div>
            <span className="hk-history__section-label">自動快照</span>
            <p>每次成功保存都會記錄，最多保留 50 份。</p>
          </div>
          <span>{history.snapshots.length}</span>
        </div>
        <div className="hk-version-list">
          {history.snapshots.map((snapshot) => {
            const lines = summaryLines(snapshot.summary);
            const isCurrent = snapshot.revision === currentRevision;
            const isExpanded = expanded === snapshot.id;
            return (
              <article key={snapshot.id} className={`hk-version-card${isCurrent ? ' is-current' : ''}`}>
                <div className="hk-version-card__head">
                  <strong>修訂 {snapshot.revision}</strong>
                  {isCurrent ? <span className="hk-status-badge is-published">當前</span> : null}
                </div>
                <div className="hk-version-card__meta">
                  {new Date(snapshot.createdAt).toLocaleString('zh-HK')} · {snapshot.createdByName || '系統'} · {snapshot.blockCount} 個組件
                </div>
                <div className="hk-version-card__summary">{lines[0]}</div>
                {isExpanded && lines.length > 1 ? (
                  <ul className="hk-version-card__details">{lines.slice(1).map((line) => <li key={line}>{line}</li>)}</ul>
                ) : null}
                <div className="hk-version-card__actions">
                  {lines.length > 1 ? (
                    <button type="button" className="hk-text-action" onClick={() => setExpanded(isExpanded ? null : snapshot.id)}>{isExpanded ? '收起變動' : '查看變動'}</button>
                  ) : <span />}
                  <button type="button" className="btn-secondary" disabled={busyKey !== null} onClick={() => onPreviewSnapshot(snapshot)}>預覽</button>
                  <button type="button" className="btn-secondary" disabled={isCurrent || busyKey !== null} onClick={() => setConfirm({ kind: 'restore', snapshot })}>恢復</button>
                  <button type="button" className="hk-text-action is-danger" disabled={isCurrent || busyKey !== null} onClick={() => setConfirm({ kind: 'delete', snapshot })}>刪除</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <div className="hk-history__section-head">
          <div><span className="hk-history__section-label">已發佈版本</span><p>恢復後會建立新草稿，不會直接改動線上頁面。</p></div>
        </div>
        <div className="hk-version-list">
          {history.publishedVersions.length ? history.publishedVersions.map((entry) => (
            <article key={entry.id} className="hk-version-card hk-version-card--published">
              <div className="hk-version-card__head">
                <strong>發佈修訂 {entry.revision}</strong>
                <span className={`hk-status-badge ${entry.id === history.publishedVersionId ? 'is-published' : 'is-draft'}`}>
                  {entry.id === history.publishedVersionId ? '線上版本' : '歷史發佈'}
                </span>
              </div>
              <div className="hk-version-card__meta">{entry.blockCount} 個組件 · {new Date(entry.publishedAt || entry.createdAt).toLocaleString('zh-HK')}</div>
              <div className="hk-version-card__actions is-end">
                <button type="button" className="btn-secondary" disabled={busyKey !== null} onClick={() => onRestorePublished(entry)}>
                  {busyKey === `published:${entry.id}` ? '建立中…' : '從此版本建立草稿'}
                </button>
              </div>
            </article>
          )) : <div className="hk-history-empty">此頁面尚未發佈。</div>}
        </div>
      </section>

      {confirm ? (
        <ConfirmDialog
          title={confirm.kind === 'restore' ? `恢復修訂 ${confirm.snapshot.revision}？` : `刪除修訂 ${confirm.snapshot.revision}？`}
          description={confirm.kind === 'restore'
            ? '現有草稿會先保留為快照，然後以這個修訂建立新草稿。線上版本不受影響。'
            : '這個快照將永久刪除，且無法復原。'}
          confirmLabel={confirm.kind === 'restore' ? '確認恢復' : '確認刪除'}
          pending={confirmBusy}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            if (confirm.kind === 'restore') await onRestoreSnapshot(confirm.snapshot);
            else await onDeleteSnapshot(confirm.snapshot);
            setConfirm(null);
          }}
        />
      ) : null}
    </div>
  );
}
