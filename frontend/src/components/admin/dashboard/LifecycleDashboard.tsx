import Link from 'next/link';

export type DashboardSetupTask = {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  complete: boolean;
};

export type DashboardAttentionItem = {
  id: string;
  kind: 'page-draft' | 'news-draft' | 'configuration' | 'message';
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  priority: number;
  updatedAt: string | null;
};

export type DashboardRecentItem = {
  id: string;
  title: string;
  href: string;
  publishedAt: string | null;
};

export type DashboardModel = {
  mode: 'onboarding' | 'operations';
  setupTasks: DashboardSetupTask[];
  nextSetupTask: DashboardSetupTask | null;
  completedSetupCount: number;
  attentionItems: DashboardAttentionItem[];
  recentItems: DashboardRecentItem[];
  isHealthy: boolean;
};

type Props = {
  model: DashboardModel;
  loading: boolean;
  failedSources: string[];
  onRetry: () => void;
};

const QUICK_ACTIONS = [
  { label: '新增新聞', hint: '建立新聞草稿', href: '/admin/news' },
  { label: '新增活動', hint: '管理活動內容', href: '/admin/events' },
  { label: '設置 Banner', hint: '更新首頁焦點', href: '/admin/banners' },
  { label: '上傳媒體', hint: '加入圖片或文件', href: '/admin/media' },
];

const KIND_LABELS: Record<DashboardAttentionItem['kind'], string> = {
  'page-draft': '頁面修改',
  'news-draft': '新聞草稿',
  configuration: '需要設置',
  message: '新留言',
};

function formatDate(value: string | null): string {
  if (!value) return '最近發佈';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '最近發佈';
  return new Intl.DateTimeFormat('zh-HK', { month: 'short', day: 'numeric' }).format(parsed);
}

export function DashboardSkeleton() {
  return (
    <div className="admin-dashboard-skeleton" aria-label="正在載入營運資料" aria-busy="true">
      <div className="admin-dashboard-skeleton__hero" />
      <div className="admin-dashboard-skeleton__grid">
        <div className="admin-dashboard-skeleton__main" />
        <div className="admin-dashboard-skeleton__side" />
      </div>
      <div className="admin-dashboard-skeleton__recent" />
    </div>
  );
}

function SyncNotice({ failedSources, onRetry }: Pick<Props, 'failedSources' | 'onRetry'>) {
  if (failedSources.length === 0) return null;
  return (
    <div className="admin-dashboard-sync" role="status">
      <div>
        <strong>部分資料暫時無法同步</strong>
        <span>{failedSources.join('、')}</span>
      </div>
      <button type="button" onClick={onRetry}>重新同步</button>
    </div>
  );
}

function DashboardFailure({ onRetry }: Pick<Props, 'onRetry'>) {
  return (
    <div className="admin-dashboard-failure" role="alert">
      <span className="admin-dashboard-failure__mark">!</span>
      <div>
        <h2>無法載入營運資料</h2>
        <p>後台功能仍可從左側導航使用。請重新同步儀表盤資料。</p>
      </div>
      <button type="button" className="admin-dashboard-button" onClick={onRetry}>重新同步</button>
    </div>
  );
}

function OnboardingDashboard({ model }: { model: DashboardModel }) {
  const nextTask = model.nextSetupTask || model.setupTasks[model.setupTasks.length - 1];
  return (
    <>
      <div className="admin-dashboard-heading">
        <div>
          <h2>開始設置 HKBA 網站</h2>
          <p>完成基本內容後，儀表盤會自動切換成日常營運模式。</p>
        </div>
        <span className="admin-dashboard-progress-copy">{model.completedSetupCount} / {model.setupTasks.length} 已完成</span>
      </div>

      <div className="admin-dashboard-onboarding-grid">
        <section className="admin-dashboard-next" aria-labelledby="dashboard-next-title">
          <span>建議下一步</span>
          <h3 id="dashboard-next-title">{nextTask.title}</h3>
          <p>{nextTask.description}</p>
          <Link href={nextTask.href}>{nextTask.actionLabel}</Link>
        </section>
        <section className="admin-dashboard-readiness" aria-labelledby="dashboard-readiness-title">
          <h3 id="dashboard-readiness-title">網站狀態</h3>
          <strong>準備中</strong>
          <p>完成首次發佈後，公開網站會進入日常維護階段。</p>
        </section>
      </div>

      <section className="admin-dashboard-setup" aria-labelledby="dashboard-setup-title">
        <div className="admin-dashboard-section-head">
          <h3 id="dashboard-setup-title">開始清單</h3>
          <span>依建議順序完成</span>
        </div>
        <div className="admin-dashboard-setup-list">
          {model.setupTasks.map((item, index) => (
            <Link key={item.id} href={item.href} className={`admin-dashboard-setup-row${item.complete ? ' is-complete' : ''}`}>
              <span className="admin-dashboard-step">{item.complete ? '✓' : index + 1}</span>
              <span className="admin-dashboard-setup-copy">
                <strong>{item.title}</strong>
                <small>{item.complete ? '已完成' : item.description}</small>
              </span>
              <span className="admin-dashboard-row-action">{item.complete ? '查看' : item.actionLabel}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function AttentionPanel({ model }: { model: DashboardModel }) {
  return (
    <section className="admin-dashboard-attention" aria-labelledby="dashboard-attention-title">
      <div className="admin-dashboard-section-head">
        <h3 id="dashboard-attention-title">待完成</h3>
        {!model.isHealthy && <span>{model.attentionItems.length} 項</span>}
      </div>
      {model.isHealthy ? (
        <div className="admin-dashboard-healthy">
          <span className="admin-dashboard-healthy__mark">✓</span>
          <div>
            <strong>網站運行正常</strong>
            <p>目前沒有未發佈修改或需要立即處理的設置。</p>
          </div>
        </div>
      ) : (
        <div className="admin-dashboard-attention-list">
          {model.attentionItems.map((item) => (
            <Link key={item.id} href={item.href} className="admin-dashboard-attention-row">
              <span className={`admin-dashboard-kind is-${item.kind}`}>{KIND_LABELS[item.kind]}</span>
              <span className="admin-dashboard-attention-copy">
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
              <span className="admin-dashboard-row-action">{item.actionLabel}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function QuickActions() {
  return (
    <aside className="admin-dashboard-quick" aria-labelledby="dashboard-quick-title">
      <div className="admin-dashboard-section-head">
        <h3 id="dashboard-quick-title">快速開始</h3>
      </div>
      <div className="admin-dashboard-quick-list">
        {QUICK_ACTIONS.map((item) => (
          <Link key={item.href} href={item.href}>
            <span><strong>{item.label}</strong><small>{item.hint}</small></span>
            <span aria-hidden="true">+</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}

function RecentReleases({ items }: { items: DashboardRecentItem[] }) {
  return (
    <section className="admin-dashboard-recent" aria-labelledby="dashboard-recent-title">
      <div className="admin-dashboard-section-head">
        <h3 id="dashboard-recent-title">最近發佈</h3>
        <Link href="/admin/news">查看全部</Link>
      </div>
      {items.length ? (
        <div className="admin-dashboard-recent-list">
          {items.map((item) => (
            <Link key={item.id} href={item.href}>
              <strong>{item.title}</strong>
              <span>{formatDate(item.publishedAt)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="admin-dashboard-recent-empty">完成首次內容發佈後，最近記錄會顯示在這裡。</p>
      )}
    </section>
  );
}

function OperationsDashboard({ model }: { model: DashboardModel }) {
  return (
    <>
      <div className="admin-dashboard-heading">
        <div>
          <h2>{model.isHealthy ? '網站狀態良好' : `有 ${model.attentionItems.length} 項需要繼續處理`}</h2>
          <p>這裡只顯示真實的未完成事項，不重複左側管理入口。</p>
        </div>
        <span className="admin-dashboard-live-status">網站運行正常</span>
      </div>
      <div className="admin-dashboard-operations-grid">
        <AttentionPanel model={model} />
        <QuickActions />
      </div>
      <RecentReleases items={model.recentItems} />
    </>
  );
}

export default function LifecycleDashboard({ model, loading, failedSources, onRetry }: Props) {
  if (loading) return <DashboardSkeleton />;
  if (failedSources.length >= 5) return <DashboardFailure onRetry={onRetry} />;

  return (
    <div className="admin-dashboard">
      <SyncNotice failedSources={failedSources} onRetry={onRetry} />
      {model.mode === 'onboarding' ? <OnboardingDashboard model={model} /> : <OperationsDashboard model={model} />}
    </div>
  );
}
