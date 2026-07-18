-- 001_baseline.sql
-- HKBA Phase 2 baseline migration.
--
-- Absorbs the pre-migration schema formerly loaded from backend/db/schema.sql.
-- Every statement uses IF NOT EXISTS so the baseline is idempotent.
-- On legacy databases that predate schema_migrations, the migrator records
-- this migration as applied WITHOUT executing it (see backend/db/migrate.js).

-- 管理员
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 多语言文本存储（通用翻译表）
CREATE TABLE IF NOT EXISTS translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'zh-TW',
  value TEXT NOT NULL,
  UNIQUE(key, lang)
);

-- Banner 轮播
CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_zh TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  subtitle_zh TEXT DEFAULT '',
  subtitle_en TEXT DEFAULT '',
  description_zh TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  image_url TEXT NOT NULL,
  link_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 滚动公告
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_zh TEXT NOT NULL DEFAULT '',
  content_en TEXT NOT NULL DEFAULT '',
  link_url TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 合作伙伴
CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  website_url TEXT DEFAULT '',
  group_name TEXT DEFAULT 'default',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 团队成员
CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_zh TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  title_zh TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  bio_zh TEXT DEFAULT '',
  bio_en TEXT DEFAULT '',
  avatar_url TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT 'honorary_chairman',
  -- honorary_chairman, chairman, vice_chairman, committee, advisor
  social_facebook TEXT DEFAULT '',
  social_twitter TEXT DEFAULT '',
  social_linkedin TEXT DEFAULT '',
  social_instagram TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 新闻文章
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_zh TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  summary_zh TEXT DEFAULT '',
  summary_en TEXT DEFAULT '',
  content_zh TEXT DEFAULT '',
  content_en TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  tags TEXT DEFAULT '',
  is_published INTEGER DEFAULT 0,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 活动
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_zh TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  description_zh TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  content_zh TEXT DEFAULT '',
  content_en TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',
  event_date DATETIME NOT NULL,
  end_date DATETIME,
  location_zh TEXT DEFAULT '',
  location_en TEXT DEFAULT '',
  max_attendees INTEGER DEFAULT 0,
  current_attendees INTEGER DEFAULT 0,
  registration_url TEXT DEFAULT '',
  is_published INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 页面内容（关于我们/会员服务等静态页面）
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  -- about, membership, contact, etc.
  title_zh TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  content_zh TEXT DEFAULT '',
  content_en TEXT DEFAULT '',
  meta_title_zh TEXT DEFAULT '',
  meta_title_en TEXT DEFAULT '',
  meta_desc_zh TEXT DEFAULT '',
  meta_desc_en TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 联系信息
CREATE TABLE IF NOT EXISTS contact_info (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  -- phone, email, address, facebook, twitter, youtube, instagram, linkedin
  value TEXT NOT NULL DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 联系表单提交
CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT DEFAULT '',
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 媒体库
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  url TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 发展历程（时间轴）
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year TEXT NOT NULL,
  title_zh TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  description_zh TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 统计数据（首页数字展示）
CREATE TABLE IF NOT EXISTS stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label_zh TEXT NOT NULL DEFAULT '',
  label_en TEXT NOT NULL DEFAULT '',
  value TEXT NOT NULL DEFAULT '0',
  icon TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);
