'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import LifecycleDashboard, { DashboardModel } from '@/components/admin/dashboard/LifecycleDashboard';
import GlobalSearch, { SearchEntry } from '@/components/admin/galaxy/GlobalSearch';
import { adminGet, adminGetData } from '@/lib/adminApi';
import { buildAdminDashboardModel, flattenDashboardPages } from '@/lib/adminDashboardModel.mjs';

type PageNode = {
  id: string;
  slug: string;
  path: string;
  title_zh: string;
  title_en: string;
  node_type?: string;
  has_draft: boolean;
  is_published: boolean;
  missing_en: boolean;
  updated_at?: string | null;
  children?: PageNode[];
};

type NewsItem = {
  id: string;
  slug: string;
  title_zh: string;
  title_en: string;
  status: string;
  missing_en: boolean;
  updated_at?: string | null;
  published_at?: string | null;
};

type ActiveRow = { id: string | number; is_active: boolean | number };

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

const EMPTY_MODEL = buildAdminDashboardModel({}) as DashboardModel;

export default function AdminDashboard() {
  const [pages, setPages] = useState<PageNode[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [banners, setBanners] = useState<ActiveRow[]>([]);
  const [team, setTeam] = useState<ActiveRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const failures: string[] = [];
    const track = async <T,>(label: string, request: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await request;
      } catch {
        failures.push(label);
        return fallback;
      }
    };

    const [pageResult, newsResult, bannerResult, teamResult, unreadResult] = await Promise.all([
      track('頁面', adminGetData<{ tree: PageNode[] }>('/api/admin/pages/tree'), { tree: [] }),
      track('新聞', adminGetData<{ items: NewsItem[] }>('/api/admin/news?pageSize=50'), { items: [] }),
      track('Banner', adminGet<ActiveRow[]>('/api/banners/all'), []),
      track('團隊', adminGet<ActiveRow[]>('/api/team/all'), []),
      track('留言', adminGet<{ count: number }>('/api/contact/messages/unread-count'), { count: 0 }),
    ]);

    setPages(pageResult.tree);
    setNews(newsResult.items);
    setBanners(bannerResult);
    setTeam(teamResult);
    setUnread(unreadResult.count);
    setFailedSources(failures);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener('hkba:content-updated', refresh);
    window.addEventListener('hkba:messages-updated', refresh);
    return () => {
      window.removeEventListener('hkba:content-updated', refresh);
      window.removeEventListener('hkba:messages-updated', refresh);
    };
  }, [load]);

  const model = useMemo<DashboardModel>(() => buildAdminDashboardModel({ pages, news, banners, team, unread }) as DashboardModel, [pages, news, banners, team, unread]);
  const flatPages = useMemo<PageNode[]>(() => flattenDashboardPages(pages), [pages]);
  const searchEntries = useMemo<SearchEntry[]>(() => [
    ...MODULE_ENTRIES,
    ...flatPages.map((node) => ({
      group: '欄目與頁面',
      label: node.title_zh || node.title_en || node.slug,
      hint: node.path,
      href: `/admin/studio?id=${encodeURIComponent(node.id)}`,
      keywords: `${node.slug} ${node.title_en || ''}`,
    })),
    ...news.map((item) => ({
      group: '新聞',
      label: item.title_zh || item.title_en || item.slug,
      hint: item.status === 'published' ? '已發佈' : '草稿',
      href: `/admin/news?id=${encodeURIComponent(item.id)}`,
      keywords: `${item.slug} ${item.title_en || ''}`,
    })),
  ], [flatPages, news]);

  return (
    <div className="admin-dashboard-shell">
      <GlobalSearch entries={searchEntries} />
      <LifecycleDashboard
        model={loading ? EMPTY_MODEL : model}
        loading={loading}
        failedSources={failedSources}
        onRetry={() => { void load(); }}
      />
    </div>
  );
}
