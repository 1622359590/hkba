// robots.txt (M8; main spec §15): the public site is fully crawlable;
// admin surfaces and preview endpoints stay out of the index (preview
// responses also carry X-Robots-Tag: noindex from the backend).

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/admin', '/api/preview'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
