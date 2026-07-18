'use client';
// Public news list (M8: frontend rendering switch).
//
// New system first: /api/public/news with year + category filters sourced
// from real published content. When the new API has nothing published yet
// (pre-migration) or is unreachable, the legacy /api/news list renders
// exactly as before — the live site must never go blank.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { apiGet, imgUrl, type NewsItem } from '@/lib/api';
import { fetchPublicCategories, fetchPublicNews, fetchPublicYears, PublicCategory, PublicNewsListItem } from '@/lib/publicContent';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback';

const c: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '0 24px' };
const sec: React.CSSProperties = { padding: '96px 0' };

const chipStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
  padding: '7px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.08)',
  background: active ? '#6366f1' : 'rgba(255,255,255,0.03)',
  color: active ? '#fff' : '#a1a1aa',
  fontSize: 13,
  cursor: disabled ? 'wait' : 'pointer',
});

export default function NewsListClient() {
  const { lang, t } = useLang();
  const [mode, setMode] = useState<'new' | 'legacy' | null>(null);

  // New-system state.
  const [items, setItems] = useState<PublicNewsListItem[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [year, setYear] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Legacy fallback state.
  const [legacyNews, setLegacyNews] = useState<NewsItem[]>([]);
  const [legacyTotal, setLegacyTotal] = useState(0);
  const [legacyCategory, setLegacyCategory] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const loadLegacy = useCallback(
    (targetPage: number) => {
      setLoading(true);
      apiGet<{ items: NewsItem[]; total: number }>(`/api/news?page=${targetPage}&limit=9`)
        .then((data) => {
          setLegacyNews(data.items);
          setLegacyTotal(data.total);
          setMode('legacy');
          setError('');
        })
        .catch(() => setError(t('新聞載入失敗，請稍後再試。', 'Failed to load news. Please try again later.')))
        .finally(() => setLoading(false));
    },
    [t]
  );

  // Initial probe: prefer the new public API, fall back when it has no
  // published content (pre-migration) or fails.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicNews({ page: 1, pageSize: 9 })
      .then(async (list) => {
        if (cancelled) return;
        if (!list || list.total === 0) {
          loadLegacy(1);
          return;
        }
        setItems(list.items);
        setTotal(list.total);
        setMode('new');
        const [yearList, categoryList] = await Promise.all([fetchPublicYears(), fetchPublicCategories()]);
        if (cancelled) return;
        if (yearList) setYears(yearList);
        if (categoryList) setCategories(categoryList);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);

  // Filter/page changes in new mode.
  useEffect(() => {
    if (mode !== 'new') return;
    let cancelled = false;
    setLoading(true);
    fetchPublicNews({ page, pageSize: 9, year: year || undefined, categoryId: categoryId || undefined })
      .then((list) => {
        if (cancelled) return;
        if (list) {
          setItems(list.items);
          setTotal(list.total);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, page, year, categoryId]);

  useEffect(() => {
    if (mode === 'legacy') loadLegacy(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const legacyCategories = Array.from(new Set(legacyNews.map((item) => item.category).filter(Boolean)));
  const visibleLegacy = legacyCategory === 'all' ? legacyNews : legacyNews.filter((item) => item.category === legacyCategory);
  const activeTotal = mode === 'new' ? total : legacyTotal;

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
          {mode === 'new' && (years.length > 1 || categories.length > 0) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
              <button type="button" onClick={() => { setYear(0); setPage(1); }} disabled={loading} style={chipStyle(year === 0, loading)}>
                {t('全部年份', 'All years')}
              </button>
              {years.map((entry) => (
                <button key={entry} type="button" onClick={() => { setYear(entry); setPage(1); }} disabled={loading} style={chipStyle(year === entry, loading)}>
                  {entry}
                </button>
              ))}
              {categories.length > 0 && <span style={{ flexBasis: '100%', height: 0 }} />}
              <button type="button" onClick={() => { setCategoryId(''); setPage(1); }} disabled={loading} style={chipStyle(categoryId === '', loading)}>
                {t('全部欄目', 'All categories')}
              </button>
              {categories.map((entry) => (
                <button key={entry.id} type="button" onClick={() => { setCategoryId(entry.id); setPage(1); }} disabled={loading} style={chipStyle(categoryId === entry.id, loading)}>
                  {lang === 'en' ? entry.nameEn || entry.nameZh : entry.nameZh}
                </button>
              ))}
            </div>
          )}
          {mode === 'legacy' && legacyCategories.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
              {[{ value: 'all', label: t('全部', 'All') }, ...legacyCategories.map((value) => ({ value, label: value }))].map((item) => (
                <button key={item.value} onClick={() => setLegacyCategory(item.value)} disabled={loading} className="filter-chip" style={chipStyle(legacyCategory === item.value, loading)}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
          {loading && <LoadingState label={t('正在載入新聞...', 'Loading news...')} />}
          {error && <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />}
          {!loading && !error && mode === 'new' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
              {items.map((item, i) => (
                <Link key={item.id} href={`/news/${item.slug}`} className="glass-card content-reveal" style={{ overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit', animationDelay: `${0.08 * i}s` }}>
                  {item.cover && <div style={{ height: 200, overflow: 'hidden' }}><img src={imgUrl(item.cover.url)} alt={lang === 'en' ? item.cover.altEn || item.cover.altZh : item.cover.altZh} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }} /></div>}
                  <div style={{ padding: 24 }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                      {item.categories[0] && (
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>
                          {lang === 'en' ? item.categories[0].nameEn || item.categories[0].nameZh : item.categories[0].nameZh}
                        </span>
                      )}
                      {item.year && <span style={{ fontSize: 12, color: '#52525b' }}>{item.year}</span>}
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#fff', lineHeight: 1.4 }}>{lang === 'en' ? item.titleEn || item.titleZh : item.titleZh || item.titleEn}</h3>
                    <p style={{ fontSize: 14, color: '#71717a', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {lang === 'en' ? item.summaryEn || item.summaryZh : item.summaryZh || item.summaryEn}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {!loading && !error && mode === 'legacy' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
              {visibleLegacy.map((item, i) => (
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
          {!loading && !error && mode !== null && (mode === 'new' ? items.length === 0 : visibleLegacy.length === 0) && (
            <EmptyState title={t('暫無新聞內容', 'No news yet')} description={t('協會新聞正在整理中，歡迎稍後再來。', 'Association news is being prepared. Please check back soon.')} action={<Link href="/contact" className="btn-secondary">{t('聯絡協會', 'Contact HKBA')}</Link>} />
          )}
          {!loading && !error && activeTotal > 9 && (mode === 'new' || legacyCategory === 'all') && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 48 }}>
              {Array.from({ length: Math.ceil(activeTotal / 9) }, (_, i) => (
                <button key={i + 1} onClick={() => setPage(i + 1)} disabled={page === i + 1 || loading} aria-current={page === i + 1 ? 'page' : undefined} className="pagination-button" style={{ width: 36, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 500, border: '1px solid transparent', cursor: page === i + 1 || loading ? 'default' : 'pointer', background: page === i + 1 ? '#6366f1' : 'rgba(255,255,255,0.04)', color: page === i + 1 ? '#fff' : '#a1a1aa', opacity: loading ? 0.55 : 1 }}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
