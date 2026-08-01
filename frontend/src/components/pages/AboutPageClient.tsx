'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/useLang';
import { apiGet, imgUrl, isPlaceholderPartnerName, type PageContent, type Milestone, type StatItem, type Partner, type TeamMember, type NewsItem } from '@/lib/api';
import Link from 'next/link';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback';
import PublicPageSwitch from '@/components/PublicPageSwitch';
import PartnerCarousel from '@/components/ui/PartnerCarousel';

const c: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '0 24px' };
const sec: React.CSSProperties = { padding: '96px 0' };
const secB: React.CSSProperties = { ...sec, borderTop: '1px solid rgba(255,255,255,0.06)' };
const gl: Record<string, { zh: string; en: string }> = { honorary_chairman: { zh: '榮譽主席', en: 'Honorary Chairman' }, chairman: { zh: '會長', en: 'Chairman' }, vice_chairman: { zh: '副會長', en: 'Vice Chairman' }, committee: { zh: '委員', en: 'Committee' }, advisor: { zh: '顧問', en: 'Advisor' } };

export default function AboutPage() {
  const { t } = useLang();
  const [page, setPage] = useState<PageContent | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [stats, setStats] = useState<StatItem[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.allSettled([
      apiGet<PageContent>('/api/pages/about'),
      apiGet<Milestone[]>('/api/milestones'),
      apiGet<StatItem[]>('/api/stats'),
      apiGet<Partner[]>('/api/partners'),
      apiGet<TeamMember[]>('/api/team'),
      apiGet<{ items: NewsItem[] }>('/api/news?limit=3'),
    ]).then(results => {
      if (cancelled) return;
      const pageResult = results[0] as PromiseSettledResult<PageContent>;
      const milestonesResult = results[1] as PromiseSettledResult<Milestone[]>;
      const statsResult = results[2] as PromiseSettledResult<StatItem[]>;
      const partnersResult = results[3] as PromiseSettledResult<Partner[]>;
      const teamResult = results[4] as PromiseSettledResult<TeamMember[]>;
      const newsResult = results[5] as PromiseSettledResult<{ items: NewsItem[] }>;
      if (pageResult.status === 'fulfilled') setPage(pageResult.value);
      if (milestonesResult.status === 'fulfilled') setMilestones(milestonesResult.value);
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (partnersResult.status === 'fulfilled') setPartners(partnersResult.value);
      if (teamResult.status === 'fulfilled') setTeam(teamResult.value);
      if (newsResult.status === 'fulfilled') setNews(newsResult.value.items);
      if (results.every(result => result.status === 'rejected')) setError(t('協會資料載入失敗，請重新載入。', 'Unable to load association information. Please try again.'));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry, t]);

  return (
    <PublicPageSwitch path="/about">
      <>
      <section style={{ ...sec, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)' }} />
        <div style={{ ...c, position: 'relative' }}>
          <div style={{ animation: 'fadeInUp 0.8s cubic-bezier(0.22,1,0.36,1) forwards' }}>
            <div className="section-label">{t('關於協會', 'About')}</div>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 20 }}>{page ? t(page.title_zh, page.title_en) : t('關於我們', 'About Us')}</h1>
            <div className="divider" />
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 64 }}>
        <div style={{ ...c, maxWidth: 800 }}>
          {loading && <LoadingState label={t('正在載入協會資料...', 'Loading association information...')} />}
          {!loading && error && <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />}
          {!loading && !error && page && <div className="prose" style={{ animation: 'fadeInUp 0.6s 0.2s cubic-bezier(0.22,1,0.36,1) forwards' }} dangerouslySetInnerHTML={{ __html: t(page.content_zh, page.content_en) }} />}
          {!loading && !error && !page && <EmptyState title={t('協會介紹正在整理中', 'Association profile is being prepared')} description={t('歡迎先聯絡協會了解更多資訊。', 'Contact HKBA to learn more about the association.')} action={<Link href="/contact" className="btn-secondary">{t('聯絡我們', 'Contact HKBA')}</Link>} />}
        </div>
      </section>

      {stats.length > 0 && (
        <section style={secB}>
          <div style={c}>
            <div className="glass-card" style={{ padding: '48px 32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 32 }}>
                {stats.map(s => <div key={s.id} style={{ textAlign: 'center' }}><div className="metric-accent" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 700, marginBottom: 4 }}>{s.value}</div><div style={{ fontSize: 12, color: '#71717a' }}>{t(s.label_zh, s.label_en)}</div></div>)}
              </div>
            </div>
          </div>
        </section>
      )}

      {milestones.length > 0 && (
        <section style={{ ...secB, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.05) 0%, transparent 60%)' }} />
          <div style={{ ...c, position: 'relative', maxWidth: 700, textAlign: 'center' }}>
            <div className="section-label">{t('發展歷程', 'Our Journey')}</div>
            <h2 className="section-title" style={{ marginBottom: 48 }}>{t('協會里程碑', 'Key Milestones')}</h2>
            <div style={{ position: 'relative', textAlign: 'left' }}>
              <div style={{ position: 'absolute', left: 5, top: 0, bottom: 0, width: 1, background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent)' }} />
              {milestones.map((m, i) => (
                <div key={m.id} className="content-reveal" style={{ display: 'flex', gap: 20, marginBottom: 36, animationDelay: `${0.1 * i}s` }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#6366f1', flexShrink: 0, marginTop: 4, boxShadow: '0 0 0 4px #09090b' }} />
                  <div><div className="metric-accent" style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{m.year}</div><h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{t(m.title_zh, m.title_en)}</h4><p style={{ fontSize: 14, color: '#71717a', lineHeight: 1.6 }}>{t(m.description_zh, m.description_en)}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {partners.length > 0 && (
        <section style={secB}>
          <div style={c}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}><div className="section-label">{t('合作夥伴', 'Partners')}</div><h2 className="section-title">{t('攜手共建生態', 'Building Together')}</h2></div>
            <div style={{ maxWidth: 980, margin: '0 auto' }}>
              <PartnerCarousel
                items={partners}
                ariaLabel={t('合作夥伴', 'Partners')}
                autoPlay
                speed="slow"
                direction="left"
                pauseOnHover
                className="hk-partner-carousel about-partner-carousel"
                renderItem={(partner, duplicate) => {
                  const partnerName = isPlaceholderPartnerName(partner.name) ? t('合作夥伴', 'Partner Organization') : partner.name;
                  const logo = (
                    <div className="hk-partner__tile">
                      <img src={imgUrl(partner.logo_url)} alt={duplicate ? '' : partnerName} />
                    </div>
                  );
                  return partner.website_url ? (
                    <a
                      href={partner.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hk-partner"
                      aria-label={duplicate ? undefined : `${partnerName} website`}
                      tabIndex={duplicate ? -1 : undefined}
                    >
                      {logo}
                    </a>
                  ) : <div className="hk-partner">{logo}</div>;
                }}
              />
            </div>
          </div>
        </section>
      )}

      {team.length > 0 && (
        <section style={secB}>
          <div style={c}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}><div className="section-label">{t('領導團隊', 'Leadership')}</div><h2 className="section-title">{t('顧問委員會', 'Advisory Board')}</h2></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {team.slice(0, 4).map(m => (
                <div key={m.id} className="glass-card profile-card">
                  <div className="profile-card__head">
                    <div className="profile-card__avatar-wrap">
                      <img className="profile-card__avatar" src={imgUrl(m.avatar_url)} alt={t(m.name_zh, m.name_en)} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span className="profile-card__eyebrow">{t(gl[m.group_name]?.zh || m.group_name, gl[m.group_name]?.en || m.group_name)}</span>
                      <h4 className="profile-card__name">{t(m.name_zh, m.name_en)}</h4>
                    </div>
                  </div>
                  <p className="profile-card__title">{t(m.title_zh, m.title_en)}</p>
                  {(m.bio_zh || m.bio_en) && <p className="profile-card__bio">{t(m.bio_zh, m.bio_en)}</p>}
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 32 }}><Link href="/team" className="btn-secondary">{t('查看全部', 'View All')} →</Link></div>
          </div>
        </section>
      )}

      {news.length > 0 && (
        <section style={secB}>
          <div style={c}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}><div className="section-label">{t('最新動態', 'Latest')}</div><h2 className="section-title">{t('協會新聞', 'News')}</h2></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {news.map(item => <Link key={item.id} href={`/news/${item.id}`} className="glass-card" style={{ overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit' }}>{item.cover_image && <div style={{ height: 160, overflow: 'hidden' }}><img src={imgUrl(item.cover_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}<div style={{ padding: 20 }}><h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#fff' }}>{t(item.title_zh, item.title_en)}</h3><p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t(item.summary_zh, item.summary_en)}</p></div></Link>)}
            </div>
          </div>
        </section>
      )}
    </>
    </PublicPageSwitch>
  );
}
