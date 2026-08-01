import Link from 'next/link';
import NewsArtwork from './NewsArtwork';
import type { NewsViewItem } from './newsTypes';

function StoryMeta({ item, showDate }: { item: NewsViewItem; showDate: boolean }) {
  return <span className="news-story__meta">{[item.category, showDate ? item.date : ''].filter(Boolean).join(' · ')}</span>;
}

export default function FeaturedNews({ featured, secondary, lang, showSummary = true, showDate = true }: { featured: NewsViewItem; secondary: NewsViewItem[]; lang: 'zh' | 'en'; showSummary?: boolean; showDate?: boolean }) {
  return (
    <section className="news-featured" aria-labelledby="news-featured-title">
      <header className="news-section-heading"><div><span>LATEST SIGNALS / {lang === 'en' ? 'NEWS' : '最新動態'}</span><h2 id="news-featured-title">{lang === 'en' ? 'Association news & insights' : '協會新聞與行業觀察'}</h2></div><small>{String(secondary.length + 1).padStart(2, '0')} STORIES</small></header>
      <div className="news-featured__grid">
        <article className="news-featured__main"><Link href={featured.href}><NewsArtwork image={featured.image} /><div className="news-featured__caption"><StoryMeta item={featured} showDate={showDate} /><h3>{featured.title}</h3>{showSummary && featured.summary ? <p>{featured.summary}</p> : null}<span className="news-story__arrow" aria-hidden="true">↗</span></div></Link></article>
        <div className="news-featured__secondary">
          {secondary.map((item) => <article key={item.id}><Link href={item.href}><div><StoryMeta item={item} showDate={showDate} /><h3>{item.title}</h3>{showSummary && item.summary ? <p>{item.summary}</p> : null}</div><span className="news-story__arrow" aria-hidden="true">↗</span></Link></article>)}
        </div>
      </div>
    </section>
  );
}
