'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/useLang';

const navItems = [
  { href: '/', zh: '首頁', en: 'Home' },
  { href: '/about', zh: '關於協會', en: 'About' },
  { href: '/news', zh: '新聞動態', en: 'News' },
  { href: '/events', zh: '活動中心', en: 'Events' },
  { href: '/members', zh: '會員單位', en: 'Members' },
  { href: '/join', zh: '加入我們', en: 'Join Us' },
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
    <header className={`header${scrolled ? ' scrolled' : ''}`} id="header">
      <Link href="/" className="header-brand">
        <Image
          src="/images/hkba-logo.png"
          alt="Hong Kong Blockchain Association"
          width={471}
          height={278}
          className="header-brand-logo"
          priority
        />
      </Link>

      <div className="header-center">
        <nav className="header-nav hidden-lg">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className={`header-nav-link${pathname === item.href ? ' active' : ''}`} aria-current={pathname === item.href ? 'page' : undefined}>{t(item.zh, item.en)}</Link>
          ))}
        </nav>
      </div>

      <div className="header-actions">
        <button type="button" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} className="header-lang" aria-label={t('切換至英文', 'Switch to Traditional Chinese')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span className={lang === 'zh' ? 'active' : ''}>繁</span>
          <span className="header-lang-divider" />
          <span className={lang === 'en' ? 'active' : ''}>EN</span>
        </button>
        <Link href="/contact" className="header-btn hidden-sm">{t('聯繫我們', 'Contact')}</Link>
        <button onClick={() => setMenuOpen(!menuOpen)} className="show-lg menu-toggle" aria-expanded={menuOpen} aria-label={menuOpen ? t('關閉選單', 'Close menu') : t('打開選單', 'Open menu')}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            {menuOpen ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="mobile-menu">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
              className={`mobile-nav-link${pathname === item.href ? ' active' : ''}`} aria-current={pathname === item.href ? 'page' : undefined}
            >{t(item.zh, item.en)}</Link>
          ))}
          <Link href="/contact" onClick={() => setMenuOpen(false)} className="mobile-nav-link">{t('聯繫我們', 'Contact')}</Link>
        </div>
      )}
    </header>
  );
}
