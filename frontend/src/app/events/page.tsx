import type { Metadata } from 'next';
import EventsPageClient from '@/components/pages/EventsPageClient';
import { pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/events', {
    title: '活動 — HKBA',
    description: '香港區塊鏈協會活動與研討會。HKBA events and seminars.',
  });
}

export default function EventsPage() {
  return <EventsPageClient />;
}
