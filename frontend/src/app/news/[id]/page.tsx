'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { apiGet, imgUrl, type NewsItem } from '@/lib/api';
import Link from 'next/link';
import { ErrorState, LoadingState } from '@/components/ui/Feedback';

export default function NewsDetailPage() {
  const { id } = useParams();
  const { lang, t } = useLang();
  const [a, setA] = useState<NewsItem | null>(null);
  const [latest, setLatest] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!id) return;
    const currentId = Array.isArray(id) ? id[0] : id;
    setLoading(true);
    setError('');
    Promise.all([
      apiGet<NewsItem>(`/api/news/${currentId}`),
      apiGet<{ items: NewsItem[] }>('/api/news?limit=5'),
    ])
      .then(([article, list]) => {
        setA(article);
        setLatest(list.items.filter(item => String(item.id) !== String(currentId)).slice(0, 5));
      })
      .catch(() => setError(t('新聞載入失敗，請返回列表重試。', 'Failed to load this article. Please return to the news list and try again.')))
      .finally(() => setLoading(false));
  }, [id, retry, t]);

  if (loading) return <div style={{ padding: '140px 24px' }}><LoadingState label={t('正在載入新聞...', 'Loading article...')} /></div>;
  if (error || !a) return <div style={{ padding: '140px 24px' }}><ErrorState message={error || t('未找到新聞', 'Article not found')} onRetry={() => setRetry(value => value + 1)} /><div style={{ textAlign: 'center', marginTop: 16 }}><Link href="/news" className="btn-secondary">{t('返回新聞列表', 'Back to News')}</Link></div></div>;

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
          {latest.length > 0 && (
            <aside className="glass-card news-aside" style={{ padding: 20, height: 'fit-content', position: 'sticky', top: 88 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 16 }}>{t('最新新聞', 'Latest News')}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {latest.map(item => (
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
          section div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
          .news-aside {
            position: static !important;
          }
        }
      `}</style>
    </>
  );
}
