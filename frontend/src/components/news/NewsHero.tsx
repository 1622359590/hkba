export type NewsHeroProps = {
  lang: 'zh' | 'en';
  title: string;
  subtitle: string;
  total: number;
  categoryCount: number;
  activeYear?: number;
  latestDate?: string;
};

export default function NewsHero({ lang, title, subtitle, total, categoryCount, activeYear, latestDate }: NewsHeroProps) {
  const displayTitle = title || (lang === 'en' ? 'Signals shaping the blockchain future' : '洞察產業脈動，連接區塊鏈未來');
  const splitAt = lang === 'en' ? displayTitle.lastIndexOf(' ') : Math.max(4, Math.floor(displayTitle.length * 0.52));
  const first = splitAt > 0 ? displayTitle.slice(0, splitAt) : displayTitle;
  const accent = splitAt > 0 ? displayTitle.slice(splitAt).trim() : '';
  return (
    <section className="news-hero" aria-labelledby="news-page-title">
      <div className="news-hero__grid" aria-hidden="true" />
      <div className="news-hero__coordinates">22.3193° N · 114.1694° E · <span>NETWORK ONLINE</span></div>
      <div className="news-hero__copy">
        <p className="news-hero__eyebrow">HKBA INTELLIGENCE NETWORK</p>
        <h1 id="news-page-title">{first}{accent ? <><br /><span>{accent}</span></> : null}</h1>
        <p className="news-hero__summary">{subtitle || (lang === 'en' ? 'Tracking policy, technology and industry progress across Hong Kong and the global blockchain ecosystem.' : '追蹤香港及全球區塊鏈生態的政策、技術與產業進展。')}</p>
      </div>
      <svg className="news-hero__network" viewBox="0 0 390 205" aria-hidden="true">
        <circle cx="210" cy="100" r="70" className="ring" /><circle cx="210" cy="100" r="104" className="ring" />
        <path d="M42 154 117 75 210 100 300 45 356 126 277 171 210 100 137 168 117 75" />
        <path className="hot-path" d="M117 75 210 100 300 45" />
        {[[42,154],[117,75],[210,100],[300,45],[356,126],[277,171],[137,168]].map(([cx, cy], index) => <circle key={index} cx={cx} cy={cy} r={index === 2 ? 5 : 4} className={index > 0 && index < 4 ? 'hot-node' : ''} />)}
      </svg>
      <aside className="news-hero__pulse" aria-label={lang === 'en' ? 'Ecosystem content pulse' : '生態內容脈衝'}>
        <i aria-hidden="true" /><span><b>ECOSYSTEM PULSE</b><small>{lang === 'en' ? 'PUBLISHED SIGNALS' : '已發佈訊號'}</small></span><strong>{total}</strong>
      </aside>
      <dl className="news-hero__rail">
        <div><dt>PUBLICATIONS</dt><dd>{total}</dd></div>
        <div><dt>CATEGORIES</dt><dd>{categoryCount}</dd></div>
        <div><dt>ACTIVE YEAR</dt><dd>{activeYear || new Date().getFullYear()}</dd></div>
        <div><dt>LAST UPDATE</dt><dd>{latestDate || '—'}</dd></div>
      </dl>
    </section>
  );
}
