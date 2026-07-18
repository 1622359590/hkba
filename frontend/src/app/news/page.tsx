import type { Metadata } from 'next';
import NewsListClient from '@/components/pages/NewsListClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '協會新聞 — HKBA',
  description: '香港區塊鏈協會新聞動態。News from the Hong Kong Blockchain Association.',
  alternates: { canonical: '/news' },
};

export default function NewsPage() {
  return <NewsListClient />;
}
