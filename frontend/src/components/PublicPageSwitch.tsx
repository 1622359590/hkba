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
import BlockRenderer, { AssocData, NewsCardData } from '@/components/blocks/BlockRenderer';
import { HomeHero, HomeMission } from '@/components/home/HomeMockupSections';
import { fetchPublicAssociation, fetchPublicNews, fetchPublicPage, PublicPage, PublicNewsListItem } from '@/lib/publicContent';
import { useLang } from '@/lib/useLang';
import { resolvePublicPagePresentation } from '@/lib/publicPagePresentation';
import LeadershipIntro from '@/components/pages/LeadershipIntro';
import PublishedNewsExperience, { hasPremiumNewsBlocks } from '@/components/news/PublishedNewsExperience';
import { loadPublicPageBundle } from '@/lib/publicPageBundle.mjs';


function toCard(item: PublicNewsListItem, lang: 'zh' | 'en'): NewsCardData {
  return {
    id: item.id,
    slug: item.slug,
    title: (lang === 'en' ? item.titleEn || item.titleZh : item.titleZh || item.titleEn) || item.slug,
    summary: lang === 'en' ? item.summaryEn || item.summaryZh : item.summaryZh || item.summaryEn,
    year: item.year,
    publishedAt: item.publishedAt,
    coverUrl: item.cover?.url || null,
    categoryId: item.categories[0]?.id,
    category: lang === 'en' ? item.categories[0]?.nameEn || item.categories[0]?.nameZh : item.categories[0]?.nameZh,
  };
}

export default function PublicPageSwitch({ path, children }: { path: string; children: ReactNode }) {
  const { lang } = useLang();
  const [page, setPage] = useState<PublicPage | null>(null);
  const [news, setNews] = useState<NewsCardData[]>([]);
  const [assoc, setAssoc] = useState<AssocData | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadPublicPageBundle(path, {
      fetchPage: fetchPublicPage,
      fetchNews: () => fetchPublicNews({ pageSize: 12 }),
      fetchAssociation: fetchPublicAssociation,
    }).then((bundle) => {
      if (cancelled || !bundle) return;
      setNews(bundle.news ? bundle.news.items.map((item: PublicNewsListItem) => toCard(item, lang)) : []);
      setAssoc(bundle.association || undefined);
      setPage(bundle.page);
    });
    return () => {
      cancelled = true;
    };
  }, [path, lang]);

  if (!page) return <>{children}</>;

  if (path === '/news' && hasPremiumNewsBlocks(page)) {
    return <PublishedNewsExperience page={page} lang={lang} />;
  }

  const isHome = path === '/';
  const pageClass = path === '/' ? 'home' : path.replace(/^\//, '').replace(/[^a-z0-9-]/gi, '-') || 'page';
  const presentation = resolvePublicPagePresentation(path, page.blocks);
  const firstBlock = isHome ? presentation.blocks.filter((block) => block.component_type === 'content.hero').slice(0, 1) : presentation.blocks;
  const missionBlock = isHome ? presentation.blocks.find((block) => block.component_type === 'content.mission') : undefined;
  const remainingBlocks = isHome ? presentation.blocks.filter((block) => block.component_type !== 'content.hero' && block.component_type !== 'content.mission') : [];

  return (
    <div className={`public-blocks public-page--${pageClass}`}>
      {presentation.intro === 'leadership' ? <LeadershipIntro /> : null}
      {isHome ? <><HomeHero /><HomeMission block={missionBlock} /></> : presentation.intro ? (
        <div className="public-page__body">
          <div className="team-directory__heading">
            <h2>{lang === 'en' ? 'Committee members' : '委員會成員'}</h2>
            <p>{lang === 'en' ? 'Explore the committee by role and professional background.' : '按職務組別瀏覽領導委員會成員及其專業背景。'}</p>
          </div>
          <BlockRenderer blocks={firstBlock} lang={lang} media={page.media} news={news} assoc={assoc} />
        </div>
      ) : <BlockRenderer blocks={firstBlock} lang={lang} media={page.media} news={news} assoc={assoc} />}
      {isHome && <div className="public-home-content"><BlockRenderer blocks={remainingBlocks} lang={lang} media={page.media} news={news} assoc={assoc} /></div>}
    </div>
  );
}
