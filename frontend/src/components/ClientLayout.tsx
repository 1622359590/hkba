'use client';
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { LangProvider } from '@/lib/useLang';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ScrollReveal from '@/components/ui/ScrollReveal';

export default function ClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) return <>{children}</>;

  return (
    <LangProvider>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ScrollReveal />
        <Header />
        <main className="public-main" style={{ flex: 1 }}>{children}</main>
        <Footer />
      </div>
    </LangProvider>
  );
}
