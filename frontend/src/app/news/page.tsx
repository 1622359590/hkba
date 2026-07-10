'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/useLang';
import { apiGet, imgUrl, type NewsItem } from '@/lib/api';
import Link from 'next/link';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback';

const c: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '0 24px' };
const sec: React.CSSProperties = { padding: '96px 0' };

export default function NewsPage() {
  const { lang, t } = useLang();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError('');
    apiGet<{ items: NewsItem[]; total: number }>(`/api/news?page=${page}&limit=9`)
      .then(d => { setNews(d.items); setTotal(d.total); })
      .catch(() => setError(t('新聞載入失敗，請稍後再試。', 'Failed to load news. Please try again later.')))
      .finally(() => setLoading(false));
  }, [page, retry, t]);

  const categories = Array.from(new Set(news.map(item => item.category).filter(Boolean)));
  const visibleNews = category === 'all' ? news : news.filter(item => item.category === category);

  return (
    <>
      <section style={{ ...sec, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)' }} />
        <div style={{ ...c, position: 'relative' }}>
          <div style={{ animation: 'fadeInUp 0.8s cubic-bezier(0.22,1,0.36,1) forwards' }}>
            <div className="section-label">{t('新聞動態', 'News')}</div>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 20 }}>{t('協會新聞', 'Association News')}</h1>
            <div className="divider" />
          </div>
        </div>
      </section>
      <section style={{ paddingBottom: 96 }}>
        <div style={c}>
          {categories.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
              {[{ value: 'all', label: t('全部', 'All') }, ...categories.map(value => ({ value, label: value }))].map(item => (
                <button key={item.value} onClick={() => setCategory(item.value)} disabled={loading} className="filter-chip" style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: category === item.value ? '#6366f1' : 'rgba(255,255,255,0.03)', color: category === item.value ? '#fff' : '#a1a1aa', fontSize: 13, cursor: loading ? 'wait' : 'pointer' }}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
          {loading && <LoadingState label={t('正在載入新聞...', 'Loading news...')} />}
          {error && <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />}
          {!loading && !error && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
              {visibleNews.map((item, i) => (
                <Link key={item.id} href={`/news/${item.id}`} className="glass-card content-reveal" style={{ overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit', animationDelay: `${0.08 * i}s` }}>
                  {item.cover_image && <div style={{ height: 200, overflow: 'hidden' }}><img src={imgUrl(item.cover_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }} /></div>}
                  <div style={{ padding: 24 }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#818cf8', textTransform: 'uppercase' }}>{item.category}</span>
                      {item.published_at && <span style={{ fontSize: 12, color: '#52525b' }}>{new Date(item.published_at).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US')}</span>}
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#fff', lineHeight: 1.4 }}>{t(item.title_zh, item.title_en)}</h3>
                    <p style={{ fontSize: 14, color: '#71717a', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t(item.summary_zh, item.summary_en)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {!loading && !error && visibleNews.length === 0 && <EmptyState title={t('暫無新聞內容', 'No news yet')} description={t('協會新聞正在整理中，歡迎稍後再來。', 'Association news is being prepared. Please check back soon.')} action={<Link href="/contact" className="btn-secondary">{t('聯絡協會', 'Contact HKBA')}</Link>} />}
          {!loading && !error && category === 'all' && total > 9 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 48 }}>
              {Array.from({ length: Math.ceil(total / 9) }, (_, i) => (
                <button key={i + 1} onClick={() => setPage(i + 1)} disabled={page === i + 1 || loading} aria-current={page === i + 1 ? 'page' : undefined} className="pagination-button" style={{ width: 36, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid transparent', cursor: page === i + 1 || loading ? 'default' : 'pointer', background: page === i + 1 ? '#6366f1' : 'rgba(255,255,255,0.04)', color: page === i + 1 ? '#fff' : '#a1a1aa', opacity: loading ? 0.55 : 1 }}>{i + 1}</button>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
