'use client';
// Public news detail (M8; decision D8: slug URLs with numeric aliases).
//
// Resolution order for /news/<segment>:
//   1. New public API by slug → render the published revision blocks with
//      the shared BlockRenderer (news.header + body blocks).
//   2. API answers a redirect payload (legacy numeric alias found in the
//      redirects table) → client-side replace to the canonical slug URL.
//   3. Miss and the segment is numeric → legacy /api/news/:id rendering,
//      unchanged from before the switch (pre-migration safety net).
//   4. Otherwise → error state.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { apiGet, imgUrl, type NewsItem } from '@/lib/api';
import { fetchPublicNews, fetchPublicNewsItem, PublicNewsDetail, PublicNewsListItem } from '@/lib/publicContent';
import BlockRenderer from '@/components/blocks/BlockRenderer';
import { ErrorState, LoadingState } from '@/components/ui/Feedback';

export default function NewsDetailClient() {
  const params = useParams();
  const router = useRouter();
  const slug = Array.isArray(params.slug) ? params.slug[0] : (params.slug as string);
  const { lang, t } = useLang();

  const [detail, setDetail] = useState<PublicNewsDetail | null>(null);
  const [legacy, setLegacy] = useState<NewsItem | null>(null);
  const [latest, setLatest] = useState<PublicNewsListItem[]>([]);
  const [legacyLatest, setLegacyLatest] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setDetail(null);
    setLegacy(null);

    const loadLegacy = (id: string) => {
      Promise.all([apiGet<NewsItem>(`/api/news/${id}`), apiGet<{ items: NewsItem[] }>('/api/news?limit=5')])
        .then(([article, list]) => {
          if (cancelled) return;
          setLegacy(article);
          setLegacyLatest(list.items.filter((item) => String(item.id) !== String(id)).slice(0, 5));
        })
        .catch(() => {
          if (!cancelled) setError(t('新聞載入失敗，請稍後再試。', 'Failed to load the article. Please try again later.'));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    fetchPublicNewsItem(slug).then((result) => {
      if (cancelled) return;
      if (result.kind === 'redirect') {
        router.replace(result.to);
        return;
      }
      if (result.kind === 'detail') {
        setDetail(result.detail);
        fetchPublicNews({ pageSize: 5 }).then((list) => {
          if (!cancelled && list) setLatest(list.items.filter((item) => item.slug !== result.detail.item.slug).slice(0, 4));
        });
        setLoading(false);
        return;
      }
      if (/^\d+$/.test(slug)) {
        loadLegacy(slug);
      } else {
        setError(t('未找到新聞', 'Article not found'));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug, retry, router, t]);

  if (loading) return <div style={{ padding: '140px 24px' }}><LoadingState label={t('正在載入新聞...', 'Loading article...')} /></div>;
  if (error || (!detail && !legacy)) {
    return (
      <div style={{ padding: '140px 24px' }}>
        <ErrorState message={error || t('未找到新聞', 'Article not found')} onRetry={() => setRetry((value) => value + 1)} />
        <div style={{ textAlign: 'center', marginTop: 16 }}><Link href="/news" className="btn-secondary">{t('返回新聞列表', 'Back to News')}</Link></div>
      </div>
    );
  }

  // ---- new system: published revision blocks via the shared renderer ----
  if (detail) {
    return (
      <>
        <section style={{ padding: '64px 0 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)' }} />
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
            <Link href="/news" style={{ fontSize: 13, color: '#818cf8', textDecoration: 'none', display: 'inline-block' }}>← {t('返回新聞', 'Back to News')}</Link>
          </div>
        </section>
        <section style={{ paddingBottom: 96, paddingTop: 24 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 40 }}>
            <div>
              <BlockRenderer blocks={detail.blocks} lang={lang} media={detail.media} />
            </div>
            {latest.length > 0 && (
              <aside className="glass-card news-aside" style={{ padding: 20, height: 'fit-content', position: 'sticky', top: 88 }}>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 16 }}>{t('最新新聞', 'Latest News')}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {latest.map((item) => (
                    <Link key={item.id} href={`/news/${item.slug}`} style={{ textDecoration: 'none', color: 'inherit', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                      <div style={{ fontSize: 11, color: '#818cf8', marginBottom: 4 }}>
                        {[item.categories[0] ? (lang === 'en' ? item.categories[0].nameEn || item.categories[0].nameZh : item.categories[0].nameZh) : '', item.year].filter(Boolean).join(' · ')}
                      </div>
                      <div style={{ fontSize: 13, color: '#d4d4d8', lineHeight: 1.5 }}>{lang === 'en' ? item.titleEn || item.titleZh : item.titleZh || item.titleEn}</div>
                    </Link>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </section>
        <style jsx>{`
          @media (max-width: 900px) {
            section div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
            .news-aside { position: static !important; }
          }
        `}</style>
      </>
    );
  }

  // ---- legacy rendering (pre-migration fallback, unchanged) ----
  const a = legacy as NewsItem;
  return (
    <>
      <section style={{ padding: '96px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)' }} />
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
          <div style={{ animation: 'fadeInUp 0.6s cubic-bezier(0.22,1,0.36,1) forwards' }}>
            <Link href="/news" style={{ fontSize: 13, color: '#818cf8', textDecoration: 'none', marginBottom: 24, display: 'inline-block' }}>← {t('返回新聞', 'Back to News')}</Link>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#818cf8', textTransform: 'uppercase' }}>{a.category}</span>
              {a.published_at && <span style={{ fontSize: 13, color: '#71717a' }}>{new Date(a.published_at).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US')}</span>}
            </div>
            <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{t(a.title_zh, a.title_en)}</h1>
          </div>
        </div>
      </section>
      <section style={{ paddingBottom: 96 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 40 }}>
          <div style={{ animation: 'fadeInUp 0.6s 0.2s cubic-bezier(0.22,1,0.36,1) forwards' }}>
            {a.cover_image && <img src={imgUrl(a.cover_image)} alt="" style={{ width: '100%', borderRadius: 16, marginBottom: 40 }} />}
            <div className="prose" dangerouslySetInnerHTML={{ __html: t(a.content_zh, a.content_en) }} />
          </div>
          {legacyLatest.length > 0 && (
            <aside className="glass-card news-aside" style={{ padding: 20, height: 'fit-content', position: 'sticky', top: 88 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 16 }}>{t('最新新聞', 'Latest News')}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {legacyLatest.map((item) => (
                  <Link key={item.id} href={`/news/${item.id}`} style={{ textDecoration: 'none', color: 'inherit', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                    <div style={{ fontSize: 11, color: '#818cf8', marginBottom: 4 }}>{item.category}</div>
                    <div style={{ fontSize: 13, color: '#d4d4d8', lineHeight: 1.5 }}>{t(item.title_zh, item.title_en)}</div>
                  </Link>
                ))}
              </div>
            </aside>
          )}
        </div>
      </section>
      <style jsx>{`
        @media (max-width: 900px) {
          section div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
          .news-aside { position: static !important; }
        }
      `}</style>
    </>
  );
}
