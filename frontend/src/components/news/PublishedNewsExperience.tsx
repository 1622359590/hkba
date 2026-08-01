'use client';

import { useEffect, useMemo, useState } from 'react';
import { imgUrl } from '@/lib/api';
import { fetchPublicCategories, fetchPublicNews, fetchPublicNewsByIds, fetchPublicYears, type PublicPage, type PublicNewsListItem } from '@/lib/publicContent';
import { normalizePublicNews, selectNewsLayout } from './newsViewModel.mjs';
import NewsExperience from './NewsExperience';

function content(block: PublicPage['blocks'][number] | undefined, lang: 'zh' | 'en') {
  if (!block) return {} as Record<string, unknown>;
  return (lang === 'en' ? block.contentEn : block.contentZh) as Record<string, unknown>;
}

export function hasPremiumNewsBlocks(page: PublicPage) {
  return page.blocks.some((block) => ['network-news', 'flagship', 'technology', 'editorial'].includes(String((block.settings as Record<string, unknown>).variant || '')));
}

export default function PublishedNewsExperience({ page: pageData, lang }: { page: PublicPage; lang: 'zh' | 'en' }) {
  const heroBlock = pageData.blocks.find((block) => block.component_type === 'content.hero');
  const featuredBlock = pageData.blocks.find((block) => block.component_type === 'news.featured');
  const filtersBlock = pageData.blocks.find((block) => block.component_type === 'news.category-tabs');
  const listBlock = pageData.blocks.find((block) => block.component_type === 'news.list');
  const heroContent = content(heroBlock, lang);
  const featuredSettings = (featuredBlock?.settings || {}) as Record<string, unknown>;
  const filterSettings = (filtersBlock?.settings || {}) as Record<string, unknown>;
  const listSettings = (listBlock?.settings || {}) as Record<string, unknown>;
  const initialYear = listSettings.yearMode === 'specific' ? Number(listSettings.year) || 0 : 0;
  const [items, setItems] = useState<PublicNewsListItem[]>([]);
  const [pinned, setPinned] = useState<PublicNewsListItem[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [categorySource, setCategorySource] = useState<Awaited<ReturnType<typeof fetchPublicCategories>>>([]);
  const [year, setYear] = useState(initialYear);
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const pageSize = Math.min(50, Math.max(5, Number(listSettings.pageSize || listSettings.limit || 9)));
  const pinnedIds = Array.isArray(featuredSettings.pinnedIds) ? featuredSettings.pinnedIds.filter((id): id is string => typeof id === 'string') : [];
  const configuredCategoryIds = Array.isArray(listSettings.categoryIds) ? listSettings.categoryIds.filter((id): id is string => typeof id === 'string') : [];

  useEffect(() => {
    Promise.all([fetchPublicYears(), fetchPublicCategories()]).then(([yearList, categoryList]) => {
      setYears(yearList || []);
      setCategorySource(categoryList || []);
      if (listSettings.yearMode === 'latest' && yearList?.[0]) setYear(yearList[0]);
    });
  }, [listSettings.yearMode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const listPromise = fetchPublicNews({ page, pageSize, year: year || undefined, categoryId: categoryId || configuredCategoryIds[0] || undefined });
    const pinnedPromise = featuredSettings.source === 'pinned' ? fetchPublicNewsByIds(pinnedIds) : Promise.resolve([]);
    Promise.all([listPromise, pinnedPromise]).then(([list, pinnedItems]) => {
      if (cancelled) return;
      if (!list) {
        setError(lang === 'en' ? 'Failed to load news. Please try again later.' : '新聞載入失敗，請稍後再試。');
      } else {
        setItems(list.items);
        setTotal(list.total);
        setPinned(pinnedItems || []);
        setError('');
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [page, pageSize, year, categoryId, retry, lang, featuredSettings.source, pinnedIds.join(',')]);

  const viewItems = useMemo(() => normalizePublicNews(items, lang, imgUrl), [items, lang]);
  const pinnedItems = useMemo(() => normalizePublicNews(pinned, lang, imgUrl), [pinned, lang]);
  const secondaryCount = Math.min(4, Math.max(2, Number(featuredSettings.secondaryCount || 2)));
  const selectedPinned = featuredSettings.source === 'pinned' && (pinnedItems.length || featuredSettings.fallbackToLatest === false) ? pinnedItems : [];
  const layout = useMemo(() => selectNewsLayout(viewItems, selectedPinned, secondaryCount), [viewItems, selectedPinned, secondaryCount]);
  const categories = (categorySource || []).filter((entry) => !configuredCategoryIds.length || configuredCategoryIds.includes(entry.id)).slice(0, Number(filterSettings.maxTabs || 8)).map((entry) => ({ id: entry.id, name: lang === 'en' ? entry.nameEn || entry.nameZh : entry.nameZh }));

  return <NewsExperience lang={lang} hero={{ title: String(heroContent.title || pageData.titleZh), subtitle: String(heroContent.subtitle || '') }} featured={layout.featured} secondary={layout.secondary} feed={layout.feed} total={total} years={years} categories={categories} year={year} categoryId={categoryId} page={page} pageCount={Math.max(1, Math.ceil(total / pageSize))} loading={loading} initialLoading={loading && !items.length} error={error} showYearFilter={filterSettings.showYearFilter !== false} showCategoryFilter={filterSettings.showCategoryFilter !== false} showSummary={listSettings.showSummary !== false} showDate={listSettings.showDate !== false} onYearChange={(value) => { setYear(value); setPage(1); }} onCategoryChange={(value) => { setCategoryId(value); setPage(1); }} onPageChange={setPage} onRetry={() => setRetry((value) => value + 1)} />;
}
