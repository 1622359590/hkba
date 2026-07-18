'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/useLang';
import { apiGet, imgUrl, type EventItem } from '@/lib/api';
import PublicPageSwitch from '@/components/PublicPageSwitch';

const c: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '0 24px' };

export default function EventsPage() {
  const { lang, t } = useLang();
  const [events, setEvents] = useState<EventItem[]>([]);
  useEffect(() => { apiGet<EventItem[]>('/api/events').then(setEvents).catch(() => {}); }, []);

  return (
    <PublicPageSwitch path="/events">
      <>
      <section style={{ padding: '96px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)' }} />
        <div style={{ ...c, position: 'relative' }}>
          <div style={{ animation: 'fadeInUp 0.8s cubic-bezier(0.22,1,0.36,1) forwards' }}>
            <div className="section-label">{t('活動中心', 'Events')}</div>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 20 }}>{t('協會活動', 'Association Events')}</h1>
            <div className="divider" />
          </div>
        </div>
      </section>
      <section style={{ paddingBottom: 96 }}>
        <div style={{ ...c, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {events.map((e, i) => (
            <div key={e.id} className="glass-card content-reveal" style={{ display: 'flex', overflow: 'hidden', animationDelay: `${0.08 * i}s` }}>
              {e.cover_image && <div style={{ width: 240, flexShrink: 0, overflow: 'hidden' }}><img src={imgUrl(e.cover_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
              <div style={{ padding: 28, flex: 1 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13, color: '#818cf8' }}>
                  <span>📅 {e.event_date ? new Date(e.event_date).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</span>
                  {(e.location_zh || e.location_en) && <span style={{ color: '#71717a' }}>📍 {t(e.location_zh, e.location_en)}</span>}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#fff' }}>{t(e.title_zh, e.title_en)}</h3>
                <p style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.6, marginBottom: 16 }}>{t(e.description_zh, e.description_en)}</p>
                {e.registration_url && <a href={e.registration_url} target="_blank" rel="noopener noreferrer" className="btn-accent" style={{ fontSize: 13 }}>{t('立即報名', 'Register')} →</a>}
              </div>
            </div>
          ))}
          {events.length === 0 && <div style={{ textAlign: 'center', padding: '64px 0', color: '#52525b' }}>{t('暫無活動', 'No events')}</div>}
        </div>
      </section>
    </>
    </PublicPageSwitch>
  );
}
