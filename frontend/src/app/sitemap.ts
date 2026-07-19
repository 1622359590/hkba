// sitemap.xml (M8; main spec §15).
//
// Static public routes plus every published page path and news slug from
// the backend. When the backend is unreachable (or nothing is published
// yet) the static routes still ship a valid sitemap.

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

const API_INTERNAL = process.env.HKBA_API_INTERNAL || 'http://127.0.0.1:37900';

export const revalidate = 3600;

const STATIC_ROUTES = ['/', '/about', '/news', '/events', '/members', '/team', '/contact'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === '/' || path === '/news' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : 0.7,
  }));

  try {
    const res = await fetch(`${API_INTERNAL}/api/public/sitemap-data`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const body = await res.json();
      const data = body?.data || {};
      const seen = new Set(STATIC_ROUTES);
      for (const page of data.pages || []) {
        if (!page.path || seen.has(page.path)) continue;
        seen.add(page.path);
        entries.push({
          url: `${SITE_URL}${page.path}`,
          lastModified: page.updatedAt || undefined,
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
      for (const item of data.news || []) {
        entries.push({
          url: `${SITE_URL}/news/${item.slug}`,
          lastModified: item.publishedAt || undefined,
          changeFrequency: 'monthly',
          priority: 0.5,
        });
      }
    }
  } catch {
    // Static routes alone keep the sitemap valid.
  }

  return entries;
}
