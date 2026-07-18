import type { Metadata } from 'next';
import MembersPageClient from '@/components/pages/MembersPageClient';
import { pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/members', {
    title: '會員 — HKBA',
    description: '香港區塊鏈協會會員與合作夥伴。HKBA members and partners.',
  });
}

export default function MembersPage() {
  return <MembersPageClient />;
}
