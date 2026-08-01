# HKBA 官网全站样式优化方案

> **目标：** 统一视觉语言、提升专业感和品牌一致性，修复颜色冲突，优化移动端体验。
> **执行者：** Codex | **日期：** 2026-08-01

---

## 1. 核心问题诊断

| 问题 | 位置 | 说明 |
|---|---|---|
| **颜色方案冲突** | `DESIGN.md` vs `globals.css` | DESIGN.md 写的是 indigo/violet (`#6366f1`)，实际 CSS token 已切到 gold/cyan (`#D9B656`)，两套颜色并存 |
| **Header logo 渐变残留** | `Header.tsx` | Logo 用 `#6366f1 → #7c3aed`，与当前 gold 主题不一致 |
| **Footer logo 渐变残留** | `Footer.tsx` | 同上 |
| **Hero 区域旧色** | `HomePageClient.tsx` | Hero gradient / section label / milestone dot 仍用 indigo |
| **system font 无定制** | `globals.css` | 没有加载任何 Web Font，缺少品牌辨识度 |
| **globals.css 巨型** | 1950+ 行 | 可维护性差，建议拆分 |

---

## 2. 统一色彩系统

### 2.1 公网暗色主题 — 更新 `:root` tokens

```css
:root {
  /* ═══ 品牌色 ═══ */
  --gold:        #D9B656;    /* 保持 — 主强调色，代表「信任/价值」 */
  --gold-dim:    #B89A3F;    /* 深色变体，用于 hover */
  --gold-glow:   rgba(217,182,86,0.28);  /* 发光阴影 */
  --cyan:        #67E8F9;    /* 保持 — 交互/信息色 */
  --cyan-dim:    #0B7F8C;    /* 深色变体 */

  /* ═══ 背景层级 ═══ */
  --bg:          #06090F;    /* 略微提亮，增加层次感 */
  --surface-1:   #0B1120;    /* 卡片/面板底色 */
  --surface-2:   #101828;    /* 弹出层/浮层 */

  /* ═══ 文字层级 ═══ */
  --text-1:      #E8EDF5;    /* 主文字 — 更纯净的白 */
  --text-2:      #8896A8;    /* 次文字 */
  --text-3:      #5A6B7F;    /* 弱化文字 */

  /* ═══ 语义色 ═══ */
  --ok:          #34D399;    /* 成功 — 更鲜明的绿 */
  --warn:        #FBBF24;    /* 警告 */
  --err:         #F87171;    /* 错误 */

  /* ═══ 边框 ═══ */
  --border-subtle: rgba(255,255,255,0.08);
  --border-hover:  rgba(255,255,255,0.15);
}
```

### 2.2 去除 indigo/violet 残留

**全局搜索替换以下硬编码色值：**

| 旧值 | 新值 | 出现位置 |
|---|---|---|
| `#6366f1` | `var(--gold)` | Header logo, Footer logo, hero gradient, nav active bg |
| `#7c3aed` | `var(--gold-dim)` | Header logo gradient end |
| `#818cf8` | `var(--cyan)` | Section labels, milestone dots |
| `#a5b4fc` (`.metric-accent`) | `var(--gold)` | Stats section |
| `rgba(99,102,241,...)` | `rgba(217,182,86,...)` | Nav active background |

### 2.3 Admin 浅色主题 — 更新 `.admin-shell`

```css
.admin-shell {
  --bg:          #F4F6F8;
  --surface-1:   #FFFFFF;
  --surface-2:   #F9FAFB;
  --border-subtle: #DCE2E8;
  --text-1:      #1A2332;
  --text-2:      #526170;
  --text-3:      #8896A8;
  --gold:        #9A721C;    /* 深金，确保白底对比度 ≥ 4.5:1 */
  --gold-dim:    #7A5A15;
  --gold-glow:   rgba(154,114,28,0.15);
  --cyan:        #0B7F8C;
  --ok:          #059669;
  --err:         #DC2626;
  color-scheme: light;
}
```

---

## 3. 字体方案

### 3.1 加载 Web Font

在 `app/layout.tsx` 的 `<head>` 中添加：

```tsx
// 使用 Inter (英文) + 系统中文字体
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
```

### 3.2 更新 font-family

```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display',
               'PingFang SC', 'Noto Sans SC', sans-serif;
}
```

### 3.3 字号体系（微调）

| 用途 | 当前 | 建议 | 说明 |
|---|---|---|---|
| Hero heading | `clamp(2.2rem, 5vw, 4rem)` | `clamp(2.5rem, 5.5vw, 4.5rem)` | 更大气 |
| Section title | `clamp(1.8rem, 3.5vw, 2.5rem)` | `clamp(1.75rem, 3.2vw, 2.25rem)` | 略收敛 |
| Body | 16px / 1.6 | 16px / 1.7 | 增加可读性 |
| Nav links | 13px | 14px | 略放大，提升可点击性 |
| Card title | 18px | 20px | 更清晰 |
| Badge / Label | 11px | 12px | 最小可读尺寸 |

---

## 4. Header 优化

### 4.1 Logo 重做

```tsx
// Header.tsx - Logo 改为 gold 渐变
const logoStyle = {
  background: 'linear-gradient(135deg, #D9B656, #B89A3F)',
  // ... 其余不变
}
```

### 4.2 导航交互增强

```css
.header-nav-link {
  font-size: 14px;              /* 13px → 14px */
  padding: 6px 12px;           /* 增加点击区域 */
  border-radius: 8px;          /* 加圆角 */
  transition: all var(--motion-fast) var(--ease-out-quart);
}
.header-nav-link:hover {
  background: rgba(217,182,86,0.08);  /* gold 悬停底色 */
  color: var(--gold);
}
.header-nav-link.active {
  background: rgba(217,182,86,0.14);
  color: var(--gold);
}
```

### 4.3 滚动毛玻璃效果增强

```css
.header.scrolled {
  background: rgba(6,9,15,0.82);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  border-bottom: 1px solid var(--border-subtle);
}
```

---

## 5. Footer 优化

### 5.1 Logo 同步 gold 渐变

同 Header，将 `#6366f1 → #7c3aed` 替换为 `#D9B656 → #B89A3F`。

### 5.2 增加品牌色条

```css
.footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
  opacity: 0.5;
}
```

### 5.3 链接 hover 统一

```css
.footer a:hover {
  color: var(--gold);
  transition: color var(--motion-fast) var(--ease-out-quart);
}
```

---

## 6. 首页 Hero 重做

### 6.1 Hero 背景

```css
.hero-section {
  position: relative;
  min-height: 85vh;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.hero-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 20% 40%, rgba(217,182,86,0.08), transparent),
    radial-gradient(ellipse 60% 50% at 80% 60%, rgba(103,232,249,0.05), transparent);
}
```

### 6.2 Hero 标题渐变

```css
.hero-title {
  background: linear-gradient(135deg, #E8EDF5 0%, #D9B656 50%, #67E8F9 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### 6.3 Hero CTA 按钮

主按钮用 `btn-accent`（gold），次按钮用 `btn-secondary`，保持当前逻辑。

---

## 7. 卡片系统统一

### 7.1 Glass Card 增强

```css
.glass-card {
  background: rgba(255,255,255,0.025);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-panel);
  transition: all var(--motion-state) var(--ease-out-quint);
}
.glass-card:hover {
  border-color: var(--border-hover);
  transform: translateY(-3px);
  box-shadow:
    0 12px 40px rgba(0,0,0,0.35),
    0 0 0 1px rgba(217,182,86,0.08);  /* 微妙金色光晕 */
}
```

### 7.2 统计卡片

```css
.stat-card {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-panel);
  padding: 28px 24px;
  text-align: center;
}
.stat-card .stat-number {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  color: var(--gold);
  line-height: 1.1;
}
.stat-card .stat-label {
  font-size: 13px;
  color: var(--text-2);
  margin-top: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

---

## 8. 移动端优化

### 8.1 触摸目标尺寸

所有可点击元素最小 44×44px：

```css
@media (pointer: coarse) {
  .header-nav-link,
  .btn-primary,
  .btn-secondary,
  .btn-accent {
    min-height: 44px;
  }
}
```

### 8.2 移动端 Header

```css
@media (max-width: 1023px) {
  .header {
    padding: 0 16px;
  }
  .mobile-menu {
    padding: 80px 20px 24px;
  }
  .mobile-nav-link {
    font-size: 18px;
    padding: 14px 0;
    border-bottom: 1px solid var(--border-subtle);
  }
}
```

### 8.3 首页移动端间距

```css
@media (max-width: 768px) {
  .hero-section {
    min-height: 70vh;
    padding: 0 20px;
  }
  .section-padding {
    padding: 48px 16px;
  }
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
}
```

---

## 9. 全局微动效

### 9.1 滚动渐入（已有，确认统一）

确保所有 `FadeIn` / `AnimateIn` 使用一致的 token：

```css
.fade-in {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity var(--motion-enter) var(--ease-out-expo),
              transform var(--motion-enter) var(--ease-out-expo);
}
.fade-in.visible {
  opacity: 1;
  transform: translateY(0);
}
```

### 9.2 减少动画偏好

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. globals.css 拆分建议

建议将 1950 行的 `globals.css` 拆分为：

```
frontend/src/app/globals.css          ← 仅 @import + :root tokens + 基础 reset
frontend/src/styles/
  ├── buttons.css                      ← .btn-* 系列
  ├── cards.css                        ← .glass-card, .profile-card 等
  ├── forms.css                        ← .form-input, .hk-input 等
  ├── navigation.css                   ← .header-nav-link, .mobile-nav-link
  ├── admin.css                        ← .admin-shell 系列
  ├── studio.css                       ← .hk-studio 系列
  ├── blocks.css                       ← .hk-block__* 系列
  ├── animations.css                   ← @keyframes, .fade-in
  └── utilities.css                    ← .public-main, scrollbar, selection
```

然后在 `globals.css` 中：
```css
@import "tailwindcss";
@import "./styles/buttons.css";
@import "./styles/cards.css";
/* ... */
```

---

## 11. 执行清单（给 Codex）

按优先级排序，建议逐项 commit：

### P0 — 颜色统一（必须）
- [ ] 更新 `globals.css` 的 `:root` tokens 到新色值
- [ ] 更新 `@theme inline` 块匹配新 tokens
- [ ] 搜索替换所有 `#6366f1` / `#7c3aed` / `#818cf8` 为 gold/cyan 变体
- [ ] 搜索替换所有 `rgba(99,102,241,...)` 为 `rgba(217,182,86,...)`
- [ ] 更新 `DESIGN.md` 与实际一致

### P1 — Header / Footer（高优先）
- [ ] Header logo 渐变改为 gold
- [ ] Footer logo 渐变改为 gold
- [ ] 导航 hover/active 状态使用 gold
- [ ] Footer 顶部增加金色渐变色条

### P2 — 首页 Hero（高优先）
- [ ] Hero 背景改用 gold/cyan 微光渐变
- [ ] Hero 标题使用三色渐变文字
- [ ] 确认 CTA 按钮层次

### P3 — 字体升级（中优先）
- [ ] 引入 Inter 字体（Google Fonts）
- [ ] 更新 body font-family
- [ ] 微调字号体系（见 §3.3）

### P4 — 移动端（中优先）
- [ ] 触摸目标 44px 最小尺寸
- [ ] 移动端 Header/Menu 间距优化
- [ ] 首页移动端布局检查

### P5 — CSS 拆分（低优先，可后续）
- [ ] 拆分 globals.css 到 styles/ 目录
- [ ] 验证所有 import 路径正确

---

## 12. 不要动的部分

- **Admin 浅色主题逻辑**：`.admin-shell` 的 token 覆盖机制保持不变，只更新色值
- **Studio canvas 暗色预览**：`.admin-shell .hk-canvas` 的反转逻辑不变
- **双语系统**：`t(zh, en)` 逻辑不动
- **Block Renderer**：CMS 块渲染逻辑不动
- **API 层 / 后端**：完全不动
