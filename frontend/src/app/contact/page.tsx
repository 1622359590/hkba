import type { Metadata } from 'next';
import ContactPageClient from '@/components/pages/ContactPageClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const title = 'Contact-香港區塊鏈協會 HKBA';
  const description = '聯繫香港區塊鏈協會。Contact the Hong Kong Blockchain Association.';
  return {
    title,
    description,
    alternates: { canonical: '/contact' },
    openGraph: { title, description, url: '/contact', siteName: 'HKBA', type: 'website' },
  };
}

export default function ContactPage() {
  return <ContactPageClient />;
}
