'use client';
import Link from 'next/link';
import { useLang } from '@/lib/useLang';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

interface Info { phone?: string; email?: string; address_zh?: string; address_en?: string; facebook?: string; twitter?: string; youtube?: string; instagram?: string; linkedin?: string; }

export default function Footer() {
  const { t } = useLang();
  const [info, setInfo] = useState<Info>({});
  const [infoFailed, setInfoFailed] = useState(false);
  useEffect(() => { apiGet<Info>('/api/contact/info').then(setInfo).catch(() => setInfoFailed(true)); }, []);

  const links = [
    { href: '/about', zh: '關於協會', en: 'About' },
    { href: '/news', zh: '新聞動態', en: 'News' },
    { href: '/events', zh: '活動中心', en: 'Events' },
    { href: '/team', zh: '顧問團隊', en: 'Team' },
    { href: '/contact', zh: '聯繫我們', en: 'Contact' },
  ];

  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#09090b' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 48 }}>
          {/* Brand */}
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff' }}>H</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Hong Kong Blockchain Association</div>
                <div style={{ fontSize: 12, color: '#71717a' }}>HKBA.club</div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: '#71717a', maxWidth: 400, lineHeight: 1.7 }}>
              {t('致力於推動和發展區塊鏈技術，促進香港的區塊鏈生態系統發展。', 'Dedicated to promoting blockchain technology in Hong Kong.')}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#71717a', marginBottom: 16 }}>{t('快速連結', 'Quick Links')}</h4>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {links.map(l => <li key={l.href}><Link href={l.href} className="footer-link" style={{ fontSize: 14, color: '#a1a1aa', textDecoration: 'none', transition: 'color 0.2s' }}>{t(l.zh, l.en)}</Link></li>)}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#71717a', marginBottom: 16 }}>{t('聯繫方式', 'Contact')}</h4>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: '#a1a1aa' }}>
              {info.phone && <li><a href={`tel:${info.phone}`} style={{ color: '#a1a1aa', textDecoration: 'none' }}>{info.phone}</a></li>}
              {info.email && <li><a href={`mailto:${info.email}`} style={{ color: '#a1a1aa', textDecoration: 'none' }}>{info.email}</a></li>}
              {(info.address_zh || info.address_en) && <li style={{ color: '#71717a' }}>{t(info.address_zh || '', info.address_en || '')}</li>}
              {infoFailed && <li style={{ color: '#71717a' }}>{t('聯絡資訊暫未提供', 'Contact information is temporarily unavailable.')}</li>}
            </ul>
          </div>
        </div>

        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <p style={{ fontSize: 12, color: '#52525b' }}>© {new Date().getFullYear()} Hong Kong Blockchain Association. {t('版權所有', 'All rights reserved.')}</p>
          <Link href="/admin/login" style={{ fontSize: 12, color: '#52525b', textDecoration: 'none' }}>{t('管理後台', 'Admin')}</Link>
        </div>
      </div>
    </footer>
  );
}
