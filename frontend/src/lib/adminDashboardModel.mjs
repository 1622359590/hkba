export function flattenDashboardPages(nodes = []) {
  return nodes.flatMap((node) => [node, ...flattenDashboardPages(node.children || [])]);
}

function isActive(row) {
  return row?.is_active === true || Number(row?.is_active) === 1;
}

function itemDate(row) {
  return row?.updated_at || row?.published_at || row?.created_at || null;
}

function comparableTime(value) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pageTitle(page) {
  return page.title_zh || page.title_en || page.slug || page.path || '未命名頁面';
}

function newsTitle(news) {
  return news.title_zh || news.title_en || news.slug || '未命名新聞';
}

function setupTasks({ pages, news, activeBanners, activeTeam, hasPublication }) {
  return [
    {
      id: 'pages',
      title: '建立頁面結構',
      description: '準備首頁、關於、聯絡等基本頁面。',
      href: '/admin/pages',
      actionLabel: '管理頁面',
      complete: pages.length > 0,
    },
    {
      id: 'banners',
      title: '設置首頁 Banner',
      description: '加入網站第一屏的主視覺與重點訊息。',
      href: '/admin/banners',
      actionLabel: '設置 Banner',
      complete: activeBanners.length > 0,
    },
    {
      id: 'team',
      title: '添加團隊成員',
      description: '建立協會的組織與人物資料。',
      href: '/admin/team',
      actionLabel: '添加成員',
      complete: activeTeam.length > 0,
    },
    {
      id: 'news',
      title: '創建第一篇新聞',
      description: '讓網站擁有第一項可持續更新的內容。',
      href: '/admin/news',
      actionLabel: '創建新聞',
      complete: news.some((item) => item.status !== 'trash'),
    },
    {
      id: 'publish',
      title: '預覽並完成首次發佈',
      description: '確認公開內容後，完成網站的第一次發佈。',
      href: pages[0]?.id ? `/admin/studio?id=${encodeURIComponent(pages[0].id)}` : '/admin/pages',
      actionLabel: '前往發佈',
      complete: hasPublication,
    },
  ];
}

function attentionItems({ pages, news, activeBanners, activeTeam, unread }) {
  const items = [];

  for (const page of pages) {
    if (!page.has_draft) continue;
    items.push({
      id: `page-draft:${page.id}`,
      kind: 'page-draft',
      title: `${pageTitle(page)}有修改尚未發佈`,
      description: page.missing_en ? '英文標題尚未完成，完成後即可繼續發佈。' : '草稿已保存，公開網站仍在使用上一個版本。',
      href: `/admin/studio?id=${encodeURIComponent(page.id)}`,
      actionLabel: '繼續編輯',
      priority: 1,
      updatedAt: itemDate(page),
    });
  }

  for (const newsItem of news) {
    if (newsItem.status !== 'draft') continue;
    items.push({
      id: `news-draft:${newsItem.id}`,
      kind: 'news-draft',
      title: `${newsTitle(newsItem)}尚未發佈`,
      description: newsItem.missing_en ? '英文內容尚未完成，這篇新聞仍保留為草稿。' : '內容已保存為草稿，等待完成與發佈。',
      href: `/admin/news?id=${encodeURIComponent(newsItem.id)}`,
      actionLabel: '查看草稿',
      priority: 2,
      updatedAt: itemDate(newsItem),
    });
  }

  if (activeBanners.length === 0) {
    items.push({
      id: 'config:banners',
      kind: 'configuration',
      title: '首頁沒有啟用的 Banner',
      description: '首頁主視覺目前沒有可顯示的內容。',
      href: '/admin/banners',
      actionLabel: '去設置',
      priority: 3,
      updatedAt: null,
    });
  }

  if (activeTeam.length === 0) {
    items.push({
      id: 'config:team',
      kind: 'configuration',
      title: '團隊頁沒有啟用的成員',
      description: '添加並啟用成員後，人物資料才會出現在前台。',
      href: '/admin/team',
      actionLabel: '管理團隊',
      priority: 3,
      updatedAt: null,
    });
  }

  if (Number(unread) > 0) {
    items.push({
      id: 'messages:unread',
      kind: 'message',
      title: `${Number(unread)} 則聯絡留言尚未閱讀`,
      description: '新留言正在等待管理員查看。',
      href: '/admin/messages',
      actionLabel: '查看留言',
      priority: 4,
      updatedAt: null,
    });
  }

  return items
    .sort((left, right) => left.priority - right.priority
      || comparableTime(right.updatedAt) - comparableTime(left.updatedAt)
      || left.id.localeCompare(right.id))
    .slice(0, 6);
}

function recentItems(news) {
  return news
    .filter((item) => item.status === 'published')
    .sort((left, right) => comparableTime(right.published_at || right.updated_at) - comparableTime(left.published_at || left.updated_at))
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: newsTitle(item),
      href: `/admin/news?id=${encodeURIComponent(item.id)}`,
      publishedAt: item.published_at || item.updated_at || null,
    }));
}

export function buildAdminDashboardModel(input = {}) {
  const pages = flattenDashboardPages(input.pages || []).filter((page) => page.node_type !== 'section');
  const news = input.news || [];
  const banners = input.banners || [];
  const team = input.team || [];
  const activeBanners = banners.filter(isActive);
  const activeTeam = team.filter(isActive);
  const hasPublication = pages.some((page) => page.is_published) || news.some((item) => item.status === 'published');
  const mode = hasPublication ? 'operations' : 'onboarding';
  const tasks = setupTasks({ pages, news, activeBanners, activeTeam, hasPublication });
  const work = mode === 'operations' ? attentionItems({ pages, news, activeBanners, activeTeam, unread: input.unread }) : [];

  return {
    mode,
    setupTasks: tasks,
    nextSetupTask: tasks.find((task) => !task.complete) || null,
    completedSetupCount: tasks.filter((task) => task.complete).length,
    attentionItems: work,
    recentItems: recentItems(news),
    isHealthy: mode === 'operations' && work.length === 0,
  };
}
