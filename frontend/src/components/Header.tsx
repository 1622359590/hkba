'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/useLang';

const navItems = [
  { href: '/', zh: '首頁', en: 'Home' },
  { href: '/about', zh: '關於協會', en: 'About' },
  { href: '/news', zh: '新聞動態', en: 'News' },
  { href: '/events', zh: '活動中心', en: 'Events' },
  { href: '/members', zh: '會員單位', en: 'Members' },
  { href: '/team', zh: '顧問團隊', en: 'Team' },
  { href: '/contact', zh: '聯繫我們', en: 'Contact' },
];

export default function Header() {
  const { lang, setLang, t } = useLang();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 64,
        background: scrolled ? 'rgba(9,9,11,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'background 0.24s cubic-bezier(0.22,1,0.36,1), border-color 0.24s cubic-bezier(0.22,1,0.36,1), backdrop-filter 0.24s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <Link href="/" className="brand-link" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#fff' }}>H</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>HKBA</span>
        </Link>

        {/* Desktop Nav */}
        <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }} className="hidden-lg">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className={`header-nav-link ${pathname === item.href ? 'is-active' : ''}`} aria-current={pathname === item.href ? 'page' : undefined}>{t(item.zh, item.en)}</Link>
          ))}
        </nav>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} className="language-toggle"
            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, background: 'transparent', color: '#a1a1aa', cursor: 'pointer' }}
          >{lang === 'zh' ? 'EN' : '繁中'}</button>
          <Link href="/contact" className="btn-primary hidden-sm" style={{ fontSize: 13, padding: '7px 16px' }}>{t('聯繫我們', 'Contact')}</Link>
          <button onClick={() => setMenuOpen(!menuOpen)} className="show-lg menu-toggle" style={{ padding: 8, background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: 'none' }} aria-expanded={menuOpen} aria-label={menuOpen ? t('關閉選單', 'Close menu') : t('打開選單', 'Open menu')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              {menuOpen ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="mobile-menu" style={{ background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: 16 }}>
          {navItems.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
              className={`mobile-nav-link ${pathname === item.href ? 'is-active' : ''}`} aria-current={pathname === item.href ? 'page' : undefined} style={{ display: 'block', padding: '12px 16px', color: '#d4d4d8', textDecoration: 'none', borderRadius: 8, fontSize: 16 }}
            >{t(item.zh, item.en)}</Link>
          ))}
        </div>
      )}

      <style jsx>{`
        @media (min-width: 1024px) { .show-lg { display: none !important; } }
        @media (max-width: 1023px) { .hidden-lg { display: none !important; } .show-lg { display: block !important; } .hidden-sm { display: none !important; }
        }
      `}</style>
    </header>
  );
}
