'use client';
import { useEffect, useState } from 'react';
import { adminGet } from '@/lib/adminApi';
import Link from 'next/link';
import { ErrorState, LoadingState } from '@/components/ui/Feedback';

type Counts = {
  banners: number;
  news: number;
  team: number;
  partners: number;
  events: number;
  messages: number;
  unreadMessages: number;
};

type RecentNews = {
  id: number;
  title_zh?: string;
  title_en?: string;
  is_published?: boolean;
  published_at?: string;
};

const icons = {
  image: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  news: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  event: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  team: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  member: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  message: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z',
  arrow: 'M13 7l5 5m0 0l-5 5m5-5H6',
};

function Icon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={path} />
    </svg>
  );
}

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Counts>({ banners: 0, news: 0, team: 0, partners: 0, events: 0, messages: 0, unreadMessages: 0 });
  const [recentNews, setRecentNews] = useState<RecentNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [banners, allNews, team, partners, events, messages, unreadMessages] = await Promise.all([
      adminGet<unknown[]>('/api/banners/all').then(d => d.length).catch(() => 0),
      adminGet<RecentNews[]>('/api/news/admin/all').catch(() => []),
      adminGet<unknown[]>('/api/team/all').then(d => d.length).catch(() => 0),
      adminGet<unknown[]>('/api/partners/all').then(d => d.length).catch(() => 0),
      adminGet<unknown[]>('/api/events/admin/all').then(d => d.length).catch(() => 0),
      adminGet<unknown[]>('/api/contact/messages').then(d => d.length).catch(() => 0),
      adminGet<{ count: number }>('/api/contact/messages/unread-count').then(d => d.count).catch(() => 0),
      ]);
      setCounts({ banners, news: allNews.length, team, partners, events, messages, unreadMessages });
      setRecentNews(allNews.slice(0, 5));
    } catch {
      setError('儀表板資料載入失敗，請重新載入。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [retry]);

  useEffect(() => {
    const refresh = () => load();
    window.addEventListener('hkba:content-updated', refresh);
    window.addEventListener('hkba:messages-updated', refresh);
    return () => {
      window.removeEventListener('hkba:content-updated', refresh);
      window.removeEventListener('hkba:messages-updated', refresh);
    };
  }, []);

  const cards = [
    { label: 'Banner', count: counts.banners, href: '/admin/banners', icon: icons.image, hint: '首頁輪播與主視覺' },
    { label: '新聞', count: counts.news, href: '/admin/news', icon: icons.news, hint: '文章、公告與分類' },
    { label: '活動', count: counts.events, href: '/admin/events', icon: icons.event, hint: '活動日程與報名資訊' },
    { label: '團隊', count: counts.team, href: '/admin/team', icon: icons.team, hint: '顧問與委員資料' },
    { label: '會員', count: counts.partners, href: '/admin/members', icon: icons.member, hint: '夥伴 logo 與連結' },
    { label: '留言', count: counts.unreadMessages, href: '/admin/messages', icon: icons.message, hint: `${counts.messages} 條總留言，未讀優先處理` },
  ];

  const liveNews = recentNews.filter(item => item.is_published).length;
  const draftNews = recentNews.length - liveNews;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <p style={{ color: '#a1a1aa', fontSize: 14, maxWidth: 620 }}>
            這裡集中處理 HKBA 官網內容、會員展示與訪客訊息。所有卡片和快捷入口都可以直接進入對應管理頁。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/admin/news" className="btn-accent" style={{ fontSize: 13, padding: '9px 14px' }}>管理新聞</Link>
          <Link href="/admin/members" className="btn-secondary" style={{ fontSize: 13, padding: '9px 14px' }}>管理會員</Link>
        </div>
      </div>

      {loading && <LoadingState label="正在同步內容統計..." />}
      {error && <div style={{ marginBottom: 18 }}><ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /></div>}

      <div className="admin-stat-grid">
        {cards.map(c => (
          <Link key={c.label} href={c.href} className={`admin-panel admin-stat-card ${c.label === '留言' && counts.unreadMessages > 0 ? 'has-unread' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <span className="admin-stat-icon"><Icon path={c.icon} /></span>
              <span style={{ color: '#52525b' }}><Icon path={icons.arrow} size={17} /></span>
            </div>
            <div>
              <div style={{ fontSize: 31, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{c.count}</div>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, marginTop: 9 }}>{c.label}</div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 3, lineHeight: 1.45 }}>{c.hint}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="admin-work-grid">
        <section className="admin-panel" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 750, color: '#fff' }}>最近新聞</h2>
              <p style={{ fontSize: 12, color: '#71717a', marginTop: 3 }}>快速檢查發布狀態與內容節奏</p>
            </div>
            <Link href="/admin/news" className="btn-secondary" style={{ fontSize: 12, padding: '8px 12px' }}>全部新聞</Link>
          </div>

          {recentNews.length > 0 ? (
            <div>
              {recentNews.map(item => (
                <Link key={item.id} href="/admin/news" className="admin-list-link">
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', color: '#e4e4e7', fontSize: 13, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title_zh || item.title_en || '未命名新聞'}</span>
                    <span style={{ display: 'block', color: '#71717a', fontSize: 12, marginTop: 2 }}>{item.published_at ? new Date(item.published_at).toLocaleDateString() : '未設定日期'}</span>
                  </span>
                  <span className={`status-pill ${item.is_published ? 'is-live' : 'is-draft'}`}>{item.is_published ? '已發佈' : '草稿'}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 18, color: '#71717a', fontSize: 13 }}>
              暫無新聞資料。可以先進入新聞管理建立第一篇內容。
            </div>
          )}
        </section>

        <aside className="admin-panel" style={{ padding: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 750, color: '#fff', marginBottom: 12 }}>內容健康度</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.065)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#d4d4d8', marginBottom: 8 }}>
                <span>最近新聞</span>
                <strong style={{ color: '#fff' }}>{recentNews.length}</strong>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${recentNews.length ? Math.max(12, (liveNews / recentNews.length) * 100) : 0}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #22d3ee)' }} />
              </div>
              <p style={{ color: '#71717a', fontSize: 12, marginTop: 8 }}>{liveNews} 篇已發佈，{draftNews} 篇草稿</p>
            </div>

            <Link href="/admin/messages" className="admin-list-link" style={{ borderTop: 'none', padding: '12px 0' }}>
              <span>
                <span style={{ display: 'block', color: '#e4e4e7', fontSize: 13, fontWeight: 650 }}>處理留言</span>
                <span style={{ display: 'block', color: '#71717a', fontSize: 12, marginTop: 2 }}>{counts.unreadMessages} 條未讀，{counts.messages} 條總留言</span>
              </span>
              <span style={{ color: '#818cf8' }}><Icon path={icons.arrow} size={17} /></span>
            </Link>

            <Link href="/admin/banners" className="admin-list-link">
              <span>
                <span style={{ display: 'block', color: '#e4e4e7', fontSize: 13, fontWeight: 650 }}>更新首頁主視覺</span>
                <span style={{ display: 'block', color: '#71717a', fontSize: 12, marginTop: 2 }}>{counts.banners} 個 Banner</span>
              </span>
              <span style={{ color: '#818cf8' }}><Icon path={icons.arrow} size={17} /></span>
            </Link>

            <Link href="/admin/settings" className="btn-secondary" style={{ justifyContent: 'center', marginTop: 8, fontSize: 13 }}>檢查站點設置</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
