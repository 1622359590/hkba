import type { Metadata } from 'next';
import ContactPageClient from '@/components/pages/ContactPageClient';
import { pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/contact', {
    title: '聯繫我們 — HKBA',
    description: '聯繫香港區塊鏈協會。Contact the Hong Kong Blockchain Association.',
  });
}

export default function ContactPage() {
  return <ContactPageClient />;
}
