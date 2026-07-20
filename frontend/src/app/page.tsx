import type { Metadata } from 'next';
import HomePageClient from '@/components/HomePageClient';
import { pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/', {
    title: 'HKBA — Hong Kong Blockchain Association',
    description: 'Hong Kong Blockchain Association — Dedicated to promoting blockchain technology in Hong Kong.',
  });
}

export default function HomePage() {
  return <HomePageClient />;
}
