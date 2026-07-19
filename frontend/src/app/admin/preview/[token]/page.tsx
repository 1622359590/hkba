'use client';
// Draft preview (M6/M7c): renders the content pinned by a short-lived preview
// token with the shared BlockRenderer, so editors review the real draft
// instead of raw JSON. The token API marks responses no-store/noindex; a 410
// means the draft moved on and the link must be regenerated from the studio.

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import BlockRenderer, { RenderBlock, MediaMap } from '@/components/blocks/BlockRenderer';

type PreviewPayload = {
  objectType: 'page' | 'news';
  revision: number;
  path?: string;
  slug?: string;
  titleZh: string;
  titleEn?: string;
  blocks: RenderBlock[];
};

type MediaItem = { id: string; url: string; altZh: string | null; altEn: string | null };

export default function PreviewTokenPage() {
  const params = useParams();
  const token = Array.isArray(params.token) ? params.token[0] : (params.token as string);

  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/preview/${token}`, { cache: 'no-store', credentials: 'include' })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body.success) {
          throw new Error(body.error?.message || `預覽載入失敗（${res.status}）`);
        }
        setPayload(body.data as PreviewPayload);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '預覽載入失敗'));
    fetch('/api/admin/media?pageSize=100', { cache: 'no-store', credentials: 'include', headers: { 'x-requested-with': 'XMLHttpRequest' } })
      .then(async (res) => {
        const body = await res.json();
        if (res.ok && body.success) setMediaItems(body.data.items as MediaItem[]);
      })
      .catch(() => {});
  }, [token]);

  const mediaMap = useMemo<MediaMap>(() => {
    const map: MediaMap = {};
    for (const item of mediaItems) map[item.id] = { url: item.url, altZh: item.altZh || undefined, altEn: item.altEn || undefined };
    return map;
  }, [mediaItems]);

  return (
    <div className="hk-preview-full" style={{ margin: -32, minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-1)',
          position: 'sticky',
          top: 0,
          zIndex: 5,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)', border: '1px solid rgba(217,182,86,0.4)', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
          預覽模式
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {payload ? payload.titleZh || payload.titleEn || payload.path || payload.slug : '載入中…'}
        </span>
        {payload ? (
          <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
            {payload.objectType === 'page' ? payload.path : payload.slug} · 修訂 {payload.revision}
          </span>
        ) : null}
        <span style={{ flex: 1 }} />
        <div className="hk-lang-switch" role="group" aria-label="預覽語言">
          <button type="button" className={lang === 'zh' ? 'is-active' : ''} onClick={() => setLang('zh')}>
            中文
          </button>
          <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>
            EN
          </button>
        </div>
      </div>
      <div style={{ flex: 1, padding: '28px 20px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 980 }}>
          {error ? (
            <div className="hk-canvas-empty">
              {error}
              <div style={{ marginTop: 8, fontSize: 12 }}>如提示草稿已更新，請回到工作室重新產生預覽連結。</div>
            </div>
          ) : !payload ? (
            <div className="hk-canvas-empty">載入預覽內容…</div>
          ) : payload.blocks.length === 0 ? (
            <div className="hk-canvas-empty">此草稿沒有內容組件。</div>
          ) : (
            <BlockRenderer blocks={payload.blocks} lang={lang} media={mediaMap} />
          )}
        </div>
      </div>
    </div>
  );
}
