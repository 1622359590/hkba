import Link from 'next/link';
import type { NewsViewItem } from './newsTypes';

export default function NewsFeed({ items, lang, showSummary = true, showDate = true }: { items: NewsViewItem[]; lang: 'zh' | 'en'; showSummary?: boolean; showDate?: boolean }) {
  if (!items.length) return null;
  return <section className="news-feed" aria-labelledby="news-feed-title"><header className="news-section-heading"><div><span>NEWS LEDGER / ARCHIVE</span><h2 id="news-feed-title">{lang === 'en' ? 'More from the network' : '更多網絡動態'}</h2></div><small>{String(items.length).padStart(2, '0')} ENTRIES</small></header><ol>{items.map((item, index) => <li key={item.id}><Link href={item.href}><span className="news-feed__index">#{String(index + 1).padStart(2, '0')}</span><div><span className="news-story__meta">{[item.category, showDate ? item.date : ''].filter(Boolean).join(' · ')}</span><h3>{item.title}</h3>{showSummary && item.summary ? <p>{item.summary}</p> : null}</div><span className="news-story__arrow" aria-hidden="true">↗</span></Link></li>)}</ol></section>;
}
