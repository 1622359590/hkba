# HKBA 全站视觉 + 动画实现方案

> **参考样图：** 用户生成的首页 mockup（已确认风格）
> **核心风格：** 暗夜蓝靛科技感 + 靛蓝/天蓝发光效果 + WebGL 动画
> **配色方案：** E — 暗夜蓝靛（用户选定 2026-08-01）
> **日期：** 2026-08-01

---

## 参考样图结构

```
┌─────────────────────────────────────────────────────────┐
│  [H HKBA]    首頁  關於協會  新聞動態  活動中心  ...   🌐 EN [聯繫我們] │
│  ──────────── 透明→深色玻璃导航栏 ────────────          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  HKBA                          ⬡ ⬡ ⬡                  │
│  HONG KONG BLOCKCHAIN           ⬡ ⬡ ⬡ ⬡               │
│  ASSOCIATION                    ⬡ ⬡ ⬡ ⬡ ⬡             │
│                                  (六边形区块链网络)       │
│  [關於協會 >]  [加入我們 >]                              │
│                                                         │
│  200+        50+         5+                              │
│  會員單位    行業活動     深耕年數                         │
│                                                         │
├─────────────────── 渐变过渡 ─────────────────────────────┤
│                                                         │
│             OUR MISSION                                  │
│    推動香港成為全球區塊鏈創新樞鈕                          │
│    HKBA 致力於連接政府、企業...                           │
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ 🔗      │ │ 🛡️      │ │ 🌐      │ │ 🏛️      │       │
│  │ 連接生態 │ │ 行業賦能 │ │ 國際合作 │ │ 合規發展 │       │
│  │ 描述... │ │ 描述... │ │ 描述... │ │ 描述... │       │
│  │       > │ │       > │ │       > │ │       > │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 1. 色彩 Token

```css
:root {
  /* 主色 */
  --indigo:      #6366F1;
  --indigo-dim:  #4F46E5;
  --indigo-glow: rgba(99,102,241,0.28);
  --cyan:        #22D3EE;
  --cyan-dim:    #0891B2;
  --cyan-glow:   rgba(34,211,238,0.20);

  /* 背景层级 */
  --bg:          #0B1120;
  --surface-1:   #111B2E;
  --surface-2:   #172033;
  --surface-3:   #1E293B;

  /* 文字层级 */
  --text-1:      #E2E8F0;
  --text-2:      #94A3B8;
  --text-3:      #64748B;

  /* 边框 */
  --border-subtle: rgba(255,255,255,0.08);
  --border-hover:  rgba(255,255,255,0.15);

  /* 圆角 */
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   16px;
  --radius-xl:   22px;
  --radius-full: 999px;

  /* 阴影 */
  --shadow-sm:     0 2px 8px rgba(0,0,0,0.2);
  --shadow-md:     0 8px 24px rgba(0,0,0,0.3);
  --shadow-lg:     0 16px 48px rgba(0,0,0,0.4);
  --shadow-indigo: 0 8px 32px rgba(99,102,241,0.25);

  /* 动效 */
  --motion-fast:   140ms;
  --motion-normal: 240ms;
  --motion-slow:   400ms;
  --motion-enter:  600ms;
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-out-expo:  cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## 2. 导航栏

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
  padding: 0 clamp(20px, 4vw, 48px);
  transition: background 0.3s ease, backdrop-filter 0.3s ease;
}

/* 滚动后效果 */
.header.scrolled {
  background: rgba(6,9,15,0.85);
  backdrop-filter: blur(24px) saturate(1.4);
  border-bottom: 1px solid var(--border-subtle);
}

/* Logo - 靛蓝渐变方块 */
.header-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}
.header-logo-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--indigo), var(--indigo-dim));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
  font-size: 18px;
}
.header-logo-text {
  color: var(--text-1);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* 导航链接 */
.header-nav-link {
  color: var(--text-2);
  font-size: 14px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  transition: color 0.14s ease, background 0.14s ease;
}
.header-nav-link:hover {
  color: var(--text-1);
  background: rgba(255,255,255,0.04);
}
.header-nav-link.active {
  color: var(--indigo);
  background: rgba(99,102,241,0.1);
}

/* 联系按钮 */
.btn-nav {
  padding: 8px 20px;
  background: var(--indigo);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all 0.14s ease;
}
.btn-nav:hover {
  background: var(--indigo-dim);
  transform: translateY(-1px);
  box-shadow: var(--shadow-indigo);
}
```

---

## 3. Hero 区域

### 3.1 布局

```css
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  background: var(--bg);
  overflow: hidden;
}

/* 右侧区块链网络视觉 - 用生成的图片 */
.hero-visual {
  position: absolute;
  right: 0;
  top: 0;
  width: 55%;
  height: 100%;
  background: url('/images/hero-bg.jpg') center/cover no-repeat;
  mask-image: linear-gradient(to right, transparent 0%, black 25%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 25%);
  opacity: 0.9;
}

/* 渐变遮罩 - 让图片和背景融合 */
.hero-visual::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to right, var(--bg) 0%, transparent 20%),
    linear-gradient(180deg, transparent 70%, var(--bg) 100%);
}

/* 左侧内容 */
.hero-content {
  position: relative;
  z-index: 2;
  max-width: 700px;
  padding: 120px 48px 80px;
  margin-left: max(48px, calc((100vw - 1440px) / 2 + 48px));
}

/* HKBA 主标题 - 三色渐变 */
.hero-title {
  font-size: clamp(3.5rem, 8vw, 6rem);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #FFFFFF 0%, var(--indigo) 45%, var(--cyan) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 副标题 - 大写追踪 */
.hero-subtitle {
  font-size: clamp(0.75rem, 1.5vw, 1rem);
  font-weight: 500;
  color: var(--text-2);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 48px;
}

/* CTA 按钮组 */
.hero-actions {
  display: flex;
  gap: 16px;
  margin-bottom: 64px;
}

/* 统计数字 */
.hero-stats {
  display: flex;
  gap: 40px;
}
.hero-stat-number {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  color: var(--indigo);
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
  background: linear-gradient(180deg, transparent, var(--border-subtle), transparent);
  align-self: center;
}
```

### 3.2 Hero HTML 结构

```html
<section class="hero">
  <!-- 右侧区块链网络图片 -->
  <div class="hero-visual"></div>

  <!-- 左侧内容 -->
  <div class="hero-content">
    <h1 class="hero-title">HKBA</h1>
    <p class="hero-subtitle">Hong Kong Blockchain Association</p>

    <div class="hero-actions">
      <a href="/about" class="btn-primary">
        關於協會
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </a>
      <a href="/join" class="btn-secondary">
        加入我們
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

## 4. Section 通用样式

```css
/* Section 容器 */
.section {
  padding: 80px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Overline 标签 */
.section-overline {
  font-size: 12px;
  font-weight: 700;
  color: var(--indigo);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 12px;
  text-align: center;
}

/* Section 标题 */
.section-title {
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
  margin-bottom: 16px;
  line-height: 1.2;
}

/* Section 描述 */
.section-desc {
  font-size: 16px;
  color: var(--text-2);
  text-align: center;
  max-width: 640px;
  margin: 0 auto 48px;
  line-height: 1.75;
}

/* 发光分割线 */
.section-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--indigo) 30%, var(--cyan) 50%, var(--indigo) 70%, transparent);
  opacity: 0.25;
  margin: 0 auto;
  max-width: 800px;
}
```

---

## 5. 卡片样式

### 5.1 功能卡片（Our Mission 四宫格）

```css
.feature-card {
  background: rgba(255,255,255,0.025);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 28px 24px;
  transition: all 0.24s var(--ease-out-quart);
  cursor: pointer;
}

.feature-card:hover {
  border-color: var(--border-hover);
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(217,182,86,0.08);
}

/* 图标 */
.feature-card-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: rgba(217,182,86,0.1);
  border: 1px solid rgba(217,182,86,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  color: var(--indigo);
}

/* 标题 */
.feature-card-title {
  font-size: 18px;
  font-weight: 650;
  color: var(--text-1);
  margin-bottom: 10px;
}

/* 描述 */
.feature-card-desc {
  font-size: 14px;
  color: var(--text-2);
  line-height: 1.65;
}

/* 箭头 */
.feature-card-arrow {
  margin-top: 16px;
  color: var(--indigo);
  opacity: 0;
  transform: translateX(-8px);
  transition: all 0.24s var(--ease-out-quart);
}
.feature-card:hover .feature-card-arrow {
  opacity: 1;
  transform: translateX(0);
}

/* 网格布局 */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

@media (max-width: 1024px) {
  .feature-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .feature-grid { grid-template-columns: 1fr; }
}
```

### 5.2 功能卡片 HTML

```html
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
  <!-- 其他三张卡片类似 -->
</div>
```

---

## 6. 按钮样式

```css
/* Primary - 金色 */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  background: linear-gradient(135deg, var(--indigo), var(--indigo-dim));
  color: #fff;
  font-weight: 650;
  font-size: 15px;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all 0.14s var(--ease-out-quart);
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-indigo);
}
.btn-primary:active {
  transform: translateY(1px) scale(0.98);
}

/* Secondary - 描边 */
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  background: transparent;
  color: var(--text-1);
  font-weight: 600;
  font-size: 15px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all 0.14s var(--ease-out-quart);
}
.btn-secondary:hover {
  border-color: var(--border-hover);
  background: rgba(255,255,255,0.03);
  transform: translateY(-2px);
}
.btn-secondary:active {
  transform: translateY(1px) scale(0.98);
}

/* 箭头图标过渡 */
.btn-primary svg,
.btn-secondary svg {
  transition: transform 0.14s ease;
}
.btn-primary:hover svg,
.btn-secondary:hover svg {
  transform: translateX(4px);
}
```

---

## 7. 动画系统

### 7.1 滚动渐入

```css
/* 基础动画类 */
.fade-in-up {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity var(--motion-enter) var(--ease-out-expo),
              transform var(--motion-enter) var(--ease-out-expo);
}
.fade-in-up.visible {
  opacity: 1;
  transform: translateY(0);
}

/* 递增延迟 - 子元素 */
.stagger-1 { transition-delay: 0ms; }
.stagger-2 { transition-delay: 80ms; }
.stagger-3 { transition-delay: 160ms; }
.stagger-4 { transition-delay: 240ms; }
.stagger-5 { transition-delay: 320ms; }
.stagger-6 { transition-delay: 400ms; }
```

### 7.2 Hero 入场动画

```css
/* Hero 内容依次入场 */
.hero-content .hero-title {
  animation: heroFadeIn 0.8s var(--ease-out-expo) 0.1s both;
}
.hero-content .hero-subtitle {
  animation: heroFadeIn 0.8s var(--ease-out-expo) 0.2s both;
}
.hero-content .hero-actions {
  animation: heroFadeIn 0.8s var(--ease-out-expo) 0.35s both;
}
.hero-content .hero-stats {
  animation: heroFadeIn 0.8s var(--ease-out-expo) 0.5s both;
}

@keyframes heroFadeIn {
  from {
    opacity: 0;
    transform: translateY(30px);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

/* Hero 右侧图片入场 */
.hero-visual {
  animation: heroVisualIn 1.2s var(--ease-out-expo) 0.2s both;
}

@keyframes heroVisualIn {
  from {
    opacity: 0;
    transform: scale(1.05) translateX(30px);
  }
  to {
    opacity: 0.9;
    transform: scale(1) translateX(0);
  }
}
```

### 7.3 数字跳动动画

```css
/* 统计数字从 0 跳到目标值 */
.hero-stat-number {
  animation: countUp 1s var(--ease-out-expo) 0.6s both;
}

@keyframes countUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 7.4 卡片入场

```css
/* 卡片依次入场 */
.feature-card {
  opacity: 0;
  transform: translateY(24px);
}
.feature-card.visible {
  animation: cardIn 0.6s var(--ease-out-expo) forwards;
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
```

### 7.5 光标脉冲（导航 Active 状态）

```css
.header-nav-link.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  width: 6px;
  height: 6px;
  background: var(--indigo);
  border-radius: 50%;
  transform: translateX(-50%);
  animation: navPulse 2s infinite;
}

@keyframes navPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(99,102,241,0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(99,102,241,0);
  }
}
```

### 7.6 发光分割线动画

```css
.section-divider {
  position: relative;
  overflow: hidden;
}
.section-divider::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(217,182,86,0.6), transparent);
  animation: dividerGlow 4s ease-in-out infinite;
}

@keyframes dividerGlow {
  0% { left: -60%; }
  50% { left: 100%; }
  100% { left: -60%; }
}
```

---

## 8. IntersectionObserver 滚动触发

```tsx
// 在组件中使用
'use client'

import { useEffect, useRef } from 'react'

export function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )

    const el = ref.current
    if (el) {
      el.querySelectorAll('.fade-in-up, .feature-card').forEach((child) => {
        observer.observe(child)
      })
    }

    return () => observer.disconnect()
  }, [])

  return ref
}

// 使用
<section ref={useScrollReveal()}>
  <div class="fade-in-up stagger-1">...</div>
  <div class="feature-grid">
    <div class="feature-card">...</div>
    <div class="feature-card">...</div>
    <div class="feature-card">...</div>
    <div class="feature-card">...</div>
  </div>
</section>
```

---

## 9. 给 Codex 的完整命令

```bash
Read docs/superpowers/specs/2026-08-01-brand-style-guide.md and implement the full visual style system with animations for the HKBA website. The reference mockup is at docs/superpowers/specs/2026-08-01-full-site-redesign-spec.md (user confirmed this style). Execute:

PHASE 1 - Design Tokens (globals.css):
1. Update :root with all tokens from this spec (colors, spacing, radius, shadows, motion)
2. Ensure @theme inline block matches

PHASE 2 - Typography:
1. Add Google Fonts Inter (weights 400-900) to layout.tsx
2. Update body font-family to include Inter

PHASE 3 - Navigation (navigation.css):
1. Implement glassmorphism header with scroll effect
2. Indigo gradient logo
3. Nav links with active indigo state and pulse animation

PHASE 4 - Hero Section (HomePageClient.tsx + cards.css/utilities.css):
1. Two-column layout: left text, right hero-bg.jpg with gradient mask
2. HKBA title with white→indigo→cyan gradient text
3. Uppercase subtitle with letter-spacing
4. Indigo primary button + outline secondary button with arrow icons
5. Stats row with indigo numbers and dividers
6. Hero entrance animations (staggered fade-in)

PHASE 5 - Cards (cards.css):
1. Feature cards: glass background, icon container, title, description, arrow
2. Hover: translateY(-4px) + indigo glow
3. Grid layout: 4 columns → 2 → 1 responsive

PHASE 6 - Animations (animations.css):
1. Scroll reveal with IntersectionObserver
2. Staggered fade-in-up for sections
3. Hero entrance sequence
4. Card entrance with delays
5. Divider glow animation
6. Respect prefers-reduced-motion

PHASE 7 - Buttons (buttons.css):
1. Gold primary with gradient and glow hover
2. Outline secondary with border transition
3. Arrow icon slide on hover

PHASE 8 - Apply to ALL pages:
1. Use consistent section headers (overline + title + desc)
2. Apply feature cards to About, Services sections
3. Ensure responsive behavior

Verify with npm run dev at 375px, 768px, 1280px viewports.
```
