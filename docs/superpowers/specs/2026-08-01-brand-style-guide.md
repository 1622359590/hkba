# HKBA 全站视觉风格系统 — Brand Style Guide

> **目标：** 建立统一的区块链协会高端科技视觉语言，覆盖全站所有页面
> **日期：** 2026-08-01

---

## 1. 设计原则

| 原则 | 说明 |
|---|---|
| **深邃** | 以深色为主，营造专业、可信的氛围 |
| **发光** | 关键元素有微光/辉光效果，体现科技感 |
| **克制** | 光效点到为止，不花哨，保持机构气质 |
| **层次** | 通过表面层级（surface levels）创造深度 |
| **流动** | 微妙的动效让页面"活"起来，但不干扰阅读 |

---

## 2. 色彩系统

### 2.1 主色板

```
┌─────────────────────────────────────────────────────────┐
│  主强调色 GOLD        #D9B656    ████  信任 / 价值 / 权威  │
│  辅强调色 CYAN        #67E8F9    ████  科技 / 交互 / 信息  │
│  成功色   GREEN       #34D399    ████  成功 / 在线          │
│  警告色   AMBER       #FBBF24    ████  警告 / 提醒          │
│  错误色   RED         #F87171    ████  错误 / 危险          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 背景层级（从深到浅）

| 层级 | Token | 色值 | 用途 |
|---|---|---|---|
| L0 基底 | `--bg` | `#06090F` | 页面最底层背景 |
| L1 表面 | `--surface-1` | `#0B1120` | 卡片、面板、容器 |
| L2 悬浮 | `--surface-2` | `#101828` | 弹出层、下拉菜单、Modal |
| L3 交互 | `--surface-3` | `#162032` | Hover 状态、选中态 |

### 2.3 文字层级

| 层级 | Token | 色值 | 用途 |
|---|---|---|---|
| 主文字 | `--text-1` | `#E8EDF5` | 标题、正文 |
| 次文字 | `--text-2` | `#8896A8` | 描述、副标题 |
| 弱化文字 | `--text-3` | `#5A6B7F` | 标签、时间戳、禁用态 |

### 2.4 特殊效果色

| 名称 | 色值 | 用途 |
|---|---|---|
| Gold Glow | `rgba(217,182,86,0.28)` | 金色发光阴影 |
| Cyan Glow | `rgba(103,232,249,0.20)` | 青色发光阴影 |
| Border Subtle | `rgba(255,255,255,0.08)` | 默认边框 |
| Border Hover | `rgba(255,255,255,0.15)` | Hover 边框 |
| Overlay Dark | `rgba(6,9,15,0.85)` | 深色遮罩层 |

---

## 3. 字体系统

### 3.1 字体栈

```css
/* 标题字体 */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;

/* 正文字体（同上，中文回退到 PingFang SC） */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', sans-serif;
```

### 3.2 字号体系

| 名称 | 大小 | 行高 | 字重 | 用途 |
|---|---|---|---|---|
| Display | `clamp(3rem, 7vw, 5.5rem)` | 1.05 | 900 | Hero 主标题 |
| H1 | `clamp(2rem, 4vw, 3rem)` | 1.15 | 800 | 页面主标题 |
| H2 | `clamp(1.5rem, 3vw, 2.25rem)` | 1.2 | 700 | Section 标题 |
| H3 | `clamp(1.125rem, 2vw, 1.5rem)` | 1.35 | 650 | 卡片标题 |
| Body Large | `18px` | 1.75 | 400 | Hero 描述、重要正文 |
| Body | `16px` | 1.7 | 400 | 正文 |
| Body Small | `14px` | 1.6 | 400 | 次要内容 |
| Caption | `12px` | 1.5 | 600 | 标签、徽章、时间戳 |
| Overline | `11px` | 1.4 | 700 | 全大写标签、分类 |

### 3.3 字间距

| 场景 | letter-spacing |
|---|---|
| Display / Hero | `-0.03em` |
| H1-H3 | `-0.01em` |
| Body | `0` |
| Uppercase labels | `0.08em` |
| Button text | `0.02em` |

---

## 4. 间距系统

基于 **8px 网格**：

| Token | 值 | 用途 |
|---|---|---|
| `--space-1` | `4px` | 紧凑间距 |
| `--space-2` | `8px` | 小间距 |
| `--space-3` | `12px` | 元素内间距 |
| `--space-4` | `16px` | 卡片内 padding |
| `--space-5` | `20px` | 区块内间距 |
| `--space-6` | `24px` | 卡片 padding |
| `--space-8` | `32px` | Section 间距 |
| `--space-10` | `40px` | 大区块间距 |
| `--space-12` | `48px` | Section padding |
| `--space-16` | `64px` | 页面级间距 |
| `--space-20` | `80px` | Hero 内间距 |

---

## 5. 圆角系统

| Token | 值 | 用途 |
|---|---|---|
| `--radius-sm` | `6px` | 小元素（输入框、标签） |
| `--radius-md` | `10px` | 按钮、中等卡片 |
| `--radius-lg` | `16px` | 大卡片、面板 |
| `--radius-xl` | `22px` | 容器、Modal |
| `--radius-full` | `999px` | 药丸、头像 |

---

## 6. 阴影系统

| 名称 | 值 | 用途 |
|---|---|---|
| Shadow SM | `0 2px 8px rgba(0,0,0,0.2)` | 小卡片悬浮 |
| Shadow MD | `0 8px 24px rgba(0,0,0,0.3)` | 卡片 hover |
| Shadow LG | `0 16px 48px rgba(0,0,0,0.4)` | 弹出层 |
| Shadow Gold | `0 8px 32px rgba(217,182,86,0.2)` | 金色按钮 hover |
| Shadow Cyan | `0 8px 32px rgba(103,232,249,0.15)` | 青色交互 hover |

---

## 7. 组件规范

### 7.1 按钮

```
┌─────────────────────────────────────────────────┐
│  Primary (Gold)                                 │
│  背景: linear-gradient(135deg, #D9B656, #B89A3F)│
│  文字: #06090F (深色)                             │
│  圆角: 10px                                      │
│  内距: 12px 24px                                  │
│  字号: 14px / 600                                 │
│  Hover: translateY(-1px) + 金色辉光阴影           │
├─────────────────────────────────────────────────┤
│  Secondary (Outline)                             │
│  背景: transparent                                │
│  边框: 1px solid var(--border-subtle)             │
│  文字: var(--text-1)                              │
│  Hover: border-color 金色 + 微弱金色背景           │
├─────────────────────────────────────────────────┤
│  Ghost (Text)                                    │
│  背景: transparent                                │
│  文字: var(--text-2)                              │
│  Hover: 文字变金色 + 微弱金色背景                  │
└─────────────────────────────────────────────────┘
```

### 7.2 卡片

```
┌─────────────────────────────────────────────────┐
│  Glass Card (默认)                               │
│  背景: rgba(255,255,255,0.025)                   │
│  模糊: backdrop-filter: blur(16px)               │
│  边框: 1px solid var(--border-subtle)            │
│  圆角: 16px                                      │
│  Hover: translateY(-3px) + 金色光晕边框           │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  [图标/头像]                                 │ │
│  │  标题 (H3, #E8EDF5)                         │ │
│  │  描述 (#8896A8, 14px)                       │ │
│  │  ─────────────────────                      │ │
│  │  底部操作区                                  │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 7.3 导航栏

```
┌─────────────────────────────────────────────────┐
│  [Logo]    首页  关于  新闻  活动  ...    [EN] [联系]│
│                                                   │
│  高度: 64px                                       │
│  背景: 透明 → 滚动后 rgba(6,9,15,0.85) + blur    │
│  Logo: 金色渐变方块 + "HKBA"                       │
│  链接: 14px, hover 时金色                          │
│  Active: 金色背景 rgba(217,182,86,0.12)           │
└─────────────────────────────────────────────────┘
```

### 7.4 Section 布局

```
┌─────────────────────────────────────────────────┐
│                                                   │
│  [Overline 标签]  ← 金色小字，全大写               │
│  [Section 标题]   ← H2，白色                     │
│  [Section 描述]   ← 次文字，最大宽度 600px         │
│                                                   │
│  ─────────── 发光分割线 ───────────              │
│                                                   │
│  [内容区]                                         │
│  max-width: 1200px                                │
│  padding: 80px 24px                               │
│                                                   │
└─────────────────────────────────────────────────┘
```

### 7.5 徽章 / 标签

```
┌────────────────────────────────────┐
│  ● 状态标签                        │
│  背景: rgba(217,182,86,0.1)        │
│  边框: 1px solid rgba(金色,0.2)    │
│  文字: 金色                         │
│  圆角: 999px (药丸形)              │
│  字号: 12px / 600                   │
│  左侧有小圆点动画                   │
└────────────────────────────────────┘
```

---

## 8. 页面级布局规范

### 8.1 首页 Hero

```
┌───────────────────────────────────────────────────┐
│  最小高度: 100vh                                   │
│  布局: 左对齐，内容 max-width: 700px               │
│  左侧 padding: max(48px, calc((100vw - 1440px)/2 + 48px)) │
│                                                   │
│  内容从上到下:                                     │
│  1. 品牌徽章 (药丸形，金色边框)                     │
│  2. Display 标题 (三色渐变文字)                     │
│  3. 副标题 (大写，弱化文字)                         │
│  4. 描述段落 (Body Large，次文字)                   │
│  5. CTA 按钮组 (Primary + Secondary)               │
│  6. 统计数字条 (金色数字 + 弱化标签)                │
│                                                   │
│  背景: 深色 + 微妙 radial 渐变光晕                  │
│  或: hero-bg.jpg + 遮罩层                          │
└───────────────────────────────────────────────────┘
```

### 8.2 内容 Section

```
┌───────────────────────────────────────────────────┐
│  padding: 80px 24px (移动端 48px 16px)             │
│  max-width: 1200px, margin: 0 auto                │
│                                                   │
│  标题区:                                           │
│  - Overline 标签 (金色，全大写)                     │
│  - H2 标题 (白色)                                  │
│  - 描述 (次文字，max-width 600px)                   │
│  - 底部 margin: 48px                               │
│                                                   │
│  内容区:                                           │
│  - 卡片网格 (auto-fit, minmax(300px, 1fr))         │
│  - 间距: 24px                                      │
└───────────────────────────────────────────────────┘
```

### 8.3 Footer

```
┌───────────────────────────────────────────────────┐
│  顶部: 1px 渐变金色分割线                           │
│  背景: var(--bg)                                   │
│  padding: 80px 24px 40px                           │
│  max-width: 1200px                                 │
│                                                   │
│  布局: CSS Grid, 3 列                              │
│  - 品牌区 (span 2): Logo + 简介                    │
│  - 快速链接: 列表，hover 变金色                     │
│  - 联系方式: 图标 + 文字                            │
│                                                   │
│  底部: 版权 + 管理员入口                            │
│  分割线: 1px solid var(--border-subtle)            │
└───────────────────────────────────────────────────┘
```

---

## 9. 动效规范

### 9.1 时长

| Token | 值 | 用途 |
|---|---|---|
| `--motion-fast` | `140ms` | Hover 状态切换 |
| `--motion-normal` | `240ms` | 普通过渡 |
| `--motion-slow` | `400ms` | 入场动画 |
| `--motion-enter` | `600ms` | 页面/大区块入场 |

### 9.2 缓动函数

| Token | 值 | 用途 |
|---|---|---|
| `--ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` | 按钮、卡片交互 |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | 入场动画、滚动 |

### 9.3 动效规则

- **入场:** 所有区块使用 `translateY(16px) → 0` + `opacity 0 → 1`，延迟递增 60ms
- **Hover:** `translateY(-2px ~ -4px)` + 阴影增强 + 边框变亮
- **Active:** `translateY(1px) scale(0.98)` 点击回弹
- **禁止:** 旋转、缩放弹跳、闪烁等装饰性动效

### 9.4 入场动画 CSS

```css
/* 滚动渐入 - 统一使用 */
.fade-in-up {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity var(--motion-enter) var(--ease-out-expo),
              transform var(--motion-enter) var(--ease-out-expo);
}
.fade-in-up.visible {
  opacity: 1;
  transform: translateY(0);
}

/* 递增延迟 */
.section:nth-child(1) .fade-in-up { transition-delay: 0ms; }
.section:nth-child(2) .fade-in-up { transition-delay: 80ms; }
.section:nth-child(3) .fade-in-up { transition-delay: 140ms; }
.section:nth-child(n+4) .fade-in-up { transition-delay: 200ms; }
```

---

## 10. 发光效果规范

### 10.1 金色辉光

```css
/* 按钮/重要元素 hover */
box-shadow: 0 8px 32px rgba(217,182,86,0.25);

/* 卡片 hover 边框光晕 */
box-shadow: 0 0 0 1px rgba(217,182,86,0.1), 0 12px 40px rgba(0,0,0,0.3);

/* 标签/徽章 */
box-shadow: 0 0 12px rgba(217,182,86,0.15);
```

### 10.2 青色辉光

```css
/* 链接/交互元素 focus */
outline: 2px solid var(--cyan);
outline-offset: 3px;

/* 信息提示 */
box-shadow: 0 0 16px rgba(103,232,249,0.15);
```

### 10.3 发光分割线

```css
.section-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold) 30%, var(--cyan) 50%, var(--gold) 70%, transparent);
  opacity: 0.25;
}
```

---

## 11. 响应式断点

| 断点 | 宽度 | 调整 |
|---|---|---|
| Mobile | `< 640px` | 单列布局，Hero 缩小，padding 减半 |
| Tablet | `640px - 1024px` | 两列网格，导航折叠 |
| Desktop | `1024px - 1440px` | 完整布局 |
| Wide | `> 1440px` | 内容居中，两侧留白 |

---

## 12. 实施清单 (给 Codex)

```bash
1. 安装 Inter 字体 (Google Fonts CDN)
2. 更新 :root tokens 为本规范 §2 定义的完整色值
3. 添加 spacing/radius/shadow tokens 到 :root
4. 更新所有按钮样式 (§7.1)
5. 更新所有卡片样式 (§7.2)
6. 统一导航栏样式 (§7.3)
7. 统一 Section 布局 (§7.4, §8.2)
8. 统一 Footer 样式 (§8.3)
9. 添加入场动画 CSS (§9.4)
10. 添加发光效果 CSS (§10)
11. 检查所有页面响应式表现
```
