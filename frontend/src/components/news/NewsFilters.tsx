import type { NewsFilterCategory } from './newsTypes';

export default function NewsFilters({ lang, years, categories, year, categoryId, loading, showYearFilter, showCategoryFilter, onYearChange, onCategoryChange }: {
  lang: 'zh' | 'en'; years: number[]; categories: NewsFilterCategory[]; year: number; categoryId: string; loading: boolean;
  showYearFilter: boolean; showCategoryFilter: boolean; onYearChange: (value: number) => void; onCategoryChange: (value: string) => void;
}) {
  if ((!showYearFilter || years.length < 2) && (!showCategoryFilter || categories.length === 0)) return null;
  return (
    <div className="news-filters">
      {showYearFilter && years.length > 1 ? <div className="news-filters__group" role="group" aria-label={lang === 'en' ? 'Filter by year' : '按年份篩選'}>
        <span>{lang === 'en' ? 'Year' : '年份'}</span>
        <button type="button" aria-pressed={year === 0} disabled={loading} onClick={() => onYearChange(0)}>{lang === 'en' ? 'All' : '全部'}</button>
        {years.map((entry) => <button key={entry} type="button" aria-pressed={year === entry} disabled={loading} onClick={() => onYearChange(entry)}>{entry}</button>)}
      </div> : null}
      {showCategoryFilter && categories.length ? <div className="news-filters__group" role="group" aria-label={lang === 'en' ? 'Filter by category' : '按欄目篩選'}>
        <span>{lang === 'en' ? 'Category' : '欄目'}</span>
        <button type="button" aria-pressed={!categoryId} disabled={loading} onClick={() => onCategoryChange('')}>{lang === 'en' ? 'All' : '全部'}</button>
        {categories.map((entry) => <button key={entry.id} type="button" aria-pressed={categoryId === entry.id} disabled={loading} onClick={() => onCategoryChange(entry.id)}>{entry.name}</button>)}
      </div> : null}
    </div>
  );
}
