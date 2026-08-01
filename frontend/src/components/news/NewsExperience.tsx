import Link from 'next/link';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import FeaturedNews from './FeaturedNews';
import NewsFeed from './NewsFeed';
import NewsFilters from './NewsFilters';
import NewsHero from './NewsHero';
import NewsLoadingSkeleton from './NewsLoadingSkeleton';
import NewsPagination from './NewsPagination';
import type { NewsFilterCategory, NewsViewItem } from './newsTypes';

export type NewsExperienceProps = {
  lang: 'zh' | 'en'; hero: { title: string; subtitle: string }; featured: NewsViewItem | null; secondary: NewsViewItem[]; feed: NewsViewItem[];
  total: number; years: number[]; categories: NewsFilterCategory[]; year: number; categoryId: string; page: number; pageCount: number;
  loading: boolean; initialLoading: boolean; error: string; showYearFilter: boolean; showCategoryFilter: boolean; showSummary: boolean; showDate: boolean;
  onYearChange: (year: number) => void; onCategoryChange: (categoryId: string) => void; onPageChange: (page: number) => void; onRetry: () => void;
};

export default function NewsExperience(props: NewsExperienceProps) {
  const { lang, hero, featured, secondary, feed, total, years, categories, year, categoryId, page, pageCount, loading, initialLoading, error } = props;
  return <main className="news-page"><NewsHero lang={lang} title={hero.title} subtitle={hero.subtitle} total={total} categoryCount={categories.length} activeYear={year || undefined} latestDate={featured?.date} /><div className="news-page__content"><NewsFilters lang={lang} years={years} categories={categories} year={year} categoryId={categoryId} loading={loading} showYearFilter={props.showYearFilter} showCategoryFilter={props.showCategoryFilter} onYearChange={props.onYearChange} onCategoryChange={props.onCategoryChange} /><div className="news-results" aria-busy={loading} data-loading={loading && !initialLoading ? 'true' : undefined}>{initialLoading ? <NewsLoadingSkeleton label={lang === 'en' ? 'Loading news' : '正在載入新聞'} /> : null}{error ? <ErrorState message={error} onRetry={props.onRetry} /> : null}{!initialLoading && !error && featured ? <><FeaturedNews featured={featured} secondary={secondary} lang={lang} showSummary={props.showSummary} showDate={props.showDate} /><NewsFeed items={feed} lang={lang} showSummary={props.showSummary} showDate={props.showDate} /></> : null}{!initialLoading && !error && !featured ? <EmptyState title={lang === 'en' ? 'No news yet' : '暫無新聞內容'} description={lang === 'en' ? 'Association news is being prepared.' : '協會新聞正在整理中，歡迎稍後再來。'} action={<Link href="/contact" className="btn-secondary">{lang === 'en' ? 'Contact HKBA' : '聯絡協會'}</Link>} /> : null}</div><NewsPagination page={page} pageCount={pageCount} loading={loading} onChange={props.onPageChange} lang={lang} /></div></main>;
}
