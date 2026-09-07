'use client';
// Draft preview (M6/M7c): renders the content pinned by a short-lived preview
// token with the shared BlockRenderer, so editors review the real draft
// instead of raw JSON. The token API marks responses no-store/noindex; a 410
// means the draft moved on and the link must be regenerated from the studio.

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import BlockRenderer, { AssocData, RenderBlock, MediaMap, NewsCardData } from '@/components/blocks/BlockRenderer';
import { HomeHero, HomeMission } from '@/components/home/HomeMockupSections';
import { fetchPublicAssociation, fetchPublicNews, PublicNewsListItem } from '@/lib/publicContent';
import { resolvePublicPagePresentation } from '@/lib/publicPagePresentation';
import { useLang } from '@/lib/useLang';

type PreviewPayload = {
  objectType: 'page' | 'page_snapshot' | 'news';
  revision: number;
  path?: string;
  slug?: string;
  titleZh: string;
  titleEn?: string;
  blocks: RenderBlock[];
};

type MediaItem = { id: string; url: string; altZh: string | null; altEn: string | null };

function newsCard(item: PublicNewsListItem, lang: 'zh' | 'en'): NewsCardData {
  return {
    id: item.id,
    slug: item.slug,
    title: (lang === 'en' ? item.titleEn || item.titleZh : item.titleZh || item.titleEn) || item.slug,
    summary: lang === 'en' ? item.summaryEn || item.summaryZh : item.summaryZh || item.summaryEn,
    year: item.year,
    publishedAt: item.publishedAt,
    coverUrl: item.cover?.url || null,
    categoryId: item.categories[0]?.id,
    category: lang === 'en' ? item.categories[0]?.nameEn || item.categories[0]?.nameZh : item.categories[0]?.nameZh,
  };
}

export default function PreviewTokenPage() {
  const params = useParams();
  const token = Array.isArray(params.token) ? params.token[0] : (params.token as string);

  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [association, setAssociation] = useState<AssocData | undefined>(undefined);
  const [publicNews, setPublicNews] = useState<PublicNewsListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [embedded, setEmbedded] = useState(false);
  const { lang, setLang } = useLang();

  useEffect(() => {
    setEmbedded(new URLSearchParams(window.location.search).get('embed') === '1');
  }, []);

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
    fetchPublicAssociation().then((data) => setAssociation(data || undefined));
    fetchPublicNews({ pageSize: 24 }).then((data) => setPublicNews(data?.items || []));
  }, [token]);

  const mediaMap = useMemo<MediaMap>(() => {
    const map: MediaMap = {};
    for (const item of mediaItems) map[item.id] = { url: item.url, altZh: item.altZh || undefined, altEn: item.altEn || undefined };
    return map;
  }, [mediaItems]);
  const news = useMemo(() => publicNews.map((item) => newsCard(item, lang)), [lang, publicNews]);
  const pageClass = payload?.path === '/' ? 'home' : (payload?.path || 'page').replace(/^\//, '').replace(/[^a-z0-9-]/gi, '-') || 'page';
  const presentation = useMemo(
    () => resolvePublicPagePresentation(payload?.path || '', payload?.blocks || []),
    [payload]
  );
  const isHome = payload?.objectType !== 'news' && payload?.path === '/';

  return (
    <div className={`hk-preview-full${embedded ? ' is-embedded' : ''}`} style={{ margin: embedded ? 0 : -32, minHeight: embedded ? '100vh' : 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {!embedded ? <div
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
            {payload.objectType === 'news' ? payload.slug : payload.path} · 修訂 {payload.revision}
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
      </div> : null}
      <div style={{ flex: 1, padding: embedded ? 0 : '28px 20px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: embedded ? 'none' : 980 }}>
          {error ? (
            <div className="hk-canvas-empty">
              {error}
              <div style={{ marginTop: 8, fontSize: 12 }}>如提示草稿已更新，請回到工作室重新產生預覽連結。</div>
            </div>
          ) : !payload ? (
            <div className="hk-canvas-empty">載入預覽內容…</div>
          ) : payload.blocks.length === 0 && !isHome ? (
            <div className="hk-canvas-empty">此草稿沒有內容組件。</div>
          ) : (
            <div className={`public-blocks public-page--${pageClass}`}>
              {isHome ? (
                <>
                  <HomeHero />
                  <HomeMission block={presentation.blocks.find((block) => block.component_type === 'content.mission')} />
                  <div className="public-home-content">
                    <BlockRenderer blocks={presentation.blocks.filter((block) => block.component_type !== 'content.hero' && block.component_type !== 'content.mission')} lang={lang} media={mediaMap} news={news} assoc={association} />
                  </div>
                </>
              ) : (
                <BlockRenderer blocks={presentation.blocks} lang={lang} media={mediaMap} news={news} assoc={association} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
