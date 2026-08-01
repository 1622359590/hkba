'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminGetData, adminRequestError } from '@/lib/adminApi';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/Feedback';

type PageNode = {
  id: string;
  node_type: 'page' | 'section';
  slug: string;
  path: string;
  title_zh: string;
  title_en: string;
  navigation_status: 'visible' | 'hidden' | 'external';
  has_draft: boolean;
  is_published: boolean;
  missing_en: boolean;
  children: PageNode[];
};

function flattenPages(nodes: PageNode[], depth = 0): Array<PageNode & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenPages(node.children || [], depth + 1),
  ]);
}

export default function PagesAdmin() {
  const [tree, setTree] = useState<PageNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminGetData<{ tree: PageNode[] }>('/api/admin/pages/tree');
      setTree(data.tree);
    } catch (requestError) {
      setError(adminRequestError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pages = useMemo(
    () => flattenPages(tree).filter((node) => node.node_type === 'page'),
    [tree]
  );
  const publishedCount = pages.filter((page) => page.is_published).length;
  const draftCount = pages.filter((page) => page.has_draft).length;

  return (
    <div>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-page-title">頁面管理</h1>
          <p className="admin-page-subtitle">
            {pages.length} 個頁面 · {publishedCount} 個已發佈 · {draftCount} 個草稿
          </p>
        </div>
        {pages[0] && (
          <Link className="admin-action" href={`/admin/studio?id=${pages[0].id}`}>
            開啟工作室
          </Link>
        )}
      </div>

      {loading && <LoadingState label="正在載入頁面樹..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && (
        <div className="admin-list-stack">
          {pages.map((page) => (
            <div key={page.id} className="admin-content-row admin-page-row">
              <div className="admin-page-row__identity" style={{ paddingLeft: page.depth * 18 }}>
                <span className="admin-page-row__path">{page.path}</span>
                <div>
                  <div className="admin-page-row__title">{page.title_zh || page.title_en || page.slug}</div>
                  <div className="admin-page-row__meta">
                    {page.title_en || '尚未填寫英文標題'}
                    {page.navigation_status === 'hidden' ? ' · 導航隱藏' : ''}
                  </div>
                </div>
              </div>
              <div className="admin-page-row__actions">
                <span className={`hk-status-badge ${page.is_published ? 'is-published' : 'is-unpublished'}`}>
                  {page.is_published ? '已發佈' : '未發佈'}
                </span>
                {page.has_draft && <span className="hk-status-badge is-draft">有草稿</span>}
                {page.missing_en && <span className="hk-status-badge is-warning">缺英文</span>}
                <Link className="admin-action" href={`/admin/studio?id=${page.id}`}>
                  編輯
                </Link>
              </div>
            </div>
          ))}
          {pages.length === 0 && (
            <EmptyState title="暫無可編輯頁面" description="頁面初始化尚未完成，請重新執行內容遷移。" />
          )}
        </div>
      )}
    </div>
  );
}
