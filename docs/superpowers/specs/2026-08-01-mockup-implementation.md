# HKBA 严格视觉实现规范 — 基于用户确认的 Mockup

> **此文档严格基于用户确认的首页 mockup 生成，Codex 必须精确还原**
> **日期：** 2026-08-01

---

## 参考样图（用户确认）

```
┌─────────────────────────────────────────────────────────────────┐
│  [H] HKBA    首頁  關於協會  新聞動態  活動中心  會員單位   🌐 繁|EN [聯繫我們] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HKBA                              ┌─────────────────────────┐ │
│  HONG KONG BLOCKCHAIN              │  区块链城市背景          │ │
│  ASSOCIATION                       │  发光蓝色方块            │ │
│                                    │  网络连接线              │ │
│  [關於協會 >]  [加入我們 >]          │  城市天际线              │ │
│                                    └─────────────────────────┘ │
│  200+         50+          5+                                    │
│  會員單位     行業活動      深耕年數                               │
├──────────────────── 渐变过渡 ───────────────────────────────────┤
│                                                                 │
│                   OUR MISSION                                   │
│       推動香港成為全球區塊鏈創新樞鈕                               │
│       HKBA 致力於連接政府、企業...                                │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 🔗       │ │ 🛡️       │ │ 🌐       │ │ 🏛️       │           │
│  │ 連接生態  │ │ 行業賦能  │ │ 國際合作  │ │ 合規發展  │           │
│  │ 描述...  │ │ 描述...  │ │ 描述...  │ │ 描述...  │           │
│  │        > │ │        > │ │        > │ │        > │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. 精确色彩值

```css
:root {
  /* ═══ 主色板 ═══ */
  --blue:        #3B82F6;    /* 主强调色 - 所有关键元素 */
  --blue-dim:    #2563EB;    /* 深色变体 */
  --blue-glow:   rgba(59,130,246,0.35);  /* 发光阴影 */
  --cyan:        #22D3EE;    /* 辅助强调色 */
  --cyan-glow:   rgba(34,211,238,0.25);

  /* ═══ 背景层级 ═══ */
  --bg:          #0B1120;    /* 页面底色 - 深海军蓝 */
  --surface-1:   #111B2E;    /* 卡片/面板 */
  --surface-2:   #172033;    /* 弹出层 */
  --surface-3:   #1E293B;    /* Hover 态 */

  /* ═══ 文字层级 ═══ */
  --text-1:      #E2E8F0;    /* 主文字 - 近白 */
  --text-2:      #94A3B8;    /* 次文字 */
  --text-3:      #64748B;    /* 弱化文字 */

  /* ═══ 边框 ═══ */
  --border:      rgba(255,255,255,0.08);
  --border-hover: rgba(255,255,255,0.15);
  --border-blue: rgba(59,130,246,0.3);

  /* ═══ 阴影 ═══ */
  --shadow-sm:   0 2px 8px rgba(0,0,0,0.2);
  --shadow-md:   0 8px 24px rgba(0,0,0,0.3);
  --shadow-lg:   0 16px 48px rgba(0,0,0,0.4);
  --shadow-glow: 0 8px 32px rgba(59,130,246,0.25);

  /* ═══ 圆角 ═══ */
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   16px;
  --radius-xl:   22px;

  /* ═══ 动效 ═══ */
  --ease:        cubic-bezier(0.25, 1, 0.5, 1);
  --ease-expo:   cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## 2. 导航栏（精确还原）

### 样式
```css
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(24px, 5vw, 60px);
  background: transparent;
  transition: background 0.3s ease, backdrop-filter 0.3s ease;
}

/* 滚动后 - 毛玻璃效果 */
.header.scrolled {
  background: rgba(11,17,32,0.88);
  backdrop-filter: blur(20px) saturate(1.3);
  border-bottom: 1px solid var(--border);
}

/* Logo 区域 */
.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}
.header-brand-icon {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: linear-gradient(135deg, #3B82F6, #2563EB);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
  font-size: 18px;
  box-shadow: 0 4px 12px rgba(59,130,246,0.3);
}
.header-brand-text {
  color: var(--text-1);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* 导航链接 */
.header-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}
.header-nav-link {
  color: var(--text-2);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  text-decoration: none;
  position: relative;
  transition: color 0.15s ease, background 0.15s ease;
}
.header-nav-link:hover {
  color: var(--text-1);
}
.header-nav-link.active {
  color: var(--blue);
}
.header-nav-link.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 2px;
  background: var(--blue);
  border-radius: 1px;
}

/* 右侧操作区 */
.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.header-lang {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-2);
  font-size: 13px;
}
.header-lang-divider {
  width: 1px;
  height: 16px;
  background: var(--border);
}
.header-btn {
  padding: 8px 20px;
  background: var(--blue);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s ease;
}
.header-btn:hover {
  background: var(--blue-dim);
  box-shadow: var(--shadow-glow);
}
```

### HTML 结构
```html
<header class="header" id="header">
  <a href="/" class="header-brand">
    <div class="header-brand-icon">H</div>
    <span class="header-brand-text">HKBA</span>
  </a>

  <nav class="header-nav">
    <a href="/" class="header-nav-link active">首頁</a>
    <a href="/about" class="header-nav-link">關於協會</a>
    <a href="/news" class="header-nav-link">新聞動態</a>
    <a href="/events" class="header-nav-link">活動中心</a>
    <a href="/members" class="header-nav-link">會員單位</a>
  </nav>

  <div class="header-actions">
    <div class="header-lang">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <span>繁</span>
      <div class="header-lang-divider"></div>
      <span>EN</span>
    </div>
    <a href="/contact" class="header-btn">聯繫我們</a>
  </div>
</header>
```

---

## 3. Hero 区域（精确还原）

### 布局
```css
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  background: var(--bg);
  overflow: hidden;
}

/* 右侧背景图 - 区块链城市 */
.hero-bg {
  position: absolute;
  right: 0;
  top: 0;
  width: 58%;
  height: 100%;
  background: url('/images/hero-bg.jpg') center/cover no-repeat;
  opacity: 0.95;
}

/* 左侧渐变遮罩 - 让图片融入背景 */
.hero-bg::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 40%;
  height: 100%;
  background: linear-gradient(to right, var(--bg) 0%, transparent 100%);
  z-index: 1;
}

/* 底部渐变遮罩 */
.hero-bg::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 30%;
  background: linear-gradient(to top, var(--bg) 0%, transparent 100%);
  z-index: 1;
}

/* 左侧内容 */
.hero-content {
  position: relative;
  z-index: 2;
  max-width: 680px;
  padding: 140px 60px 80px;
  margin-left: clamp(60px, 8vw, 120px);
}

/* HKBA 主标题 - 渐变文字 */
.hero-title {
  font-size: clamp(4rem, 9vw, 7.5rem);
  font-weight: 900;
  letter-spacing: -0.04em;
  line-height: 1;
  margin-bottom: 16px;
  background: linear-gradient(
    135deg,
    #FFFFFF 0%,
    #60A5FA 40%,
    #22D3EE 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
}

/* 副标题 */
.hero-subtitle {
  font-size: clamp(0.8rem, 1.4vw, 1rem);
  font-weight: 500;
  color: var(--text-2);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 12px;
}

/* 装饰线 */
.hero-line {
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, var(--blue), var(--cyan));
  margin-bottom: 40px;
  border-radius: 1px;
}

/* CTA 按钮 */
.hero-actions {
  display: flex;
  gap: 16px;
  margin-bottom: 56px;
}

.btn-hero-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  background: linear-gradient(135deg, #3B82F6, #2563EB);
  color: #fff;
  font-weight: 600;
  font-size: 15px;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s var(--ease);
  box-shadow: 0 4px 16px rgba(59,130,246,0.3);
}
.btn-hero-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(59,130,246,0.4);
}
.btn-hero-primary svg {
  transition: transform 0.2s ease;
}
.btn-hero-primary:hover svg {
  transform: translateX(4px);
}

.btn-hero-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  background: transparent;
  color: var(--text-1);
  font-weight: 600;
  font-size: 15px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-hover);
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s var(--ease);
}
.btn-hero-secondary:hover {
  border-color: var(--blue);
  background: rgba(59,130,246,0.05);
  transform: translateY(-2px);
}
.btn-hero-secondary svg {
  transition: transform 0.2s ease;
}
.btn-hero-secondary:hover svg {
  transform: translateX(4px);
}

/* 统计数字 */
.hero-stats {
  display: flex;
  gap: 48px;
}
.hero-stat {
  display: flex;
  flex-direction: column;
}
.hero-stat-number {
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 800;
  color: var(--blue);
  line-height: 1;
}
.hero-stat-label {
  font-size: 13px;
  color: var(--text-3);
  margin-top: 6px;
}
.hero-stat-divider {
  width: 1px;
  height: 48px;
  background: linear-gradient(180deg, transparent, var(--border), transparent);
  align-self: center;
}
```

### Hero HTML
```html
<section class="hero">
  <!-- 背景图 -->
  <div class="hero-bg"></div>

  <!-- 左侧内容 -->
  <div class="hero-content">
    <h1 class="hero-title">HKBA</h1>
    <p class="hero-subtitle">Hong Kong Blockchain Association</p>
    <div class="hero-line"></div>

    <div class="hero-actions">
      <a href="/about" class="btn-hero-primary">
        關於協會
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </a>
      <a href="/join" class="btn-hero-secondary">
        加入我們
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </a>
    </div>

    <div class="hero-stats">
      <div class="hero-stat">
        <div class="hero-stat-number">200+</div>
        <div class="hero-stat-label">會員單位</div>
      </div>
      <div class="hero-stat-divider"></div>
      <div class="hero-stat">
        <div class="hero-stat-number">50+</div>
        <div class="hero-stat-label">行業活動</div>
      </div>
      <div class="hero-stat-divider"></div>
      <div class="hero-stat">
        <div class="hero-stat-number">5+</div>
        <div class="hero-stat-label">深耕年數</div>
      </div>
    </div>
  </div>
</section>
```

---

## 4. Mission 区域（精确还原）

### 样式
```css
.mission {
  padding: 80px 24px 100px;
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}

.mission-overline {
  font-size: 12px;
  font-weight: 700;
  color: var(--blue);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.mission-title {
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 20px;
  line-height: 1.3;
}

.mission-desc {
  font-size: 16px;
  color: var(--text-2);
  max-width: 720px;
  margin: 0 auto 56px;
  line-height: 1.8;
}

/* 功能卡片网格 */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.feature-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 28px 24px;
  text-align: left;
  cursor: pointer;
  transition: all 0.25s var(--ease);
  position: relative;
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    rgba(59,130,246,0.08),
    transparent 50%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.feature-card:hover {
  border-color: var(--border-blue);
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(59,130,246,0.1);
}

.feature-card:hover::before {
  opacity: 1;
}

.feature-card-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: rgba(59,130,246,0.1);
  border: 1px solid rgba(59,130,246,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  color: var(--blue);
}

.feature-card-title {
  font-size: 18px;
  font-weight: 650;
  color: var(--text-1);
  margin-bottom: 10px;
}

.feature-card-desc {
  font-size: 14px;
  color: var(--text-2);
  line-height: 1.7;
}

.feature-card-arrow {
  position: absolute;
  bottom: 24px;
  right: 24px;
  color: var(--blue);
  opacity: 0;
  transform: translateX(-8px);
  transition: all 0.25s var(--ease);
}

.feature-card:hover .feature-card-arrow {
  opacity: 1;
  transform: translateX(0);
}

/* 响应式 */
@media (max-width: 1024px) {
  .feature-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .feature-grid { grid-template-columns: 1fr; }
  .hero-content { padding: 120px 24px 60px; margin-left: 0; }
  .hero-stats { flex-wrap: wrap; gap: 24px; }
  .hero-stat-divider { display: none; }
  .hero-actions { flex-direction: column; }
  .btn-hero-primary, .btn-hero-secondary { width: 100%; justify-content: center; }
}
```

### Mission HTML
```html
<section class="mission">
  <div class="mission-overline">OUR MISSION</div>
  <h2 class="mission-title">推動香港成為全球區塊鏈創新樞鈕</h2>
  <p class="mission-desc">
    HKBA 致力於連接政府、企業、投資者與技術社群，推動區塊鏈技術在各行各業的應用與發展，構建開放、協作、共贏的區塊鏈生態系統。
  </p>

  <div class="feature-grid">
    <div class="feature-card">
      <div class="feature-card-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </div>
      <div class="feature-card-title">連接生態</div>
      <div class="feature-card-desc">連接全球區塊鏈項目、企業、投資者與技術專家，構建強大生態網絡。</div>
      <div class="feature-card-arrow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
    </div>

    <div class="feature-card">
      <div class="feature-card-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <div class="feature-card-title">行業賦能</div>
      <div class="feature-card-desc">提供政策解讀、資源對接、培訓支持，助力會員成長與行業發展。</div>
      <div class="feature-card-arrow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
    </div>

    <div class="feature-card">
      <div class="feature-card-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </div>
      <div class="feature-card-title">國際合作</div>
      <div class="feature-card-desc">促進國際交流與合作，推動香港區塊鏈技術與全球標準接軌。</div>
      <div class="feature-card-arrow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
    </div>

    <div class="feature-card">
      <div class="feature-card-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4"/>
          <path d="M5 21V10.87M19 21V10.87"/>
        </svg>
      </div>
      <div class="feature-card-title">合規發展</div>
      <div class="feature-card-desc">推動行業自律與合規建設，促進區塊鏈行業健康可持續發展。</div>
      <div class="feature-card-arrow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
    </div>
  </div>
</section>
```

---

## 5. 动画（精确还原）

```css
/* ═══ Hero 入场序列 ═══ */
.hero-content > * {
  opacity: 0;
  transform: translateY(24px);
}

.hero.visible .hero-title {
  animation: fadeSlideIn 0.7s var(--ease-expo) 0.1s forwards;
}
.hero.visible .hero-subtitle {
  animation: fadeSlideIn 0.7s var(--ease-expo) 0.2s forwards;
}
.hero.visible .hero-line {
  animation: fadeSlideIn 0.7s var(--ease-expo) 0.3s forwards;
}
.hero.visible .hero-actions {
  animation: fadeSlideIn 0.7s var(--ease-expo) 0.4s forwards;
}
.hero.visible .hero-stats {
  animation: fadeSlideIn 0.7s var(--ease-expo) 0.55s forwards;
}

@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(24px);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

/* ═══ 背景图入场 ═══ */
.hero-bg {
  opacity: 0;
  transform: scale(1.05);
}
.hero.visible .hero-bg {
  animation: bgIn 1.2s var(--ease-expo) 0.15s forwards;
}

@keyframes bgIn {
  to {
    opacity: 0.95;
    transform: scale(1);
  }
}

/* ═══ 卡片滚动入场 ═══ */
.feature-card {
  opacity: 0;
  transform: translateY(24px);
}
.feature-card.visible {
  animation: cardIn 0.6s var(--ease-expo) forwards;
}
.feature-card:nth-child(1).visible { animation-delay: 0ms; }
.feature-card:nth-child(2).visible { animation-delay: 100ms; }
.feature-card:nth-child(3).visible { animation-delay: 200ms; }
.feature-card:nth-child(4).visible { animation-delay: 300ms; }

@keyframes cardIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ═══ 尊重减少动画偏好 ═══ */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 6. 给 Codex 的精确命令

```bash
Read docs/superpowers/specs/2026-08-01-mockup-implementation.md and implement EXACTLY as specified. This is a pixel-perfect recreation of the confirmed mockup.

Step 1: Update frontend/src/app/globals.css :root with the exact color tokens from §1 (blue #3B82F6 scheme)

Step 2: Update frontend/src/styles/navigation.css with the exact header styles from §2 (glassmorphism, blue logo, active underline, lang toggle)

Step 3: Create/update the hero section in HomePageClient.tsx using the exact HTML structure from §3.2 and CSS from §3.1 (two-column, gradient title, stats row)

Step 4: Create/update the mission section using the exact HTML from §4.2 and CSS from §4.1 (overline, title, 4 feature cards with arrow hover)

Step 5: Add the exact animation keyframes from §5 to animations.css

Step 6: Save a blockchain city background image to frontend/public/images/hero-bg.jpg (use the one the user generated earlier or generate a new one)

Step 7: Add IntersectionObserver in HomePageClient.tsx to trigger .visible class on hero and feature cards

Step 8: Verify responsive: mobile (375px) single column, tablet (768px) 2-col cards, desktop (1280px) full layout

Run npm run dev and verify the homepage matches the mockup exactly.
```
