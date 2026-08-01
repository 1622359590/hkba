'use client';

import Link from 'next/link';
import PublicPageSwitch from '@/components/PublicPageSwitch';
import { useLang } from '@/lib/useLang';

export default function JoinPageClient() {
  const { t } = useLang();
  return (
    <PublicPageSwitch path="/join">
      <section style={{ maxWidth: 920, margin: '0 auto', padding: '140px 24px 100px' }}>
        <div className="section-label">{t('加入我們', 'Join HKBA')}</div>
        <h1 style={{ fontSize: 42, lineHeight: 1.15, marginBottom: 18 }}>{t('成為香港區塊鏈協會會員', 'Become an HKBA Member')}</h1>
        <p className="section-desc">{t('會員方案正在整理中，歡迎直接聯繫協會。', 'Membership plans are being prepared. Please contact HKBA.')}</p>
        <Link href="/contact" className="btn-primary" style={{ display: 'inline-flex', marginTop: 28 }}>{t('聯繫我們', 'Contact us')}</Link>
      </section>
    </PublicPageSwitch>
  );
}
