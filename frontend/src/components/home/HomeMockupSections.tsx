'use client';

import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import AnimatedStat from '@/components/home/AnimatedStat';
import HeroScanWordmark from '@/components/home/HeroScanWordmark';
import type { RenderBlock } from '@/components/blocks/BlockRenderer';

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export const HOME_MISSION_ZH = {
  overline: 'OUR MISSION',
  title: '推動香港成為全球區塊鏈創新樞鈕',
  description: 'HKBA 致力於連接政府、企業、投資者與技術社群，推動區塊鏈技術在各行各業的應用與發展，構建開放、協作、共贏的區塊鏈生態系統。',
  items: [
    { href: '/join', title: '連接生態', description: '連接全球區塊鏈項目、企業、投資者與技術專家，構建強大生態網絡。', icon: 'link' },
    { href: '/join', title: '行業賦能', description: '提供政策解讀、資源對接、培訓支持，助力會員成長與行業發展。', icon: 'shield' },
    { href: '/about', title: '國際合作', description: '促進國際交流與合作，推動香港區塊鏈技術與全球標準接軌。', icon: 'globe' },
    { href: '/about', title: '合規發展', description: '推動行業自律與合規建設，促進區塊鏈行業健康可持續發展。', icon: 'store' },
  ],
};

export const HOME_MISSION_EN = {
  overline: 'OUR MISSION',
  title: 'Advancing Hong Kong as a Global Blockchain Hub',
  description: 'HKBA connects government, enterprises, investors and technology communities to advance blockchain adoption and build an open, collaborative ecosystem.',
  items: [
    { href: '/join', title: 'Connect Ecosystems', description: 'Connect global blockchain projects, enterprises, investors and experts in a strong ecosystem.', icon: 'link' },
    { href: '/join', title: 'Empower Industry', description: 'Provide policy insight, resource matching and training to help members and the industry grow.', icon: 'shield' },
    { href: '/about', title: 'Global Collaboration', description: 'Promote international exchange and align Hong Kong blockchain innovation with global standards.', icon: 'globe' },
    { href: '/about', title: 'Responsible Growth', description: 'Advance industry standards and responsible practices for healthy, sustainable growth.', icon: 'store' },
  ],
};

const featureIcons: Record<string, React.ReactNode> = {
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  store: <><path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4" /><path d="M5 21V10.87M19 21V10.87" /></>,
};

type HomeSectionProps = {
  forceVisible?: boolean;
  langOverride?: 'zh' | 'en';
  block?: RenderBlock;
};

export function HomeHero({ forceVisible = false, langOverride }: HomeSectionProps = {}) {
  const language = useLang();
  const t = (zh: string, en: string) => (langOverride ?? language.lang) === 'en' ? en : zh;

  const moveGlassLight = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    event.currentTarget.style.setProperty('--glass-x', `${x}%`);
    event.currentTarget.style.setProperty('--glass-y', `${y}%`);
  };

  const resetGlassLight = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty('--glass-x', '34%');
    event.currentTarget.style.setProperty('--glass-y', '18%');
  };

  return (
    <section className={`hero${forceVisible ? ' visible' : ''}`}>
      <div className="hero-bg" aria-hidden="true" />
      <div className="hero-content">
        <div className="hero-glass" onPointerMove={moveGlassLight} onPointerLeave={resetGlassLight}>
          <div className="hero-glass__grid" aria-hidden="true" />
          <div className="hero-glass__content">
            <HeroScanWordmark />
            <p className="hero-subtitle">Hong Kong Blockchain Association</p>
            <div className="hero-line" />
            <div className="hero-actions">
              <Link href="/about" className="btn-hero-primary">
                {t('關於協會', 'About HKBA')}
                <ArrowIcon />
              </Link>
              <Link href="/join" className="btn-hero-secondary">
                {t('加入我們', 'Join Us')}
                <ArrowIcon />
              </Link>
            </div>
            <div className="hero-stats">
              <div className="hero-stat"><AnimatedStat value="200+" className="hero-stat-number" /><div className="hero-stat-label">{t('會員單位', 'Members')}</div></div>
              <div className="hero-stat-divider" />
              <div className="hero-stat"><AnimatedStat value="50+" className="hero-stat-number" /><div className="hero-stat-label">{t('行業活動', 'Events')}</div></div>
              <div className="hero-stat-divider" />
              <div className="hero-stat"><AnimatedStat value="5+" className="hero-stat-number" /><div className="hero-stat-label">{t('深耕年數', 'Years')}</div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeMission({ forceVisible = false, langOverride, block }: HomeSectionProps = {}) {
  const language = useLang();
  const lang = langOverride ?? language.lang;
  const defaults = lang === 'en' ? HOME_MISSION_EN : HOME_MISSION_ZH;
  const scope = block ? (lang === 'en' ? block.contentEn : block.contentZh) : defaults;
  const fallbackScope = block ? (lang === 'en' ? block.contentZh : block.contentEn) : defaults;
  const contentText = (key: 'overline' | 'title' | 'description') => {
    const current = scope[key];
    if (typeof current === 'string' && current.trim()) return current;
    const fallback = fallbackScope[key];
    return typeof fallback === 'string' && fallback.trim() ? fallback : defaults[key];
  };
  const configuredItems = Array.isArray(scope.items) ? scope.items : Array.isArray(fallbackScope.items) ? fallbackScope.items : defaults.items;
  const missionItems = configuredItems.length ? configuredItems as Array<Record<string, unknown>> : defaults.items;

  return (
    <section className="mission">
      <div className="mission-overline">{contentText('overline')}</div>
      <h2 className="mission-title">{contentText('title')}</h2>
      <p className="mission-desc">{contentText('description')}</p>
      <div className="feature-grid">
        {missionItems.map((feature, index) => (
          <Link href={String(feature.href || '/about')} className={`feature-card${forceVisible ? ' visible' : ''}`} key={`${String(feature.title || '')}-${index}`}>
            <div className="feature-card-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{featureIcons[String(feature.icon || 'link')] || featureIcons.link}</svg>
            </div>
            <div className="feature-card-title">{String(feature.title || '')}</div>
            <div className="feature-card-desc">{String(feature.description || '')}</div>
            <div className="feature-card-arrow"><ArrowIcon /></div>
          </Link>
        ))}
      </div>
    </section>
  );
}
