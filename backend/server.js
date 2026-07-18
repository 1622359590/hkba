require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase, closeDatabase } = require('./db/init');
const { isOriginAllowed } = require('./lib/corsPolicy');

// 初始化数据库（单例）
initDatabase();

const app = express();
const PORT = process.env.PORT || 37900;
const HOST = process.env.HOST || '127.0.0.1';

// 中间件
// CORS 白名单：本地默认值，可通过 ALLOWED_ORIGINS 逗号分隔覆盖
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
];
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
app.use((req, res, next) => {
  cors({
    origin: (origin, cb) => {
      const allowed = isOriginAllowed({
        origin,
        allowedOrigins: ALLOWED_ORIGINS,
        host: req.get('host'),
        forwardedHost: req.get('x-forwarded-host'),
        proxyHost: req.get('x-hkba-forwarded-host'),
        fetchSite: req.get('sec-fetch-site'),
      });
      cb(allowed ? null : new Error('CORS blocked'), allowed);
    },
    credentials: true,
  })(req, res, next);
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件 - 上传目录
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/partners', require('./routes/partners'));
app.use('/api/team', require('./routes/team'));
app.use('/api/news', require('./routes/news'));
app.use('/api/events', require('./routes/events'));
app.use('/api/pages', require('./routes/pages'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/media', require('./routes/media'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/milestones', require('./routes/milestones'));
app.use('/api/upload', require('./routes/upload'));

// Phase 2 admin APIs (unified envelope, RBAC, audit)
app.use('/api/admin/components', require('./routes/admin/components'));
app.use('/api/admin/pages', require('./routes/admin/pages'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: '伺服器錯誤' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 HKBA Backend running at http://${HOST}:${PORT}`);
});

// 优雅退出
function shutdown(signal) {
  console.log(`${signal} received, closing server...`);
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
