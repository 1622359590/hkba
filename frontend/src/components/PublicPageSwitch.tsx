'use client';
// Public page switch (M8: frontend rendering switch; main spec §15).
//
// Wraps a legacy public page: on mount it asks /api/public/page for the
// published block tree of this path. When a published version exists the
// shared BlockRenderer takes over the whole page (with real news cards for
// news.* display components); otherwise — including any fetch failure — the
// legacy children keep rendering untouched. This is the grey-release gate
// that keeps the live site intact until the M9 data migration publishes
// real pages. Children render during the probe so unmigrated pages never
// flash; the swap happens only when blocks arrive.

import { ReactNode, useEffect, useState } from 'react';
import BlockRenderer, { NewsCardData } from '@/components/blocks/BlockRenderer';
import { fetchPublicNews, fetchPublicPage, PublicPage, PublicNewsListItem } from '@/lib/publicContent';
import { useLang } from '@/lib/useLang';

function toCard(item: PublicNewsListItem, lang: 'zh' | 'en'): NewsCardData {
  return {
    slug: item.slug,
    title: (lang === 'en' ? item.titleEn || item.titleZh : item.titleZh || item.titleEn) || item.slug,
    summary: lang === 'en' ? item.summaryEn || item.summaryZh : item.summaryZh || item.summaryEn,
    year: item.year,
    publishedAt: item.publishedAt,
    coverUrl: item.cover?.url || null,
  };
}

export default function PublicPageSwitch({ path, children }: { path: string; children: ReactNode }) {
  const { lang } = useLang();
  const [page, setPage] = useState<PublicPage | null>(null);
  const [news, setNews] = useState<NewsCardData[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPublicPage(path).then(async (data) => {
      if (cancelled || !data) return;
      setPage(data);
      const list = await fetchPublicNews({ pageSize: 12 });
      if (!cancelled && list) setNews(list.items.map((item) => toCard(item, lang)));
    });
    return () => {
      cancelled = true;
    };
  }, [path, lang]);

  if (!page) return <>{children}</>;

  return (
    <div className="public-blocks" style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px 96px' }}>
      <BlockRenderer blocks={page.blocks} lang={lang} media={page.media} news={news} />
    </div>
  );
}
