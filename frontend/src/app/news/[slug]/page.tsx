// News detail shell (M8; main spec §15 SEO).
//
// Server component: generateMetadata prefers the published item's seo
// field, the NewsArticle JSON-LD rides in the page body, and the client
// component handles rendering with the new-system-first fallback chain.

import type { Metadata } from 'next';
import NewsDetailClient from '@/components/pages/NewsDetailClient';
import { newsSeo, SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const seo = await newsSeo(slug);
  if (!seo) {
    return { title: '協會新聞 — HKBA' };
  }
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: `/news/${seo.slug}` },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: `/news/${seo.slug}`,
      siteName: 'HKBA',
      type: 'article',
      publishedTime: seo.publishedAt || undefined,
      images: seo.image ? [{ url: seo.image }] : undefined,
    },
  };
}

export default async function NewsDetailPage({ params }: Params) {
  const { slug } = await params;
  const seo = await newsSeo(slug);
  const jsonLd = seo
    ? {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: seo.title,
        description: seo.description,
        image: seo.image ? [seo.image] : undefined,
        datePublished: seo.publishedAt || undefined,
        articleSection: seo.section || undefined,
        inLanguage: 'zh-Hant',
        author: { '@type': 'Organization', name: 'Hong Kong Blockchain Association', url: SITE_URL },
        publisher: { '@type': 'Organization', name: 'Hong Kong Blockchain Association', url: SITE_URL },
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/news/${seo.slug}` },
      }
    : null;
  return (
    <>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <NewsDetailClient />
    </>
  );
}
