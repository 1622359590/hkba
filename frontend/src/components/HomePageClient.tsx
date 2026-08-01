'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/useLang';
import { apiGet, imgUrl, isPlaceholderPartnerName, type Announcement, type Partner, type TeamMember, type NewsItem, type StatItem, type Milestone } from '@/lib/api';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/Feedback';
import PublicPageSwitch from '@/components/PublicPageSwitch';
import GlowCard from '@/components/ui/GlowCard';
import ParallaxSection from '@/components/ui/ParallaxSection';
import PartnerCarousel from '@/components/ui/PartnerCarousel';
import { HomeHero, HomeMission } from '@/components/home/HomeMockupSections';

/* ═══ Shared Styles ═══ */
const container: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '0 24px' };
const sectionBase: React.CSSProperties = { padding: '96px 0' };
const sectionBorder: React.CSSProperties = { ...sectionBase, borderTop: '1px solid rgba(255,255,255,0.06)' };

function FadeIn({ children, delay = 0, style = {} }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  return <div className="fade-in-up" style={{ transitionDelay: `${delay}s`, ...style }}>{children}</div>;
}

export default function Home() {
  const { lang, t } = useLang();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [stats, setStats] = useState<StatItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      apiGet<Announcement[]>('/api/announcements'),
      apiGet<Partner[]>('/api/partners'),
      apiGet<TeamMember[]>('/api/team'),
      apiGet<{ items: NewsItem[] }>('/api/news?limit=6'),
      apiGet<StatItem[]>('/api/stats'),
      apiGet<Milestone[]>('/api/milestones'),
    ]).then(results => {
      if (cancelled) return;
      const announcementsResult = results[0] as PromiseSettledResult<Announcement[]>;
      const partnersResult = results[1] as PromiseSettledResult<Partner[]>;
      const teamResult = results[2] as PromiseSettledResult<TeamMember[]>;
      const newsResult = results[3] as PromiseSettledResult<{ items: NewsItem[] }>;
      const statsResult = results[4] as PromiseSettledResult<StatItem[]>;
      const milestonesResult = results[5] as PromiseSettledResult<Milestone[]>;
      if (announcementsResult.status === 'fulfilled') setAnnouncements(announcementsResult.value);
      if (partnersResult.status === 'fulfilled') setPartners(partnersResult.value);
      if (teamResult.status === 'fulfilled') setTeam(teamResult.value);
      if (newsResult.status === 'fulfilled') setNews(newsResult.value.items);
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (milestonesResult.status === 'fulfilled') setMilestones(milestonesResult.value);
    });
    return () => { cancelled = true; };
  }, []);

  const teamGroups = team.reduce((a, m) => { if (!a[m.group_name]) a[m.group_name] = []; a[m.group_name].push(m); return a; }, {} as Record<string, TeamMember[]>);
  const gl: Record<string, { zh: string; en: string }> = { honorary_chairman: { zh: '榮譽主席', en: 'Honorary Chairman' }, chairman: { zh: '會長', en: 'Chairman' }, vice_chairman: { zh: '副會長', en: 'Vice Chairman' }, committee: { zh: '委員', en: 'Committee' }, advisor: { zh: '顧問', en: 'Advisor' } };
  const fallbackStats: StatItem[] = [
    { id: -1, label_zh: '成立年份', label_en: 'Founded', value: '2017', icon: 'calendar' },
    { id: -2, label_zh: '會員企業', label_en: 'Members', value: '200+', icon: 'building' },
    { id: -3, label_zh: '行業夥伴', label_en: 'Partners', value: '100+', icon: 'handshake' },
    { id: -4, label_zh: '覆蓋國家', label_en: 'Countries', value: '20+', icon: 'globe' },
  ];
  const displayStats = stats.length ? stats : fallbackStats;
  return (
    <PublicPageSwitch path="/">
      <>
      <HomeHero />
      <HomeMission />

      {/* ═══ ANNOUNCEMENTS ═══ */}
      {announcements.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
          <div style={{ ...container, display: 'flex', alignItems: 'center', gap: 16, height: 44 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--indigo)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{t('公告', 'Notice')}</span>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ display: 'flex', gap: 48, whiteSpace: 'nowrap', animation: 'slideLeft 30s linear infinite' }}>
                {[...announcements, ...announcements].map((a, i) => <span key={`${a.id}-${i}`} style={{ fontSize: 14, color: '#a1a1aa' }}>{t(a.content_zh, a.content_en)}</span>)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="section-divider" />

      {/* ═══ ABOUT ═══ */}
      <section style={sectionBase}>
        <ParallaxSection speed={0.18}>
        <div style={container}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 64, alignItems: 'center' }}>
            <FadeIn>
              <div className="section-label">{t('關於協會', 'About')}</div>
              <h2 className="section-title">{t('推動區塊鏈技術在香港的發展', 'Driving Blockchain Innovation in HK')}</h2>
              <p className="section-desc" style={{ marginBottom: 32 }}>{t('香港區塊鏈協會成立於2017年，致力於促進香港的區塊鏈生態系統發展，推動區塊鏈技術在不同領域的應用。', 'Founded in 2017, HKBA fosters Hong Kong\'s blockchain ecosystem and promotes blockchain technology across sectors.')}</p>
              <div style={{ display: 'flex', gap: 12 }}><Link href="/about" className="btn-primary">{t('了解更多', 'Learn More')} →</Link><Link href="/contact" className="btn-secondary">{t('聯絡我們', 'Contact')}</Link></div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: -16, borderRadius: 24, background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(103,232,249,0.08))', filter: 'blur(40px)' }} />
                <GlowCard className="glass-card home-stats-card" glowColor="rgba(99,102,241,0.12)">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                    {displayStats.map(s => (
                      <div key={s.id} style={{ textAlign: 'center' }}>
                        <div className="metric-accent" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 700, marginBottom: 4 }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: '#71717a' }}>{t(s.label_zh, s.label_en)}</div>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              </div>
            </FadeIn>
          </div>
        </div>
        </ParallaxSection>
      </section>

      <div className="section-divider" />

      {/* ═══ NEWS ═══ */}
      <section style={sectionBorder}>
        <div style={container}>
          <FadeIn>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, marginBottom: 48, flexWrap: 'wrap' }}>
              <div>
                <div className="section-label">{t('最新動態', 'Latest')}</div>
                <h2 className="section-title">{t('新聞資訊', 'News & Insights')}</h2>
              </div>
              <Link href="/news" className="btn-secondary" style={{ fontSize: 13 }}>{t('查看全部', 'View All')} →</Link>
            </div>
          </FadeIn>
          {news.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
              {news.slice(0, 3).map((item, i) => (
                <FadeIn key={item.id} delay={i * 0.1}>
                  <Link href={`/news/${item.id}`} className="glass-card" style={{ overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit' }}>
                    {item.cover_image && <div style={{ height: 200, overflow: 'hidden' }}><img src={imgUrl(item.cover_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }} /></div>}
                    <div style={{ padding: 24 }}>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.category}</span>
                        {item.published_at && <span style={{ fontSize: 12, color: '#52525b' }}>{new Date(item.published_at).toLocaleDateString()}</span>}
                      </div>
                      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, lineHeight: 1.4, color: '#fff' }}>{t(item.title_zh, item.title_en)}</h3>
                      <p style={{ fontSize: 14, color: '#71717a', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t(item.summary_zh, item.summary_en)}</p>
                    </div>
                  </Link>
                </FadeIn>
              ))}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 14, color: '#a1a1aa' }}>{t('新聞內容正在整理中，您可以先聯絡協會了解最新活動。', 'News is being curated. Contact HKBA for the latest updates.')}</p>
              <Link href="/contact" className="btn-secondary" style={{ fontSize: 13 }}>{t('聯絡我們', 'Contact')}</Link>
            </div>
          )}
        </div>
      </section>

      {/* ═══ MILESTONES ═══ */}
      {milestones.length > 0 && (
        <section style={{ ...sectionBorder, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 60%)' }} />
          <div style={{ ...container, position: 'relative' }}>
            <FadeIn style={{ textAlign: 'center', marginBottom: 64 }}>
              <div className="section-label">{t('發展歷程', 'Our Journey')}</div>
              <h2 className="section-title">{t('協會里程碑', 'Key Milestones')}</h2>
            </FadeIn>
            <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, width: 1, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent)' }} />
              {milestones.map((m, i) => (
                <FadeIn key={m.id} delay={i * 0.1}>
                  <div style={{ display: 'flex', gap: 24, marginBottom: 40, position: 'relative' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--indigo)', flexShrink: 0, marginTop: 4, boxShadow: '0 0 0 4px #09090b', position: 'relative', zIndex: 1 }} />
                    <div>
                      <div className="metric-accent" style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{m.year}</div>
                      <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{t(m.title_zh, m.title_en)}</h4>
                      <p style={{ fontSize: 14, color: '#71717a', lineHeight: 1.6 }}>{t(m.description_zh, m.description_en)}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ TEAM ═══ */}
      {(
        <section style={sectionBorder}>
          <div style={container}>
            <FadeIn style={{ textAlign: 'center', marginBottom: 64 }}>
              <div className="section-label">{t('領導團隊', 'Leadership')}</div>
              <h2 className="section-title">{t('顧問委員會', 'Advisory Board')}</h2>
            </FadeIn>
            {Object.keys(teamGroups).length > 0 ? Object.entries(teamGroups).map(([group, members]) => (
              <div key={group} style={{ marginBottom: 48 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 32, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t(gl[group]?.zh || group, gl[group]?.en || group)}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
                  {members.map((m, i) => (
                    <FadeIn key={m.id} delay={i * 0.08}>
                      <GlowCard className="glass-card profile-card" glowColor="rgba(103,232,249,0.10)">
                        <div className="profile-card__head">
                          <div className="profile-card__avatar-wrap">
                            <img className="profile-card__avatar" src={imgUrl(m.avatar_url)} alt={t(m.name_zh, m.name_en)} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <span className="profile-card__eyebrow">{t(gl[group]?.zh || group, gl[group]?.en || group)}</span>
                            <h4 className="profile-card__name">{t(m.name_zh, m.name_en)}</h4>
                          </div>
                        </div>
                        <p className="profile-card__title">{t(m.title_zh, m.title_en)}</p>
                        {(m.bio_zh || m.bio_en) && <p className="profile-card__bio">{t(m.bio_zh, m.bio_en)}</p>}
                      </GlowCard>
                    </FadeIn>
                  ))}
                </div>
              </div>
            )) : <EmptyState title={t('委員資料正在整理中', 'Committee profiles are being prepared')} description={t('歡迎聯絡協會了解最新團隊資訊。', 'Contact HKBA for the latest leadership information.')} action={<Link href="/contact" className="btn-secondary">{t('聯絡我們', 'Contact HKBA')}</Link>} />}
            <div style={{ textAlign: 'center' }}><Link href="/team" className="btn-secondary">{t('查看全部團隊', 'View Full Team')} →</Link></div>
          </div>
        </section>
      )}

      {/* ═══ PARTNERS ═══ */}
      {(
        <section style={sectionBorder}>
          <div style={container}>
            <FadeIn style={{ textAlign: 'center', marginBottom: 64 }}>
              <div className="section-label">{t('合作夥伴', 'Partners')}</div>
              <h2 className="section-title">{t('攜手共建生態', 'Building Together')}</h2>
            </FadeIn>
            {partners.length > 0 ? (
              <PartnerCarousel
                items={partners}
                ariaLabel={t('合作夥伴', 'Partners')}
                autoPlay
                speed="slow"
                direction="left"
                pauseOnHover
                className="home-partner-carousel"
                renderItem={(partner, duplicate) => {
                  const href = partner.website_url || '/members';
                  const partnerName = isPlaceholderPartnerName(partner.name) ? t('合作夥伴', 'Partner Organization') : partner.name;
                  const card = (
                    <div className="partner-card">
                      <img className="partner-logo" src={imgUrl(partner.logo_url)} alt={duplicate ? '' : partnerName} />
                    </div>
                  );
                  return partner.website_url ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="partner-link"
                      aria-label={duplicate ? undefined : `${partnerName} website`}
                      tabIndex={duplicate ? -1 : undefined}
                    >
                      {card}
                    </a>
                  ) : (
                    <Link
                      href={href}
                      className="partner-link"
                      aria-label={duplicate ? undefined : `${partnerName} member profile`}
                      tabIndex={duplicate ? -1 : undefined}
                    >
                      {card}
                    </Link>
                  );
                }}
              />
            ) : <EmptyState title={t('合作夥伴資料正在整理中', 'Partner directory is being prepared')} description={t('歡迎聯絡協會了解合作方式。', 'Contact HKBA to learn about partnership opportunities.')} action={<Link href="/contact" className="btn-secondary">{t('聯絡我們', 'Contact HKBA')}</Link>} />}
          </div>
        </section>
      )}

      {/* ═══ CTA ═══ */}
      <section style={{ ...sectionBorder, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.08) 0%, transparent 60%)' }} />
        <div style={{ ...container, position: 'relative', textAlign: 'center', maxWidth: 700 }}>
          <FadeIn>
            <div className="section-label">{t('加入我們', 'Join Us')}</div>
            <h2 className="section-title">{t('成為香港區塊鏈協會的一員', 'Become Part of HKBA')}</h2>
            <p className="section-desc" style={{ margin: '0 auto 40px', textAlign: 'center' }}>{t('與業界精英共同推動區塊鏈技術發展，拓展國際市場，共享行業資源。', 'Work with industry leaders to advance blockchain technology and share resources.')}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/members" className="btn-primary">{t('成為會員', 'Join')} →</Link>
              <Link href="/contact" className="btn-secondary">{t('聯絡我們', 'Contact')}</Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </>
    </PublicPageSwitch>
  );
}
