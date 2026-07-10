'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/useLang';
import { apiGet, imgUrl, isPlaceholderPartnerName, type Partner } from '@/lib/api';
import Link from 'next/link';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback';

const c: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '0 24px' };

export default function MembersPage() {
  const { t } = useLang();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setLoading(true);
    setError('');
    apiGet<Partner[]>('/api/partners').then(setPartners).catch(() => setError(t('會員資料載入失敗，請重新載入。', 'Unable to load members. Please try again.'))).finally(() => setLoading(false));
  }, [retry, t]);

  const groups = partners.reduce((a, p) => { if (!a[p.group_name]) a[p.group_name] = []; a[p.group_name].push(p); return a; }, {} as Record<string, Partner[]>);

  return (
    <>
      <section style={{ padding: '96px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)' }} />
        <div style={{ ...c, position: 'relative' }}>
          <div style={{ animation: 'fadeInUp 0.8s cubic-bezier(0.22,1,0.36,1) forwards' }}>
            <div className="section-label">{t('會員單位', 'Members')}</div>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 12 }}>{t('合作夥伴與會員', 'Partners & Members')}</h1>
            <p className="section-desc">{t('攜手共建區塊鏈生態系統', 'Building the blockchain ecosystem together')}</p>
            <div className="divider" style={{ marginTop: 20 }} />
          </div>
        </div>
      </section>
      <section style={{ paddingBottom: 96 }}>
        <div style={c}>
          {loading && <LoadingState label={t('正在載入會員資料...', 'Loading member organizations...')} />}
          {!loading && error && <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />}
          {!loading && !error && Object.entries(groups).map(([group, members]) => (
            <div key={group} style={{ marginBottom: 48 }}>
              <div className="member-logo-grid">
                {members.map((p, i) => {
                  const partnerName = isPlaceholderPartnerName(p.name) ? t('合作夥伴', 'Partner Organization') : p.name;
                  return p.website_url ? (
                    <a key={p.id} href={p.website_url} target="_blank" rel="noopener noreferrer" className="member-logo-link content-reveal" aria-label={`${partnerName} website`} style={{ animationDelay: `${0.04 * i}s` }}>
                      <div className="member-logo-card">
                        <div className="member-logo-card__surface"><img src={imgUrl(p.logo_url)} alt={partnerName} /></div>
                        <span className="member-logo-card__name">{partnerName}</span>
                      </div>
                    </a>
                  ) : (
                    <Link key={p.id} href="/contact" className="member-logo-link content-reveal" aria-label={`${partnerName} contact`} style={{ animationDelay: `${0.04 * i}s` }}>
                      <div className="member-logo-card">
                        <div className="member-logo-card__surface"><img src={imgUrl(p.logo_url)} alt={partnerName} /></div>
                        <span className="member-logo-card__name">{partnerName}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {!loading && !error && partners.length === 0 && <EmptyState title={t('會員資料正在整理中', 'Member directory is being prepared')} description={t('歡迎聯絡協會了解合作及入會方式。', 'Contact HKBA to learn about partnership and membership.')} action={<Link href="/contact" className="btn-secondary">{t('聯絡我們', 'Contact HKBA')}</Link>} />}
        </div>
      </section>
    </>
  );
}
