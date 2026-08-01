'use client';
// Galaxy control center dashboard (ui-interaction-system §4, simplified per
// approved D6: static first level + six-state badges + global search; dynamic
// expansion, wheel zoom and canvas pan are deferred enhancements).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminGet, adminGetData } from '@/lib/adminApi';
import GalaxyMap, { GalaxyBadge, GalaxyNode } from '@/components/admin/galaxy/GalaxyMap';
import GlobalSearch, { SearchEntry } from '@/components/admin/galaxy/GlobalSearch';
import { LoadingState } from '@/components/ui/Feedback';

type PageNode = {
  id: string;
  slug: string;
  path: string;
  title_zh: string;
  title_en: string;
  has_draft: boolean;
  is_published: boolean;
  missing_en: boolean;
  children?: PageNode[];
};

type NewsItem = {
  id: string;
  slug: string;
  title_zh: string;
  title_en: string;
  status: string;
  missing_en: boolean;
};

const ICONS = {
  site: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  content: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  media: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  system: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
};

const MODULE_ENTRIES: SearchEntry[] = [
  { group: '系統模組', label: '頁面與欄目樹', href: '/admin/pages', keywords: 'page tree section 頁面' },
  { group: '系統模組', label: '新聞管理', href: '/admin/news', keywords: 'news 新聞 公告' },
  { group: '系統模組', label: '活動管理', href: '/admin/events', keywords: 'events 活動' },
  { group: '系統模組', label: 'Banner 管理', href: '/admin/banners', keywords: 'banner 輪播' },
  { group: '系統模組', label: '團隊管理', href: '/admin/team', keywords: 'team 團隊' },
  { group: '系統模組', label: '會員管理', href: '/admin/members', keywords: 'members partners 會員 夥伴' },
  { group: '系統模組', label: '留言中心', href: '/admin/messages', keywords: 'messages contact 留言' },
  { group: '系統模組', label: '站點設置', href: '/admin/settings', keywords: 'settings 設置' },
];

function flatten(nodes: PageNode[]): PageNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children || [])]);
}

export default function AdminDashboard() {
  const [pages, setPages] = useState<PageNode[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsTotal, setNewsTotal] = useState(0);
  const [newsDrafts, setNewsDrafts] = useState(0);
  const [newsMissingEn, setNewsMissingEn] = useState(0);
  const [mediaTotal, setMediaTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const failures: string[] = [];
    const track = async <T,>(source: string, promise: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await promise;
      } catch {
        failures.push(source);
        return fallback;
      }
    };
    const [tree, newsPage, draftPage, missingPage, mediaPage, unreadCount] = await Promise.all([
      track('頁面樹', adminGetData<{ tree: PageNode[]; total: number }>('/api/admin/pages/tree'), { tree: [], total: 0 }),
      track('新聞', adminGetData<{ items: NewsItem[]; total: number }>('/api/admin/news?pageSize=50'), { items: [], total: 0 }),
      track('新聞草稿', adminGetData<{ total: number }>('/api/admin/news?status=draft&pageSize=1'), { total: 0 }),
      track('英文缺失', adminGetData<{ total: number }>('/api/admin/news?lang=missing-en&pageSize=1'), { total: 0 }),
      track('媒體庫', adminGetData<{ total: number }>('/api/admin/media?pageSize=1'), { total: 0 }),
      track('留言', adminGet<{ count: number }>('/api/contact/messages/unread-count'), { count: 0 }),
    ]);
    setPages(tree.tree);
    setNews(newsPage.items);
    setNewsTotal(newsPage.total);
    setNewsDrafts(draftPage.total);
    setNewsMissingEn(missingPage.total);
    setMediaTotal(mediaPage.total);
    setUnread(unreadCount.count);
    setFailed(failures);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, retry]);

  const flatPages = useMemo(() => flatten(pages), [pages]);
  const pageDrafts = flatPages.filter((node) => node.has_draft).length;
  const pagesMissingEn = flatPages.filter((node) => node.missing_en).length;

  const nodes: GalaxyNode[] = [
    {
      id: 'site',
      label: '網站',
      subtitle: `${flatPages.length} 個頁面節點`,
      href: '/admin/pages',
      icon: ICONS.site,
      badges: failed.includes('頁面樹')
        ? [{ kind: 'failed', reason: '頁面樹載入失敗' }]
        : [
            ...(pageDrafts ? [{ kind: 'draft', count: pageDrafts } as GalaxyBadge] : []),
            ...(pagesMissingEn ? [{ kind: 'missing-en', count: pagesMissingEn } as GalaxyBadge] : []),
            ...(!pageDrafts && !pagesMissingEn ? [{ kind: 'ok', label: '正常' } as GalaxyBadge] : []),
          ],
    },
    {
      id: 'content',
      label: '內容',
      subtitle: `${newsTotal} 篇新聞`,
      href: '/admin/news',
      icon: ICONS.content,
      badges: failed.some((source) => source.startsWith('新聞'))
        ? [{ kind: 'failed', reason: '新聞資料載入失敗' }]
        : [
            ...(newsDrafts ? [{ kind: 'draft', count: newsDrafts } as GalaxyBadge] : []),
            ...(newsMissingEn ? [{ kind: 'missing-en', count: newsMissingEn } as GalaxyBadge] : []),
            ...(!newsDrafts && !newsMissingEn ? [{ kind: 'ok', label: '正常' } as GalaxyBadge] : []),
          ],
    },
    {
      id: 'media',
      label: '媒體',
      subtitle: `${mediaTotal} 個素材`,
      href: '/admin/media',
      icon: ICONS.media,
      badges: failed.includes('媒體庫') ? [{ kind: 'failed', reason: '媒體庫載入失敗' }] : [{ kind: 'ok', label: '正常' }],
    },
    {
      id: 'system',
      label: '系統',
      subtitle: unread ? `${unread} 條未讀留言` : '運行正常',
      href: '/admin/settings',
      icon: ICONS.system,
      badges: failed.includes('留言')
        ? [{ kind: 'failed', reason: '留言統計載入失敗' }]
        : [unread ? { kind: 'pending', count: unread } as GalaxyBadge : { kind: 'ok', label: '正常' } as GalaxyBadge],
    },
  ];

  const searchEntries: SearchEntry[] = useMemo(() => [
    ...MODULE_ENTRIES,
    ...flatPages.map((node) => ({
      group: '欄目與頁面',
      label: node.title_zh || node.slug,
      hint: node.path,
      href: '/admin/pages',
      keywords: `${node.slug} ${node.title_en || ''}`,
    })),
    ...news.map((item) => ({
      group: '新聞',
      label: item.title_zh || item.title_en || item.slug,
      hint: item.status === 'published' ? '已發佈' : '草稿',
      href: '/admin/news',
      keywords: `${item.slug} ${item.title_en || ''}`,
    })),
  ], [flatPages, news]);

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <GlobalSearch entries={searchEntries} />
      </div>
      {loading ? <LoadingState label="正在同步星系狀態…" /> : <GalaxyMap nodes={nodes} onRetry={() => setRetry((value) => value + 1)} />}
    </div>
  );
}
