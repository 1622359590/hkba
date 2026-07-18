'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/useLang';
import { apiGet, imgUrl, type TeamMember } from '@/lib/api';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback';
import PublicPageSwitch from '@/components/PublicPageSwitch';

const c: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '0 24px' };
const gl: Record<string, { zh: string; en: string }> = { honorary_chairman: { zh: '榮譽主席', en: 'Honorary Chairman' }, chairman: { zh: '會長', en: 'Chairman' }, vice_chairman: { zh: '副會長', en: 'Vice Chairman' }, committee: { zh: '委員', en: 'Committee' }, advisor: { zh: '顧問', en: 'Advisor' } };

export default function TeamPage() {
  const { t } = useLang();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setLoading(true);
    setError('');
    apiGet<TeamMember[]>('/api/team').then(setTeam).catch(() => setError(t('團隊資料載入失敗，請重新載入。', 'Unable to load the team. Please try again.'))).finally(() => setLoading(false));
  }, [retry, t]);

  const groups = team.reduce((a, m) => { if (!a[m.group_name]) a[m.group_name] = []; a[m.group_name].push(m); return a; }, {} as Record<string, TeamMember[]>);

  return (
    <PublicPageSwitch path="/team">
      <>
      <section style={{ padding: '96px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)' }} />
        <div style={{ ...c, position: 'relative' }}>
          <div style={{ animation: 'fadeInUp 0.8s cubic-bezier(0.22,1,0.36,1) forwards' }}>
            <div className="section-label">{t('領導團隊', 'Leadership')}</div>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 12 }}>{t('顧問委員會', 'Advisory Board')}</h1>
            <p className="section-desc">{t('區塊鏈業內翹楚加入領導委員會', 'Industry leaders guiding our mission')}</p>
            <div className="divider" style={{ marginTop: 20 }} />
          </div>
        </div>
      </section>
      <section style={{ paddingBottom: 96 }}>
        <div style={c}>
          {loading && <LoadingState label={t('正在載入委員資料...', 'Loading committee profiles...')} />}
          {!loading && error && <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />}
          {!loading && !error && Object.entries(groups).map(([group, members]) => (
            <div key={group} style={{ marginBottom: 64 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 32, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t(gl[group]?.zh || group, gl[group]?.en || group)}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                {members.map((m, i) => (
                  <div key={m.id} className="glass-card profile-card content-reveal" style={{ animationDelay: `${0.08 * i}s` }}>
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
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!loading && !error && Object.keys(groups).length === 0 && <EmptyState title={t('委員資料正在整理中', 'Committee profiles are being prepared')} description={t('歡迎先聯絡協會了解最新團隊資訊。', 'Contact HKBA for the latest leadership information.')} />}
        </div>
      </section>
    </>
    </PublicPageSwitch>
  );
}
