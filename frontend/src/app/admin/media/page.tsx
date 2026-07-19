'use client';
// Media library (M7d, ui-interaction-system §7).
//
// Grid of every uploaded asset with search / kind / unused filters and a
// recycle-bin view. Upload happens in place — drag files onto the grid or use
// the picker; each file POSTs multipart to /api/admin/media/uploads. The
// detail drawer edits alt/caption text, shows recorded references, and moves
// assets to the bin; permanent deletion is only offered inside the bin and
// still requires zero references on the server.

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminGetData, adminPatchData, adminDeleteData, adminRequestError } from '@/lib/adminApi';
import Drawer from '@/components/admin/shell/Drawer';
import { ConfirmBar } from '@/components/admin/shell/ConfirmBar';

type MediaAsset = {
  id: string;
  url: string;
  kind: 'image' | 'pdf';
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  originalFilename: string;
  altZh: string | null;
  altEn: string | null;
  captionZh: string | null;
  captionEn: string | null;
  status: string;
  createdAt: string;
};

type Reference = { id: string; refType: string; refId: string };

type MetaForm = { altZh: string; altEn: string; captionZh: string; captionEn: string; originalFilename: string };

const PAGE_SIZE = 24;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function uploadOne(file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  const token = localStorage.getItem('hkba_admin_token');
  const res = await fetch('/api/admin/media/uploads', {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-requested-with': 'XMLHttpRequest', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message || body?.error || `上傳失敗（${res.status}）`;
    throw new Error(`${file.name}: ${message}`);
  }
}

export default function MediaLibraryPage() {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'' | 'image' | 'pdf'>('');
  const [unusedOnly, setUnusedOnly] = useState(false);
  const [trashView, setTrashView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [metaForm, setMetaForm] = useState<MetaForm | null>(null);
  const [references, setReferences] = useState<Reference[]>([]);
  const [savingMeta, setSavingMeta] = useState(false);
  const [trashTarget, setTrashTarget] = useState<MediaAsset | null>(null);
  const [permanentTarget, setPermanentTarget] = useState<MediaAsset | null>(null);
  const [acting, setActing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(PAGE_SIZE) });
      if (q.trim()) params.set('q', q.trim());
      if (kind) params.set('kind', kind);
      if (unusedOnly) params.set('unused', '1');
      if (trashView) params.set('status', 'trash');
      const data = await adminGetData<{ items: MediaAsset[]; total: number }>(`/api/admin/media?${params}`);
      setItems(data.items);
      setTotal(data.total);
      setPage(targetPage);
    } catch (error) {
      setBanner(adminRequestError(error));
    } finally {
      setLoading(false);
    }
  }, [page, q, kind, unusedOnly, trashView]);

  useEffect(() => {
    const timer = setTimeout(() => load(1), q ? 350 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, kind, unusedOnly, trashView]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setUploadBusy(true);
      setBanner(null);
      const failures: string[] = [];
      for (const file of files) {
        try {
          await uploadOne(file);
        } catch (error) {
          failures.push(adminRequestError(error));
        }
      }
      setUploadBusy(false);
      if (failures.length) setBanner(failures.join('；'));
      await load(1);
    },
    [load]
  );

  const openDetail = useCallback((asset: MediaAsset) => {
    setSelected(asset);
    setMetaForm({
      altZh: asset.altZh || '',
      altEn: asset.altEn || '',
      captionZh: asset.captionZh || '',
      captionEn: asset.captionEn || '',
      originalFilename: asset.originalFilename,
    });
    adminGetData<{ references: Reference[] }>(`/api/admin/media/${asset.id}/references`)
      .then((data) => setReferences(data.references))
      .catch(() => setReferences([]));
  }, []);

  const saveMeta = useCallback(async () => {
    if (!selected || !metaForm) return;
    setSavingMeta(true);
    try {
      const data = await adminPatchData<{ asset: MediaAsset }>(`/api/admin/media/${selected.id}`, metaForm);
      setItems((previous) => previous.map((item) => (item.id === selected.id ? data.asset : item)));
      setSelected(data.asset);
      setBanner(null);
    } catch (error) {
      setBanner(adminRequestError(error));
    } finally {
      setSavingMeta(false);
    }
  }, [selected, metaForm]);

  const trashAsset = useCallback(async () => {
    if (!trashTarget) return;
    setActing(true);
    try {
      await adminDeleteData(`/api/admin/media/${trashTarget.id}`);
      setTrashTarget(null);
      setSelected(null);
      await load();
    } catch (error) {
      setBanner(adminRequestError(error));
    } finally {
      setActing(false);
    }
  }, [trashTarget, load]);

  const eraseAsset = useCallback(async () => {
    if (!permanentTarget) return;
    setActing(true);
    try {
      await adminDeleteData(`/api/admin/media/${permanentTarget.id}/permanent`);
      setPermanentTarget(null);
      setSelected(null);
      await load();
    } catch (error) {
      setBanner(adminRequestError(error));
      setPermanentTarget(null);
    } finally {
      setActing(false);
    }
  }, [permanentTarget, load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <input
          className="hk-input"
          style={{ maxWidth: 260 }}
          placeholder="搜尋檔名或替代文字…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <div className="hk-segmented" role="group" aria-label="類型篩選">
          {([['', '全部'], ['image', '圖片'], ['pdf', 'PDF']] as const).map(([value, label]) => (
            <button key={value} type="button" className={kind === value ? 'is-active' : ''} onClick={() => setKind(value)}>
              {label}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={unusedOnly} onChange={(event) => setUnusedOnly(event.target.checked)} />
          僅未引用
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: trashView ? 'var(--warn)' : 'var(--text-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={trashView} onChange={(event) => setTrashView(event.target.checked)} />
          回收站
        </label>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn-accent" style={{ padding: '9px 16px', fontSize: 13 }} disabled={uploadBusy || trashView} onClick={() => fileInputRef.current?.click()}>
          {uploadBusy ? '上傳中…' : '上傳媒體'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          style={{ display: 'none' }}
          onChange={(event) => {
            void uploadFiles(Array.from(event.target.files || []));
            event.target.value = '';
          }}
        />
      </div>

      {banner ? (
        <div style={{ padding: '9px 14px', marginBottom: 14, fontSize: 12.5, color: 'var(--warn)', background: 'rgba(240,140,90,0.08)', borderRadius: 10, display: 'flex', gap: 12 }}>
          <span style={{ flex: 1 }}>{banner}</span>
          <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }} onClick={() => setBanner(null)} aria-label="關閉提示">
            ✕
          </button>
        </div>
      ) : null}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!trashView) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (!trashView) void uploadFiles(Array.from(event.dataTransfer.files || []));
        }}
        style={dragOver ? { outline: '2px dashed var(--cyan)', outlineOffset: 6, borderRadius: 14 } : undefined}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>載入中…</div>
        ) : items.length === 0 ? (
          <div className="hk-canvas-empty">{trashView ? '回收站為空。' : '還沒有媒體。拖拽檔案到這裡，或點擊「上傳媒體」。'}</div>
        ) : (
          <div className="hk-media-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {items.map((asset) => (
              <button key={asset.id} type="button" className={`hk-media-cell${selected?.id === asset.id ? ' is-selected' : ''}`} onClick={() => openDetail(asset)}>
                {asset.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt={asset.altZh || asset.originalFilename} />
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '4/3', fontSize: 22, color: 'var(--text-3)' }}>PDF</span>
                )}
                <span style={{ display: 'block', padding: '6px 8px', fontSize: 11, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                  {asset.originalFilename}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, fontSize: 12.5, color: 'var(--text-2)' }}>
          <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} disabled={page <= 1} onClick={() => load(page - 1)}>
            上一頁
          </button>
          <span>
            第 {page} / {totalPages} 頁 · 共 {total} 項
          </span>
          <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} disabled={page >= totalPages} onClick={() => load(page + 1)}>
            下一頁
          </button>
        </div>
      ) : null}

      <Drawer open={Boolean(selected)} side="right" title={selected?.originalFilename || '媒體詳情'} subtitle={selected ? `${assetKindLabel(selected)} · ${formatSize(selected.sizeBytes)}${selected.width ? ` · ${selected.width}×${selected.height}` : ''}` : undefined} onClose={() => setSelected(null)} width={400}>
        {selected && metaForm ? (
          <div className="hk-form">
            {selected.kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.url} alt={selected.altZh || selected.originalFilename} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
            ) : (
              <a href={selected.url} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)', fontSize: 13 }}>
                在新分頁打開 PDF ↗
              </a>
            )}
            <div className="hk-field">
              <span className="hk-field__label">檔名</span>
              <input className="hk-input" value={metaForm.originalFilename} onChange={(event) => setMetaForm({ ...metaForm, originalFilename: event.target.value })} />
            </div>
            <div className="hk-field">
              <span className="hk-field__label">替代文字（中文）</span>
              <input className="hk-input" value={metaForm.altZh} onChange={(event) => setMetaForm({ ...metaForm, altZh: event.target.value })} />
            </div>
            <div className="hk-field">
              <span className="hk-field__label">替代文字（英文）</span>
              <input className="hk-input" value={metaForm.altEn} onChange={(event) => setMetaForm({ ...metaForm, altEn: event.target.value })} />
            </div>
            <div className="hk-field">
              <span className="hk-field__label">說明（中文）</span>
              <textarea className="hk-textarea" value={metaForm.captionZh} onChange={(event) => setMetaForm({ ...metaForm, captionZh: event.target.value })} />
            </div>
            <div className="hk-field">
              <span className="hk-field__label">說明（英文）</span>
              <textarea className="hk-textarea" value={metaForm.captionEn} onChange={(event) => setMetaForm({ ...metaForm, captionEn: event.target.value })} />
            </div>
            <button type="button" className="btn-accent" style={{ padding: '10px 16px', fontSize: 13 }} disabled={savingMeta} onClick={saveMeta}>
              {savingMeta ? '保存中…' : '保存'}
            </button>
            <div style={{ fontSize: 12, color: 'var(--text-3)', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
              引用：{references.length === 0 ? '無記錄引用' : `${references.length} 筆（${[...new Set(references.map((reference) => reference.refType))].join('、')}）`}
            </div>
            {selected.status !== 'trash' ? (
              <button type="button" className="btn-secondary" style={{ padding: '9px 14px', fontSize: 12.5, color: 'var(--warn)' }} onClick={() => setTrashTarget(selected)}>
                移入回收站
              </button>
            ) : (
              <button type="button" className="btn-danger" style={{ padding: '9px 14px', fontSize: 12.5 }} onClick={() => setPermanentTarget(selected)}>
                永久刪除
              </button>
            )}
          </div>
        ) : null}
      </Drawer>

      {trashTarget ? (
        <ConfirmBar
          message={`將「${trashTarget.originalFilename}」移入回收站？引用它的內容會保留記錄，但前台將無法顯示此媒體。`}
          confirmLabel="移入回收站"
          danger
          busy={acting}
          onConfirm={trashAsset}
          onCancel={() => setTrashTarget(null)}
        />
      ) : null}
      {permanentTarget ? (
        <ConfirmBar
          message={`永久刪除「${permanentTarget.originalFilename}」？檔案將從儲存中移除，無法復原。仍存在引用的媒體會被伺服器拒絕。`}
          confirmLabel="永久刪除"
          danger
          busy={acting}
          onConfirm={eraseAsset}
          onCancel={() => setPermanentTarget(null)}
        />
      ) : null}
    </div>
  );
}

function assetKindLabel(asset: MediaAsset): string {
  return asset.kind === 'pdf' ? 'PDF' : asset.mimeType;
}
