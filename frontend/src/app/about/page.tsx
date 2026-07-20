import type { Metadata } from 'next';
import AboutPageClient from '@/components/pages/AboutPageClient';
import { pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/about', {
    title: '關於我們 — HKBA',
    description: '香港區塊鏈協會簡介、里程碑與團隊。About the Hong Kong Blockchain Association.',
  });
}

export default function AboutPage() {
  return <AboutPageClient />;
}
