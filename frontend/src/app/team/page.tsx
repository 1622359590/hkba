import type { Metadata } from 'next';
import TeamPageClient from '@/components/pages/TeamPageClient';
import { pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/team', {
    title: '團隊 — HKBA',
    description: '香港區塊鏈協會團隊。The HKBA team.',
  });
}

export default function TeamPage() {
  return <TeamPageClient />;
}
