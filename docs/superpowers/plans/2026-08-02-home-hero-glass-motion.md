# Home Hero Glass Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the homepage hero content into a restrained glass panel with coordinated entrance, highlight, and statistic-count animations.

**Architecture:** Keep the existing `HomeHero` markup and homepage image. Add one focused `AnimatedStat` client component, expose pointer highlight coordinates through CSS custom properties, and extend the existing hero CSS/animation modules without changing public content or admin preview contracts.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS modules imported through `globals.css`, Vitest-free Node tests where pure helpers are used.

## Global Constraints

- Modify only the public homepage hero and its directly owned styles/components.
- Do not add WebGL or animation dependencies.
- Preserve 44px touch targets and `prefers-reduced-motion` behavior.
- Do not alter admin shell, studio canvas, block renderer contracts, API, or backend code.

---

### Task 1: Statistic Animation Helper

**Files:**
- Create: `frontend/src/components/home/AnimatedStat.tsx`
- Create: `frontend/src/lib/animatedStat.mjs`
- Test: `frontend/src/lib/animatedStat.test.mjs`

**Interfaces:**
- Produces: `parseAnimatedStat(value: string): { target: number; suffix: string; decimals: number }`
- Produces: `AnimatedStat({ value, duration?, className? })`

- [ ] **Step 1: Write the failing parser tests**

```js
assert.deepEqual(parseAnimatedStat('200+'), { target: 200, suffix: '+', decimals: 0 });
assert.deepEqual(parseAnimatedStat('1.8K+'), { target: 1.8, suffix: 'K+', decimals: 1 });
assert.deepEqual(parseAnimatedStat('5+'), { target: 5, suffix: '+', decimals: 0 });
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test frontend/src/lib/animatedStat.test.mjs`
Expected: FAIL because `animatedStat.mjs` does not exist.

- [ ] **Step 3: Implement parser and counter**

Use `requestAnimationFrame`, an ease-out cubic curve, and an `IntersectionObserver` that starts once. When reduced motion is active, render the final value without scheduling frames.

- [ ] **Step 4: Run the focused test**

Run: `node --test frontend/src/lib/animatedStat.test.mjs`
Expected: PASS.

### Task 2: Glass Hero Interaction And Styling

**Files:**
- Modify: `frontend/src/components/home/HomeMockupSections.tsx`
- Modify: `frontend/src/styles/webgl.css`
- Modify: `frontend/src/styles/animations.css`

**Interfaces:**
- Consumes: `AnimatedStat` from Task 1.
- Produces: `.hero-glass`, `.hero-glass__content`, and pointer variables `--glass-x` / `--glass-y`.

- [ ] **Step 1: Wrap hero content in the owned glass surface**

Keep the existing heading, subtitle, actions, and statistics semantics. Add a pointer handler that maps the pointer position within the panel to percentage custom properties; reset to the center on pointer leave.

- [ ] **Step 2: Replace static statistic values**

Render `200+`, `50+`, and `5+` through `AnimatedStat` while retaining the existing `.hero-stat-number` class.

- [ ] **Step 3: Add the restrained glass visual system**

Use a translucent navy fill, `backdrop-filter: blur(22px) saturate(125%)`, one-pixel cyan-blue border, restrained shadows, a fine grid pseudo-element, pointer-following radial highlight, and a contained low-opacity scan line. Keep the hero image visible on the right.

- [ ] **Step 4: Coordinate the entrance sequence**

Animate the panel first, followed by title, subtitle, divider, actions, and statistics. Use only opacity and transform for moving elements. Ensure reduced motion renders everything at its final state.

- [ ] **Step 5: Add tablet and mobile rules**

Reduce panel blur and padding below 900px. At 640px, make actions full width, remove scanning/pointer highlights, and use a three-column statistic row that does not overflow.

### Task 3: Regression And Visual Verification

**Files:**
- Verify: `frontend/src/components/home/HomeMockupSections.tsx`
- Verify: `frontend/src/styles/webgl.css`
- Verify: `frontend/src/styles/animations.css`

- [ ] **Step 1: Run parser tests**

Run: `node --test frontend/src/lib/animatedStat.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run the frontend production build**

Run: `npm run build` from `frontend/`.
Expected: compilation, TypeScript, and route generation pass.

- [ ] **Step 3: Inspect the homepage at 1280px, 768px, and 375px**

Confirm no horizontal overflow, clipped copy, header overlap, layout shift, or inaccessible controls. Confirm the desktop panel is translucent and the right-side image remains inspectable.

- [ ] **Step 4: Verify reduced motion**

Confirm the scan and pointer effects are removed, statistics show final values, and all hero content is visible immediately.
