'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/useLang';
import { apiGet, apiPost } from '@/lib/api';
import { EmptyState } from '@/components/ui/Feedback';
import PublicPageSwitch from '@/components/PublicPageSwitch';

const c: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '0 24px' };

interface Info { phone?: string; email?: string; address_zh?: string; address_en?: string; facebook?: string; twitter?: string; youtube?: string; instagram?: string; linkedin?: string; }
type ContactItem = { icon: string; label: string; value: string; href: string };

export default function ContactPage() {
  const { t } = useLang();
  const [info, setInfo] = useState<Info>({});
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  useEffect(() => { apiGet<Info>('/api/contact/info').then(setInfo).catch(() => {}); }, []);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (status === 'sent' || status === 'error') setStatus('idle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try { await apiPost('/api/contact/message', form); setStatus('sent'); setForm({ name: '', email: '', subject: '', message: '' }); } catch { setStatus('error'); }
  };

  const items: ContactItem[] = [
    info.phone && { icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', label: t('電話', 'Phone'), value: info.phone, href: `tel:${info.phone}` },
    info.email && { icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', label: 'Email', value: info.email, href: `mailto:${info.email}` },
    (info.address_zh || info.address_en) && { icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', label: t('地址', 'Address'), value: t(info.address_zh || '', info.address_en || ''), href: '' },
  ].filter((item): item is ContactItem => Boolean(item));

  return (
    <PublicPageSwitch path="/contact">
      <>
      <section style={{ padding: '96px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)' }} />
        <div style={{ ...c, position: 'relative' }}>
          <div style={{ animation: 'fadeInUp 0.8s cubic-bezier(0.22,1,0.36,1) forwards' }}>
            <div className="section-label">{t('聯繫我們', 'Contact')}</div>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 20 }}>{t('聯絡我們', 'Get in Touch')}</h1>
            <div className="divider" />
          </div>
        </div>
      </section>
      <section style={{ paddingBottom: 96 }}>
        <div style={{ ...c, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 48 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>{t('聯繫方式', 'Contact Info')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" fill="none" stroke="#818cf8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} /></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#71717a', marginBottom: 2 }}>{item.label}</div>
                    {item.href ? <a href={item.href} style={{ fontSize: 14, color: '#d4d4d8', textDecoration: 'none' }}>{item.value}</a> : <span style={{ fontSize: 14, color: '#d4d4d8' }}>{item.value}</span>}
                  </div>
                </div>
              ))}
            </div>
            <h3 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', marginBottom: 12 }}>{t('社群媒體', 'Social')}</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[{ k: 'facebook', l: 'Facebook' }, { k: 'twitter', l: 'X' }, { k: 'linkedin', l: 'LinkedIn' }, { k: 'youtube', l: 'YouTube' }, { k: 'instagram', l: 'Instagram' }].map(s => { const url = info[s.k as keyof Info]; if (!url) return null; return <a key={s.k} href={url} target="_blank" rel="noopener noreferrer" className="social-chip" style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: '#a1a1aa', textDecoration: 'none' }}>{s.l}</a>; })}
            </div>
          </div>
          <div className="glass-card" style={{ padding: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>{t('發送訊息', 'Send a Message')}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div><label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 6 }}>{t('姓名', 'Name')} *</label><input required value={form.name} onChange={e => updateForm('name', e.target.value)} className="form-input" /></div>
                <div><label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 6 }}>Email *</label><input type="email" required value={form.email} onChange={e => updateForm('email', e.target.value)} className="form-input" /></div>
              </div>
              <div><label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 6 }}>{t('主旨', 'Subject')}</label><input value={form.subject} onChange={e => updateForm('subject', e.target.value)} className="form-input" /></div>
              <div><label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 6 }}>{t('訊息', 'Message')} *</label><textarea required rows={5} value={form.message} onChange={e => updateForm('message', e.target.value)} className="form-input" style={{ resize: 'vertical' as const }} /></div>
              <button type="submit" disabled={status === 'sending'} className="btn-accent" style={{ width: '100%', justifyContent: 'center', opacity: status === 'sending' ? 0.6 : 1 }}>{status === 'sending' ? t('發送中...', 'Sending...') : t('發送訊息', 'Send Message')}</button>
              {status === 'sent' && <div style={{ marginTop: 4 }}><EmptyState title={t('訊息已發送', 'Message sent')} description={t('我們會盡快與您聯絡。', 'We will get back to you shortly.')} action={<button type="button" className="btn-secondary" onClick={() => { setStatus('idle'); setForm({ name: '', email: '', subject: '', message: '' }); }}>{t('再發送一則訊息', 'Send another message')}</button>} /></div>}
              {status === 'error' && <p style={{ fontSize: 13, color: '#ef4444', textAlign: 'center' }}>{t('發送失敗，請重試', 'Failed, try again')}</p>}
            </form>
          </div>
        </div>
      </section>
    </>
    </PublicPageSwitch>
  );
}
