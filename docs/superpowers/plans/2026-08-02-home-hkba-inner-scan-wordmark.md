# 首页 HKBA 内部光带扫描字标 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将首页 Hero 的 `HKBA` 标题升级为固定字形、内部光带与扫描纹理同步下移的科技字标。

**Architecture:** 新建一个专用 `HeroScanWordmark` 展示组件，保持唯一可访问标题，并用纯数据模块描述复制层与 3.4 秒周期。CSS 使用一个共享的 `--scan-y` 自定义属性同时驱动扫描线、内部亮度和纹理位置，减少动态效果模式固定在静态中间状态。

**Tech Stack:** Next.js 16、React 19、TypeScript、CSS 自定义属性与关键帧、`next/font/google`、Node.js 内置测试运行器。

## Global Constraints

- `HKBA` 字形轮廓全程固定，不扭曲、不抖动、不切割。
- 扫描线是字内亮度和横向纹理的唯一位置时间轴。
- 单次扫描周期固定为 3400ms，并持续循环。
- 只使用现有蓝色与青色品牌体系。
- `prefers-reduced-motion: reduce` 下停止循环并固定在 52% 高度。
- 页面只暴露一个可访问的 `HKBA` 标题，所有装饰复制层均隐藏。
- 不改变英文副标题、行动按钮、统计数据或 Hero 信息结构。

---

## File Structure

- Create `frontend/src/lib/heroWordmark.mjs`: 定义字标层、周期和可访问性契约。
- Create `frontend/src/lib/heroWordmark.test.mjs`: 验证唯一可访问文本层、装饰层隐藏和周期。
- Create `frontend/src/components/home/HeroScanWordmark.tsx`: 渲染语义化 `h1` 与装饰层。
- Modify `frontend/src/components/home/HomeMockupSections.tsx`: 用新组件替换原始标题。
- Modify `frontend/src/app/layout.tsx`: 通过 `next/font/google` 自托管 Oxanium 并暴露 CSS 变量。
- Modify `frontend/src/styles/webgl.css`: 实现固定字形、内部光带、纹理、扫描线和响应式降级。

### Task 1: 字标语义结构与展示组件

**Files:**
- Create: `frontend/src/lib/heroWordmark.mjs`
- Create: `frontend/src/lib/heroWordmark.test.mjs`
- Create: `frontend/src/components/home/HeroScanWordmark.tsx`
- Modify: `frontend/src/components/home/HomeMockupSections.tsx:68-74`

**Interfaces:**
- Produces: `heroWordmarkPresentation(text?: string): { cycleMs: number; layers: Array<{ kind: 'base' | 'light' | 'texture'; className: string; text: string; ariaHidden: boolean }> }`
- Produces: `HeroScanWordmark({ text?: string }): JSX.Element`
- Consumes: no earlier task interfaces.

- [ ] **Step 1: Write the failing presentation-contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { heroWordmarkPresentation } from './heroWordmark.mjs';

test('hero wordmark exposes one accessible label and hides decorative scan layers', () => {
  const presentation = heroWordmarkPresentation('HKBA');
  assert.equal(presentation.cycleMs, 3400);
  assert.deepEqual(presentation.layers, [
    { kind: 'base', className: 'hero-wordmark__base', text: 'HKBA', ariaHidden: false },
    { kind: 'light', className: 'hero-wordmark__light', text: 'HKBA', ariaHidden: true },
    { kind: 'texture', className: 'hero-wordmark__texture', text: 'HKBA', ariaHidden: true },
  ]);
  assert.equal(presentation.layers.filter((layer) => !layer.ariaHidden).length, 1);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd frontend && node --test src/lib/heroWordmark.test.mjs`

Expected: FAIL because `heroWordmark.mjs` does not exist.

- [ ] **Step 3: Implement the minimal presentation contract**

```js
const CYCLE_MS = 3400;

export function heroWordmarkPresentation(text = 'HKBA') {
  return {
    cycleMs: CYCLE_MS,
    layers: [
      { kind: 'base', className: 'hero-wordmark__base', text, ariaHidden: false },
      { kind: 'light', className: 'hero-wordmark__light', text, ariaHidden: true },
      { kind: 'texture', className: 'hero-wordmark__texture', text, ariaHidden: true },
    ],
  };
}
```

- [ ] **Step 4: Implement the semantic wordmark component**

```tsx
import type { CSSProperties } from 'react';
import { heroWordmarkPresentation } from '@/lib/heroWordmark.mjs';

type HeroScanWordmarkProps = { text?: string };

export default function HeroScanWordmark({ text = 'HKBA' }: HeroScanWordmarkProps) {
  const presentation = heroWordmarkPresentation(text);
  const style = { '--hero-scan-duration': `${presentation.cycleMs}ms` } as CSSProperties;

  return (
    <h1 className="hero-title hero-wordmark" style={style}>
      {presentation.layers.map((layer) => (
        <span
          key={layer.kind}
          className={layer.className}
          aria-hidden={layer.ariaHidden || undefined}
        >
          {layer.text}
        </span>
      ))}
      <span className="hero-wordmark__beam" aria-hidden="true" />
    </h1>
  );
}
```

- [ ] **Step 5: Replace the existing raw heading**

Add `import HeroScanWordmark from '@/components/home/HeroScanWordmark';` and replace:

```tsx
<h1 className="hero-title">HKBA</h1>
```

with:

```tsx
<HeroScanWordmark />
```

- [ ] **Step 6: Run the focused test and TypeScript build gate**

Run: `cd frontend && node --test src/lib/heroWordmark.test.mjs && npm run build`

Expected: test PASS, TypeScript compilation and production build PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add frontend/src/lib/heroWordmark.mjs frontend/src/lib/heroWordmark.test.mjs frontend/src/components/home/HeroScanWordmark.tsx frontend/src/components/home/HomeMockupSections.tsx
git commit -m "feat: add semantic HKBA scan wordmark"
```

### Task 2: 字体、同步扫描样式与浏览器验收

**Files:**
- Modify: `frontend/src/app/layout.tsx:1-26`
- Modify: `frontend/src/styles/webgl.css:329-353`
- Test: `frontend/src/lib/heroWordmark.test.mjs`

**Interfaces:**
- Consumes: `HeroScanWordmark` DOM classes from Task 1.
- Consumes: `--hero-scan-duration` inline CSS variable set by Task 1.
- Produces: `--font-oxanium` font variable on the root element.

- [ ] **Step 1: Capture the failing browser baseline**

Open `http://localhost:3000/` and verify the current page fails these conditions:

```text
document.querySelectorAll('.hero-wordmark').length === 1
getComputedStyle(document.querySelector('.hero-wordmark')).fontFamily includes "Oxanium"
document.querySelector('.hero-wordmark__beam') exists
```

Expected before implementation: at least the font and synchronized visual scan conditions fail.

- [ ] **Step 2: Configure the optimized Oxanium font**

Update `layout.tsx`:

```tsx
import { Oxanium } from 'next/font/google';

const oxanium = Oxanium({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-oxanium',
});
```

Apply the variable without changing the default body font:

```tsx
<html lang="zh-Hant" data-scroll-behavior="smooth" className={oxanium.variable}>
```

- [ ] **Step 3: Implement one synchronized scan timeline**

Replace the current `.hero .hero-title` gradient rule with a positioned wordmark. Define a registered percentage property and animate it only on the root wordmark:

```css
@property --hero-scan-y {
  syntax: '<percentage>';
  inherits: true;
  initial-value: 4%;
}

.hero .hero-wordmark {
  --hero-scan-y: 4%;
  position: relative;
  display: block;
  width: max-content;
  margin: 0 0 16px;
  overflow: hidden;
  font-family: var(--font-oxanium), 'Arial Narrow', sans-serif;
  font-size: clamp(4rem, 9vw, 7.5rem);
  font-weight: 700;
  letter-spacing: -0.065em;
  line-height: .82;
  animation: heroWordmarkScan var(--hero-scan-duration) linear infinite;
}

.hero-wordmark__base,
.hero-wordmark__light,
.hero-wordmark__texture {
  display: block;
}

.hero-wordmark__base {
  position: relative;
  z-index: 1;
  color: rgba(11, 37, 69, .96);
  -webkit-text-stroke: 2px #bfeaff;
  text-shadow: 0 0 20px rgba(14, 165, 233, .22);
}

.hero-wordmark__light,
.hero-wordmark__texture {
  position: absolute;
  inset: 0;
  color: transparent;
  pointer-events: none;
  -webkit-background-clip: text;
  background-clip: text;
}

.hero-wordmark__light {
  z-index: 2;
  background: linear-gradient(180deg,
    rgba(42, 130, 190, .1) 0%,
    rgba(42, 130, 190, .1) calc(var(--hero-scan-y) - 13%),
    #147eb9 calc(var(--hero-scan-y) - 8%),
    #53d7f4 calc(var(--hero-scan-y) - 3%),
    #e8fcff var(--hero-scan-y),
    #4fd3f1 calc(var(--hero-scan-y) + 4%),
    #126ca3 calc(var(--hero-scan-y) + 9%),
    rgba(42, 130, 190, .08) calc(var(--hero-scan-y) + 14%),
    rgba(42, 130, 190, .08) 100%);
  filter: drop-shadow(0 0 7px rgba(56, 189, 248, .5));
}

.hero-wordmark__texture {
  z-index: 3;
  opacity: .62;
  background:
    repeating-linear-gradient(180deg, transparent 0 2px, rgba(219, 249, 255, .5) 2px 3px, transparent 3px 6px),
    linear-gradient(180deg, transparent calc(var(--hero-scan-y) - 9%), #d7f9ff calc(var(--hero-scan-y) - 2%), #35c8ed calc(var(--hero-scan-y) + 7%), transparent calc(var(--hero-scan-y) + 11%));
  background-blend-mode: screen;
  mask-image: linear-gradient(180deg, transparent calc(var(--hero-scan-y) - 10%), #000 calc(var(--hero-scan-y) - 6%), #000 calc(var(--hero-scan-y) + 9%), transparent calc(var(--hero-scan-y) + 13%));
}

.hero-wordmark__beam {
  position: absolute;
  z-index: 4;
  top: var(--hero-scan-y);
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(224, 251, 255, .9) 15%, #38bdf8 78%, transparent);
  box-shadow: 0 0 6px #38bdf8, 0 0 14px rgba(56, 189, 248, .6);
  pointer-events: none;
}

@keyframes heroWordmarkScan {
  from { --hero-scan-y: 4%; }
  to { --hero-scan-y: 96%; }
}

.hero .hero-subtitle {
  font-family: var(--font-oxanium), 'Arial Narrow', sans-serif;
}
```

- [ ] **Step 4: Add reduced-motion and mobile rules**

```css
@media (prefers-reduced-motion: reduce) {
  .hero .hero-wordmark {
    --hero-scan-y: 52%;
    animation: none;
  }
}

@media (max-width: 600px) {
  .hero .hero-wordmark {
    max-width: 100%;
    font-size: clamp(3.4rem, 19vw, 5rem);
  }
}
```

- [ ] **Step 5: Run automated verification**

Run:

```bash
cd frontend
node --test src/lib/heroWordmark.test.mjs src/lib/partnerCarousel.test.mjs
npm run build
```

Expected: all focused tests PASS and the production build exits 0.

- [ ] **Step 6: Verify the actual browser behavior**

In Chrome at `http://localhost:3000/` verify:

1. `.hero-wordmark` has exactly one accessible `HKBA` label.
2. `--hero-scan-y` progresses from approximately 4% to 96% over 3.4 seconds.
3. `.hero-wordmark__beam` top position matches the brightest region of `.hero-wordmark__light` throughout the cycle.
4. The bounding box of `.hero-wordmark__base` is unchanged at the top, middle and bottom of the scan.
5. Hovering does not pause the scan.
6. At a mobile viewport the title is not clipped or horizontally overflowing.
7. With reduced motion emulation, the scan remains static at 52%.

- [ ] **Step 7: Commit Task 2**

```bash
git add frontend/src/app/layout.tsx frontend/src/styles/webgl.css frontend/src/lib/heroWordmark.test.mjs
git commit -m "feat: animate HKBA inner light scan"
```
