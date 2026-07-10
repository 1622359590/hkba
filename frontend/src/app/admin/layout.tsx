'use client';
import { useCallback, useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminGet } from '@/lib/adminApi';

const menu = [
  { href: '/admin', label: '儀表板', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/admin/banners', label: 'Banner', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/admin/news', label: '新聞', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  { href: '/admin/events', label: '活動', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/admin/pages', label: '頁面', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/admin/messages', label: '留言', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z' },
  { href: '/admin/team', label: '團隊', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/admin/members', label: '會員', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { href: '/admin/settings', label: '設置', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const activeItem = menu.find(item => pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href)));

  const refreshUnreadMessages = useCallback(() => {
    adminGet<{ count: number }>('/api/contact/messages/unread-count')
      .then(data => setUnreadMessages(data.count))
      .catch(() => setUnreadMessages(0));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('hkba_admin_token');
    if (!saved && pathname !== '/admin/login') { router.push('/admin/login'); }
    else {
      setToken(saved);
      if (saved) {
        menu.forEach(item => router.prefetch(item.href));
        refreshUnreadMessages();
      }
    }
  }, [pathname, refreshUnreadMessages, router]);

  useEffect(() => {
    const handler = () => refreshUnreadMessages();
    window.addEventListener('hkba:messages-updated', handler);
    window.addEventListener('hkba:content-updated', handler);
    return () => {
      window.removeEventListener('hkba:messages-updated', handler);
      window.removeEventListener('hkba:content-updated', handler);
    };
  }, [refreshUnreadMessages]);

  useEffect(() => {
    if (!token || pathname === '/admin/login') return;
    const interval = window.setInterval(refreshUnreadMessages, 60000);
    return () => window.clearInterval(interval);
  }, [pathname, refreshUnreadMessages, token]);

  if (pathname === '/admin/login') return <>{children}</>;
  if (!token) return <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#71717a', fontSize: 13 }}>載入中...</span></div>;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <div className="admin-brand__mark">H</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.15 }}>HKBA CMS</div>
              <div style={{ fontSize: 11, color: '#818cf8', marginTop: 3, fontWeight: 650 }}>Content Ops</div>
            </div>
          </Link>
        </div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {menu.map(item => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} prefetch className={`admin-nav-link ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                <span className="admin-nav-icon">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.65} d={item.icon} /></svg>
                  {item.href === '/admin/messages' && unreadMessages > 0 && <span className="admin-notification-dot" />}
                </span>
                {item.label}
                {item.href === '/admin/messages' && unreadMessages > 0 && <span className="admin-notification-count">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <button type="button" onClick={() => { localStorage.removeItem('hkba_admin_token'); router.push('/admin/login'); }} className="admin-logout">
            <span className="admin-nav-icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.65} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </span>
            登出
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <div>
            <div style={{ color: '#818cf8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>HKBA Admin</div>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 750, lineHeight: 1.2 }}>{activeItem?.label || '管理後台'}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/" target="_blank" className="btn-secondary" style={{ fontSize: 13, padding: '9px 14px' }}>查看前台 ↗</Link>
            <button type="button" onClick={() => { localStorage.removeItem('hkba_admin_token'); router.push('/admin/login'); }} className="btn-secondary" style={{ fontSize: 13, padding: '9px 14px' }}>登出</button>
          </div>
        </div>
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
  );
}
