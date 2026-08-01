# Partner White Marquee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present CMS-managed partner logos inside one content-width white marquee whose continuous autoplay is easy to perceive while preserving drag, hover pause, links, accessibility, and reduced-motion behavior.

**Architecture:** Keep the existing `PartnerCarousel` client component and unified association data flow because browser measurement proves its `scrollLeft` loop advances correctly. Increase only the deliberately slow speed to a still-calm but visible rate, then scope a shared white-strip treatment to `.hk-partner-carousel` so individual grey tiles disappear without changing the grid or cards variants.

**Tech Stack:** Next.js 16.2, React 19, TypeScript, native CSS, Node `node:test`; no new dependencies.

## Global Constraints

- Keep the marquee aligned to the existing public-page content width.
- Use one soft-white strip with the existing 12px radius and no heavy shadow.
- Remove individual grey backgrounds, borders, and nested frames inside the carousel variant only.
- Preserve CMS autoplay, speed, direction, and pause-on-hover settings.
- Preserve partner order, links, source logos, fallback initials, alt text, pointer dragging, keyboard focus, and reduced-motion behavior.
- Do not change association data, routes, page structure, grid variants, or the detailed cards variant.
- Do not add a third-party carousel or animation dependency.

---

## File Structure

- Modify `frontend/src/lib/partnerCarousel.mjs`: raise the `slow` speed from 18 to 28 pixels per second so movement remains calm but perceptible.
- Modify `frontend/src/lib/partnerCarousel.test.mjs`: lock the new speed contract before implementation.
- Create `frontend/src/lib/partnerMarqueePresentation.test.mjs`: protect the shared-strip CSS contract from regressing to individual cards.
- Modify `frontend/src/styles/blocks.css`: add the white marquee surface and remove carousel-only tile chrome.

---

### Task 1: Make slow autoplay visibly perceptible

**Files:**
- Modify: `frontend/src/lib/partnerCarousel.mjs:1`
- Test: `frontend/src/lib/partnerCarousel.test.mjs:31-35`

**Interfaces:**
- Consumes: `partnerCarouselPixelsPerSecond(speed)` with `speed` equal to `slow`, `normal`, or `fast`.
- Produces: the existing numeric pixels-per-second return value, with `slow` equal to `28`, `normal` equal to `30`, and `fast` equal to `46`.

- [ ] **Step 1: Change the speed expectation first**

Update the existing test to require the new slow rate:

```js
test('partner carousel speeds remain deliberately slow', () => {
  assert.equal(partnerCarouselPixelsPerSecond('slow'), 28);
  assert.equal(partnerCarouselPixelsPerSecond('normal'), 30);
  assert.equal(partnerCarouselPixelsPerSecond('fast'), 46);
});
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run: `cd frontend && node --test src/lib/partnerCarousel.test.mjs`

Expected: FAIL because the current slow value is `18`.

- [ ] **Step 3: Implement the minimal speed change**

Change the speed map in `frontend/src/lib/partnerCarousel.mjs` to:

```js
const SPEEDS = Object.freeze({ slow: 28, normal: 30, fast: 46 });
```

- [ ] **Step 4: Run the focused test and verify the green state**

Run: `cd frontend && node --test src/lib/partnerCarousel.test.mjs`

Expected: all partner carousel tests PASS.

---

### Task 2: Replace individual carousel cards with one white strip

**Files:**
- Create: `frontend/src/lib/partnerMarqueePresentation.test.mjs`
- Modify: `frontend/src/styles/blocks.css:190-225`

**Interfaces:**
- Consumes: the existing `.hk-partner-carousel`, `.partner-carousel__viewport`, `.partner-carousel__item`, `.hk-partner__tile`, and `.hk-partner__initial` class structure.
- Produces: a content-width `#f7f8fa` marquee with 12px radius, white edge fades, transparent carousel items, and unchanged partner links.

- [ ] **Step 1: Add a failing CSS contract test**

Create `frontend/src/lib/partnerMarqueePresentation.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/blocks.css', import.meta.url), 'utf8');

test('partner carousel uses one shared white strip instead of grey item cards', () => {
  const stripRule = css.match(/\.hk-partner-carousel\s*\{([^}]*)\}/s)?.[1] || '';
  assert.match(stripRule, /background:\s*#f7f8fa;/);
  assert.match(stripRule, /border-radius:\s*12px;/);
  assert.match(css, /\.hk-partner-carousel \.hk-partner__tile\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/s);
  assert.match(css, /\.hk-partner-carousel::before[\s\S]*#f7f8fa/);
});
```

- [ ] **Step 2: Run the presentation test and verify the red state**

Run: `cd frontend && node --test src/lib/partnerMarqueePresentation.test.mjs`

Expected: FAIL because `.hk-partner-carousel` does not yet provide the white strip contract.

- [ ] **Step 3: Add the shared white-strip styles**

Add the following scoped rules near the existing association partner styles in `frontend/src/styles/blocks.css`:

```css
.hk-partner-carousel {
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.72);
  border-radius: 12px;
  background: #f7f8fa;
}

.hk-partner-carousel::before {
  background: linear-gradient(90deg, #f7f8fa 20%, rgba(247, 248, 250, 0));
}

.hk-partner-carousel::after {
  background: linear-gradient(270deg, #f7f8fa 20%, rgba(247, 248, 250, 0));
}

.hk-partner-carousel .partner-carousel__viewport {
  padding-block: 12px;
}

.hk-partner-carousel .hk-partner__tile {
  height: 72px;
  padding: 14px 24px;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.hk-partner-carousel .hk-partner:hover .hk-partner__tile {
  border-color: transparent;
  background: transparent;
}

.hk-partner-carousel .hk-partner__initial {
  color: #334155;
}

@media (max-width: 640px) {
  .hk-partner-carousel .partner-carousel__viewport {
    padding-block: 8px;
  }

  .hk-partner-carousel .hk-partner__tile {
    height: 64px;
    padding-inline: 18px;
  }
}
```

Keep `.hk-partner-carousel .partner-carousel__item { flex-basis: 170px; }` and the existing component behavior unchanged.

- [ ] **Step 4: Run both focused test files**

Run: `cd frontend && node --test src/lib/partnerCarousel.test.mjs src/lib/partnerMarqueePresentation.test.mjs`

Expected: all tests PASS.

---

### Task 3: Verify the real public page behavior

**Files:**
- Verify: `frontend/src/components/ui/PartnerCarousel.tsx`
- Verify: `frontend/src/components/blocks/BlockRenderer.tsx`
- Verify: `frontend/src/styles/blocks.css`

**Interfaces:**
- Consumes: the running frontend at `http://localhost:3000/` and published `association.partners` block data.
- Produces: measured proof that autoplay moves, hover pauses, pointer drag changes the position, and the white strip renders without item cards.

- [ ] **Step 1: Run TypeScript and focused tests**

Run: `cd frontend && node --test src/lib/partnerCarousel.test.mjs src/lib/partnerMarqueePresentation.test.mjs && npx tsc --noEmit --allowImportingTsExtensions`

Expected: tests PASS and TypeScript exits with code 0.

- [ ] **Step 2: Measure autoplay in the browser**

Open `http://localhost:3000/`, move the pointer outside the carousel, capture `.partner-carousel__viewport.scrollLeft`, wait 1200ms, and capture it again.

Expected: `.hk-partner-carousel` exists, its computed background is `rgb(247, 248, 250)`, individual `.hk-partner__tile` backgrounds are transparent, and the second `scrollLeft` is greater than the first.

- [ ] **Step 3: Verify hover pause and manual drag**

Move the pointer over `.hk-partner-carousel`, compare `scrollLeft` across 900ms, then drag the viewport horizontally by at least 80px.

Expected: hover delta is at most 1px; drag changes `scrollLeft`; autoplay resumes after the existing 1200ms manual-interaction delay when the pointer leaves.

- [ ] **Step 4: Check responsive presentation**

Inspect at desktop width and at 390px width.

Expected: the white strip stays within the content container, retains its radius, shows no horizontal page overflow, keeps logos legible, and preserves visible keyboard focus.

- [ ] **Step 5: Review the scoped diff**

Run:

```bash
git diff -- frontend/src/lib/partnerCarousel.mjs \
  frontend/src/lib/partnerCarousel.test.mjs \
  frontend/src/lib/partnerMarqueePresentation.test.mjs \
  frontend/src/styles/blocks.css
```

Expected: only the approved speed adjustment, white-strip presentation, and focused tests are changed.

---

### Task 4: Prevent pointer focus from blocking autoplay resume

**Files:**
- Modify: `frontend/src/lib/partnerCarousel.mjs`
- Test: `frontend/src/lib/partnerCarousel.test.mjs`
- Modify: `frontend/src/components/ui/PartnerCarousel.tsx`

**Interfaces:**
- Consumes: whether the focused element matches `:focus-visible` and whether a pointer interaction is active.
- Produces: `shouldPartnerCarouselPauseForFocus({ focusVisible, pointerActive }): boolean`, returning `true` only for keyboard-visible focus that was not caused by the active pointer interaction.

- [ ] **Step 1: Add the failing focus-modality test**

Import `shouldPartnerCarouselPauseForFocus` and add:

```js
test('pointer focus does not keep autoplay paused after dragging', () => {
  assert.equal(shouldPartnerCarouselPauseForFocus({ focusVisible: true, pointerActive: false }), true);
  assert.equal(shouldPartnerCarouselPauseForFocus({ focusVisible: true, pointerActive: true }), false);
  assert.equal(shouldPartnerCarouselPauseForFocus({ focusVisible: false, pointerActive: false }), false);
});
```

- [ ] **Step 2: Run the test and verify the red state**

Run: `cd frontend && node --test src/lib/partnerCarousel.test.mjs`

Expected: FAIL because `shouldPartnerCarouselPauseForFocus` is not exported.

- [ ] **Step 3: Add the minimal focus-modality helper**

Add to `frontend/src/lib/partnerCarousel.mjs`:

```js
export function shouldPartnerCarouselPauseForFocus({ focusVisible, pointerActive }) {
  return Boolean(focusVisible && !pointerActive);
}
```

- [ ] **Step 4: Use the helper in the focus capture handler**

Import the helper in `PartnerCarousel.tsx`, then replace the unconditional focus pause with:

```tsx
onFocusCapture={(event) => {
  const target = event.target as HTMLElement;
  setFocused(shouldPartnerCarouselPauseForFocus({
    focusVisible: target.matches(':focus-visible'),
    pointerActive: dragRef.current !== null,
  }));
}}
```

Keep the existing blur handler, drag state, manual resume timer, and keyboard focus outline unchanged.

- [ ] **Step 5: Run automated checks**

Run: `cd frontend && node --test src/lib/partnerCarousel.test.mjs src/lib/partnerMarqueePresentation.test.mjs && npx tsc --noEmit --allowImportingTsExtensions`

Expected: 8 tests PASS and TypeScript exits with code 0.

- [ ] **Step 6: Re-run the failed browser scenario**

Drag the real carousel by at least 80px, move the pointer outside, wait 1300ms, then measure `scrollLeft` for another 900ms.

Expected: dragging changes `scrollLeft`, `is-dragging` clears after pointer-up, the viewport may remain `document.activeElement`, and the final 900ms measurement advances because pointer-generated focus no longer blocks autoplay.
