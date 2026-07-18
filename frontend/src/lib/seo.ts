// Server-side SEO helpers (M8; main spec §15).
//
// generateMetadata for public pages: page meta prefers the published
// PageVersion's seo field (title/description/share image); when the page is
// unpublished (pre-migration) the static fallback keeps the current tags.
// The site origin comes from NEXT_PUBLIC_SITE_URL so canonical/OG URLs are
// absolute in production.

import type { Metadata } from 'next';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.hkba.hk';
const API_INTERNAL = process.env.HKBA_API_INTERNAL || 'http://127.0.0.1:37900';

type SeoPayload = {
  seo?: Record<string, string | undefined>;
  media?: Record<string, { url: string; altZh?: string; altEn?: string }>;
  titleZh?: string;
  titleEn?: string;
  summaryZh?: string;
  summaryEn?: string;
  cover?: { url: string } | null;
  publishedAt?: string | null;
};

async function fetchInternal<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_INTERNAL}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.success ? (body.data as T) : null;
  } catch {
    return null;
  }
}

export async function pageMetadata(path: string, fallback: { title: string; description: string }): Promise<Metadata> {
  const data = await fetchInternal<SeoPayload>(`/api/public/page?path=${encodeURIComponent(path)}`);
  const seo = data?.seo || {};
  const title = seo.titleZh || seo.titleEn || data?.titleZh || fallback.title;
  const description = seo.descriptionZh || seo.descriptionEn || fallback.description;
  const shareId = seo.shareMediaId;
  const shareUrl = shareId && data?.media?.[shareId] ? data.media[shareId].url : null;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: 'HKBA',
      type: 'website',
      images: shareUrl ? [{ url: `${SITE_URL}${shareUrl}` }] : undefined,
    },
  };
}

export type NewsSeo = {
  title: string;
  description: string;
  slug: string;
  image: string | null;
  publishedAt: string | null;
  section: string | null;
};

// Detail metadata + the payload for the NewsArticle JSON-LD script. One
// fetch feeds both so the page shell does not duplicate the request.
export async function newsSeo(slug: string): Promise<NewsSeo | null> {
  const data = await fetchInternal<{
    item?: {
      slug: string;
      titleZh: string;
      titleEn: string;
      summaryZh: string;
      summaryEn: string;
      seo?: Record<string, string | undefined>;
      publishedAt: string | null;
      cover?: { url: string } | null;
      categories?: { nameZh: string; nameEn: string }[];
    };
    redirect?: string;
  }>(`/api/public/news/item/${encodeURIComponent(slug)}`);
  const item = data?.item;
  if (!item) return null;
  const seo = item.seo || {};
  return {
    title: seo.titleZh || seo.titleEn || item.titleZh || item.titleEn,
    description: seo.descriptionZh || seo.descriptionEn || item.summaryZh || item.summaryEn || '',
    slug: item.slug,
    image: item.cover ? `${SITE_URL}${item.cover.url}` : null,
    publishedAt: item.publishedAt,
    section: item.categories?.[0] ? item.categories[0].nameZh || item.categories[0].nameEn : null,
  };
}
