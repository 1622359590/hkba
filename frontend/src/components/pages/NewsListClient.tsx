'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/useLang';
import { apiGet, imgUrl, type NewsItem } from '@/lib/api';
import { fetchPublicCategories, fetchPublicNews, fetchPublicYears, type PublicCategory, type PublicNewsListItem } from '@/lib/publicContent';
import PublicPageSwitch from '@/components/PublicPageSwitch';
import NewsExperience from '@/components/news/NewsExperience';
import { normalizeLegacyNews, normalizePublicNews, selectNewsLayout } from '@/components/news/newsViewModel.mjs';

export default function NewsListClient() {
  const { lang, t } = useLang();
  const [mode, setMode] = useState<'new' | 'legacy' | null>(null);
  const [items, setItems] = useState<PublicNewsListItem[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [year, setYear] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [legacyNews, setLegacyNews] = useState<NewsItem[]>([]);
  const [legacyTotal, setLegacyTotal] = useState(0);
  const [legacyCategory, setLegacyCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const loadLegacy = useCallback((targetPage: number) => {
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
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicNews({ page: 1, pageSize: 9 }).then(async (list) => {
      if (cancelled) return;
      if (!list || list.total === 0) return loadLegacy(1);
      setItems(list.items);
      setTotal(list.total);
      setMode('new');
      setError('');
      const [yearList, categoryList] = await Promise.all([fetchPublicYears(), fetchPublicCategories()]);
      if (cancelled) return;
      setYears(yearList || []);
      setCategories(categoryList || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [retry, loadLegacy]);

  useEffect(() => {
    if (mode !== 'new') return;
    let cancelled = false;
    setLoading(true);
    fetchPublicNews({ page, pageSize: 9, year: year || undefined, categoryId: categoryId || undefined }).then((list) => {
      if (cancelled) return;
      if (!list) {
        setError(t('新聞載入失敗，請稍後再試。', 'Failed to load news. Please try again later.'));
      } else {
        setItems(list.items);
        setTotal(list.total);
        setError('');
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [mode, page, year, categoryId, t]);

  useEffect(() => {
    if (mode === 'legacy') loadLegacy(page);
  }, [mode, page, loadLegacy]);

  const legacyCategories = useMemo(() => Array.from(new Set(legacyNews.map((item) => item.category).filter(Boolean))), [legacyNews]);
  const visibleLegacy = useMemo(() => legacyCategory === 'all' ? legacyNews : legacyNews.filter((item) => item.category === legacyCategory), [legacyCategory, legacyNews]);
  const viewItems = useMemo(() => mode === 'new' ? normalizePublicNews(items, lang, imgUrl) : normalizeLegacyNews(visibleLegacy, lang, imgUrl), [mode, items, visibleLegacy, lang]);
  const layout = useMemo(() => selectNewsLayout(viewItems, [], 2), [viewItems]);
  const filterCategories = mode === 'new'
    ? categories.map((entry) => ({ id: entry.id, name: lang === 'en' ? entry.nameEn || entry.nameZh : entry.nameZh }))
    : legacyCategories.map((entry) => ({ id: entry, name: entry }));
  const activeTotal = mode === 'new' ? total : legacyTotal;

  return (
    <PublicPageSwitch path="/news">
      <NewsExperience
        lang={lang}
        hero={{ title: t('洞察產業脈動，連接區塊鏈未來', 'Signals shaping the blockchain future'), subtitle: t('追蹤香港及全球區塊鏈生態的政策、技術與產業進展。', 'Tracking policy, technology and industry progress across Hong Kong and the global blockchain ecosystem.') }}
        featured={layout.featured}
        secondary={layout.secondary}
        feed={layout.feed}
        total={activeTotal}
        years={mode === 'new' ? years : []}
        categories={filterCategories}
        year={year}
        categoryId={mode === 'new' ? categoryId : legacyCategory === 'all' ? '' : legacyCategory}
        page={page}
        pageCount={activeTotal > 9 && (mode === 'new' || legacyCategory === 'all') ? Math.ceil(activeTotal / 9) : 1}
        loading={loading}
        initialLoading={loading && mode === null}
        error={error}
        showYearFilter={mode === 'new'}
        showCategoryFilter={filterCategories.length > 0}
        showSummary
        showDate
        onYearChange={(value) => { setYear(value); setPage(1); }}
        onCategoryChange={(value) => { if (mode === 'new') setCategoryId(value); else setLegacyCategory(value || 'all'); setPage(1); }}
        onPageChange={setPage}
        onRetry={() => setRetry((value) => value + 1)}
      />
    </PublicPageSwitch>
  );
}
