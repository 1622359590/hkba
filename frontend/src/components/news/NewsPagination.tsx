export default function NewsPagination({ page, pageCount, loading, onChange, lang }: { page: number; pageCount: number; loading: boolean; onChange: (page: number) => void; lang: 'zh' | 'en' }) {
  if (pageCount <= 1) return null;
  return <nav className="news-pagination" aria-label={lang === 'en' ? 'News pages' : '新聞頁碼'}>{Array.from({ length: pageCount }, (_, index) => index + 1).map((entry) => <button key={entry} type="button" aria-current={entry === page ? 'page' : undefined} disabled={loading || entry === page} onClick={() => onChange(entry)}>{String(entry).padStart(2, '0')}</button>)}</nav>;
}
