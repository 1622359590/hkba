import type { Metadata } from 'next';
import JoinPageClient from '@/components/pages/JoinPageClient';
import { pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/join', {
    title: '加入香港區塊鏈協會 — HKBA',
    description: '了解香港區塊鏈協會會籍方案並下載申請表。Explore HKBA membership plans and apply to join.',
  });
}

export default function JoinPage() {
  return <JoinPageClient />;
}
