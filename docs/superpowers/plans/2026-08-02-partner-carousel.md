# Partner Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable, admin-configurable partner carousel that auto-scrolls slowly, supports manual dragging, pauses during interaction, and keeps the existing unified partner directory as its only data source.

**Architecture:** A focused client component owns native horizontal scrolling, pointer dragging, pause state, reduced-motion handling, overflow detection, and seamless wrapping. A small pure helper module normalizes registry settings and calculates wrap positions so core behavior is testable with Node's built-in test runner. Both the published block renderer and the legacy About page adapt their existing partner records into the same component interface.

**Tech Stack:** Next.js 16.2, React 19, TypeScript, CSS, Node `node:test`, existing CommonJS backend component registry; no new runtime or test dependencies.

## Global Constraints

- The existing member administration and `partners` table remain the sole source of partner content.
- Do not add a second partner editor inside the page component.
- Do not add a third-party carousel dependency.
- Existing `logo-wall` and `cards` variants must remain backward compatible.
- The carousel defaults are auto-play enabled, slow speed, left direction, and pause on hover.
- `prefers-reduced-motion: reduce` disables automatic movement but preserves manual scrolling.
- If content does not overflow, do not duplicate items and do not start animation.

---

## File Structure

- Create `frontend/src/lib/partnerCarousel.mjs`: pure configuration and wrapping helpers usable by Node tests and the React component.
- Create `frontend/src/lib/partnerCarousel.test.mjs`: behavior tests for defaults, invalid settings, speeds, directions, and seamless wrap calculations.
- Create `frontend/src/components/ui/PartnerCarousel.tsx`: reusable client component for animation, drag, pause, focus, visibility, and accessibility behavior.
- Modify `frontend/src/styles/cards.css`: public About-page carousel and shared partner-card presentation.
- Modify `frontend/src/styles/blocks.css`: block-renderer carousel presentation and shared track behavior.
- Modify `backend/components/registry/definitions/association.js`: expose carousel behavior settings to the schema-driven studio property form.
- Modify `backend/components/registry/registry.test.js`: verify the partner component settings contract and invalid-value rejection.
- Modify `frontend/src/components/blocks/BlockRenderer.tsx`: render the new component for `association.partners` carousel blocks.
- Modify `frontend/src/components/pages/AboutPageClient.tsx`: render its unified `/api/partners` data through the reusable carousel with the approved defaults.

---

### Task 1: Register and validate admin carousel settings

**Files:**
- Modify: `backend/components/registry/definitions/association.js`
- Test: `backend/components/registry/registry.test.js`

**Interfaces:**
- Consumes: the existing `associationComponent()` schema builder and schema-driven `PropertyForm` support for `enum` and `boolean` fields.
- Produces: settings keys `autoPlay: boolean`, `speed: 'slow' | 'normal' | 'fast'`, `direction: 'left' | 'right'`, and `pauseOnHover: boolean` on `association.partners`.

- [ ] **Step 1: Add a failing registry contract test**

Append this test to `backend/components/registry/registry.test.js`:

```js
test('partner carousel exposes validated playback settings', () => {
  const fields = registry.getDefinition('association.partners').schema.settings.fields;
  assert.equal(fields.autoPlay.default, true);
  assert.deepEqual(fields.speed.values, ['slow', 'normal', 'fast']);
  assert.equal(fields.speed.default, 'slow');
  assert.deepEqual(fields.direction.values, ['left', 'right']);
  assert.equal(fields.direction.default, 'left');
  assert.equal(fields.pauseOnHover.default, true);

  const valid = registry.validateBlockConfig('association.partners', {
    settings: {
      group: '',
      variant: 'carousel',
      autoPlay: true,
      speed: 'slow',
      direction: 'left',
      pauseOnHover: true,
    },
  });
  assert.equal(valid.ok, true);

  const invalid = registry.validateBlockConfig('association.partners', {
    settings: { variant: 'carousel', speed: 'warp', direction: 'up' },
  });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.field === 'settings.speed' && error.code === 'enum'));
  assert.ok(invalid.errors.some((error) => error.field === 'settings.direction' && error.code === 'enum'));
});
```

- [ ] **Step 2: Run the registry test and confirm failure**

Run: `cd backend && npm test -- --test-name-pattern="partner carousel"`

Expected: FAIL because `autoPlay`, `speed`, `direction`, and `pauseOnHover` are not registered.

- [ ] **Step 3: Add the schema fields**

Extend `association.partners.settingsFields` in `backend/components/registry/definitions/association.js`:

```js
autoPlay: { type: 'boolean', default: true, label: '自動播放' },
speed: { type: 'enum', values: ['slow', 'normal', 'fast'], default: 'slow', label: '播放速度' },
direction: { type: 'enum', values: ['left', 'right'], default: 'left', label: '播放方向' },
pauseOnHover: { type: 'boolean', default: true, label: '懸停時暫停' },
```

Keep `group` and `variant` unchanged. The existing schema-driven property form will render these settings without a second editor implementation.

- [ ] **Step 4: Run the registry tests**

Run: `cd backend && npm test -- --test-name-pattern="partner carousel|well-formed"`

Expected: PASS for the new contract and registry shape tests.

- [ ] **Step 5: Commit the registry contract**

```bash
git add backend/components/registry/definitions/association.js backend/components/registry/registry.test.js
git commit -m "feat: configure partner carousel in studio"
```

---

### Task 2: Implement tested carousel configuration and wrap helpers

**Files:**
- Create: `frontend/src/lib/partnerCarousel.mjs`
- Create: `frontend/src/lib/partnerCarousel.test.mjs`

**Interfaces:**
- Consumes: raw block settings as `Record<string, unknown>` and measured scroll positions in CSS pixels.
- Produces: `resolvePartnerCarouselOptions(settings)`, `partnerCarouselPixelsPerSecond(speed)`, and `wrapPartnerCarouselScroll({ scrollLeft, cycleWidth, direction })`.

- [ ] **Step 1: Write failing pure helper tests**

Create `frontend/src/lib/partnerCarousel.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  partnerCarouselPixelsPerSecond,
  resolvePartnerCarouselOptions,
  wrapPartnerCarouselScroll,
} from './partnerCarousel.mjs';

test('partner carousel settings use safe defaults and reject invalid values', () => {
  assert.deepEqual(resolvePartnerCarouselOptions({}), {
    autoPlay: true,
    speed: 'slow',
    direction: 'left',
    pauseOnHover: true,
  });
  assert.deepEqual(resolvePartnerCarouselOptions({ autoPlay: false, speed: 'fast', direction: 'right', pauseOnHover: false }), {
    autoPlay: false,
    speed: 'fast',
    direction: 'right',
    pauseOnHover: false,
  });
  assert.equal(resolvePartnerCarouselOptions({ speed: 'warp' }).speed, 'slow');
  assert.equal(resolvePartnerCarouselOptions({ direction: 'up' }).direction, 'left');
});

test('partner carousel speeds remain deliberately slow', () => {
  assert.equal(partnerCarouselPixelsPerSecond('slow'), 18);
  assert.equal(partnerCarouselPixelsPerSecond('normal'), 30);
  assert.equal(partnerCarouselPixelsPerSecond('fast'), 46);
});

test('partner carousel wraps to the equivalent position without a visible jump', () => {
  assert.equal(wrapPartnerCarouselScroll({ scrollLeft: 610, cycleWidth: 600, direction: 'left' }), 10);
  assert.equal(wrapPartnerCarouselScroll({ scrollLeft: -8, cycleWidth: 600, direction: 'right' }), 592);
  assert.equal(wrapPartnerCarouselScroll({ scrollLeft: 0, cycleWidth: 600, direction: 'right' }), 600);
  assert.equal(wrapPartnerCarouselScroll({ scrollLeft: 245, cycleWidth: 600, direction: 'left' }), 245);
  assert.equal(wrapPartnerCarouselScroll({ scrollLeft: 245, cycleWidth: 0, direction: 'left' }), 245);
});
```

- [ ] **Step 2: Run the helper test and confirm failure**

Run: `cd frontend && node --test src/lib/partnerCarousel.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `partnerCarousel.mjs`.

- [ ] **Step 3: Implement the pure helper module**

Create `frontend/src/lib/partnerCarousel.mjs`:

```js
const SPEEDS = Object.freeze({ slow: 18, normal: 30, fast: 46 });

export function resolvePartnerCarouselOptions(settings = {}) {
  return {
    autoPlay: typeof settings.autoPlay === 'boolean' ? settings.autoPlay : true,
    speed: Object.hasOwn(SPEEDS, settings.speed) ? settings.speed : 'slow',
    direction: settings.direction === 'right' ? 'right' : 'left',
    pauseOnHover: typeof settings.pauseOnHover === 'boolean' ? settings.pauseOnHover : true,
  };
}

export function partnerCarouselPixelsPerSecond(speed) {
  return SPEEDS[speed] || SPEEDS.slow;
}

export function wrapPartnerCarouselScroll({ scrollLeft, cycleWidth, direction }) {
  if (!(cycleWidth > 0)) return scrollLeft;
  if (direction === 'right' && scrollLeft <= 0) return scrollLeft + cycleWidth;
  if (direction !== 'right' && scrollLeft >= cycleWidth) return scrollLeft - cycleWidth;
  return scrollLeft;
}
```

- [ ] **Step 4: Run the helper tests**

Run: `cd frontend && node --test src/lib/partnerCarousel.test.mjs`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the pure behavior**

```bash
git add frontend/src/lib/partnerCarousel.mjs frontend/src/lib/partnerCarousel.test.mjs
git commit -m "test: define partner carousel behavior"
```

---

### Task 3: Build the reusable accessible carousel component

**Files:**
- Create: `frontend/src/components/ui/PartnerCarousel.tsx`
- Modify: `frontend/src/styles/cards.css`

**Interfaces:**
- Consumes: `PartnerCarouselItem[]`, resolved or raw playback props, and a `renderItem(item, duplicate)` callback.
- Produces: `PartnerCarousel` with native scrolling and class hooks `.partner-carousel`, `.partner-carousel__viewport`, `.partner-carousel__track`, and `.partner-carousel__item`.

- [ ] **Step 1: Define the component contract and state model**

Create `frontend/src/components/ui/PartnerCarousel.tsx` with these exported types and imports:

```tsx
'use client';

import { PointerEvent as ReactPointerEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  partnerCarouselPixelsPerSecond,
  resolvePartnerCarouselOptions,
  wrapPartnerCarouselScroll,
} from '@/lib/partnerCarousel.mjs';

export type PartnerCarouselItem = { id: string | number };

export type PartnerCarouselProps<T extends PartnerCarouselItem> = {
  items: T[];
  ariaLabel: string;
  autoPlay?: boolean;
  speed?: 'slow' | 'normal' | 'fast';
  direction?: 'left' | 'right';
  pauseOnHover?: boolean;
  className?: string;
  renderItem: (item: T, duplicate: boolean) => ReactNode;
};
```

Use refs for the viewport, first item set, animation frame, last timestamp, resume timer, drag origin, original scroll position, and drag-distance flag. Use state only for `overflowing`, `hovered`, `focused`, `dragging`, `manuallyPaused`, `reducedMotion`, and `pageVisible` so rendering remains predictable.

- [ ] **Step 2: Implement measurement and animation lifecycle**

Inside the component:

- Resolve props with `resolvePartnerCarouselOptions`.
- Use `ResizeObserver` to compare `firstSet.scrollWidth` with `viewport.clientWidth` and set `overflowing`.
- Duplicate the list only when `overflowing` is true.
- When rightward playback first becomes active, initialize `viewport.scrollLeft` to the first cycle width so the animation can decrement through the duplicated track before wrapping.
- Use `matchMedia('(prefers-reduced-motion: reduce)')` and its `change` event to maintain `reducedMotion`.
- Use `document.visibilitychange` and `window` focus/blur events to maintain `pageVisible`.
- Start `requestAnimationFrame` only when overflowing, auto-play is enabled, motion is allowed, the page is visible, and no hover/focus/drag/manual pause is active.
- Advance by `pixelsPerSecond * elapsedMilliseconds / 1000`, apply the configured direction, and pass the result through `wrapPartnerCarouselScroll`.
- Cancel the frame and remove all observers/listeners on cleanup.

The animation effect must cap elapsed time at 64 ms so returning from a suspended tab never causes a large jump.

- [ ] **Step 3: Implement pointer dragging and click suppression**

Add pointer handlers to the viewport:

```tsx
const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const viewport = viewportRef.current;
  if (!viewport) return;
  dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: viewport.scrollLeft };
  draggedRef.current = false;
  setDragging(true);
  viewport.setPointerCapture(event.pointerId);
};

const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
  const drag = dragRef.current;
  const viewport = viewportRef.current;
  if (!drag || !viewport || drag.pointerId !== event.pointerId) return;
  const delta = event.clientX - drag.startX;
  if (Math.abs(delta) > 6) draggedRef.current = true;
  viewport.scrollLeft = drag.startScrollLeft - delta;
};
```

On pointer up/cancel, release capture, clear drag state, and call a `pauseTemporarily()` helper that resumes after 1200 ms. Add an `onClickCapture` handler that calls `preventDefault()` and `stopPropagation()` only when `draggedRef.current` is true, then clears that flag.

On native `wheel` and pointer/touch interaction, use the same temporary pause without forcing React state updates on every animation frame. Do not treat the component's own `scrollLeft` writes as manual scrolling.

- [ ] **Step 4: Render accessible duplicate content**

Render this structure:

```tsx
<div className={`partner-carousel${overflowing ? ' is-overflowing' : ''}${dragging ? ' is-dragging' : ''}${className ? ` ${className}` : ''}`}>
  <div
    ref={viewportRef}
    className="partner-carousel__viewport"
    role="region"
    aria-label={ariaLabel}
    tabIndex={overflowing ? 0 : undefined}
    onMouseEnter={() => options.pauseOnHover && setHovered(true)}
    onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
    }}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={finishDrag}
    onPointerCancel={finishDrag}
    onClickCapture={suppressDraggedClick}
  >
    <div className="partner-carousel__track">
      <div ref={firstSetRef} className="partner-carousel__set">
        {items.map((item) => <div className="partner-carousel__item" key={item.id}>{renderItem(item, false)}</div>)}
      </div>
      {overflowing ? (
        <div className="partner-carousel__set" aria-hidden="true" inert>
          {items.map((item) => <div className="partner-carousel__item" key={`duplicate-${item.id}`}>{renderItem(item, true)}</div>)}
        </div>
      ) : null}
    </div>
  </div>
</div>
```

Ensure duplicate links receive `tabIndex={-1}` from the `duplicate` value passed to `renderItem`; `aria-hidden` and `inert` provide an additional safeguard.

- [ ] **Step 5: Add the shared carousel CSS**

Append to `frontend/src/styles/cards.css`:

```css
.partner-carousel { position: relative; width: 100%; }
.partner-carousel::before,
.partner-carousel::after {
  content: ""; position: absolute; z-index: 2; top: 0; bottom: 0; width: 48px;
  pointer-events: none; opacity: 0; transition: opacity var(--motion-normal) var(--ease);
}
.partner-carousel::before { left: 0; background: linear-gradient(90deg, var(--bg), transparent); }
.partner-carousel::after { right: 0; background: linear-gradient(270deg, var(--bg), transparent); }
.partner-carousel.is-overflowing::before,
.partner-carousel.is-overflowing::after { opacity: 1; }
.partner-carousel__viewport {
  width: 100%; overflow-x: auto; overflow-y: hidden; scrollbar-width: none;
  overscroll-behavior-inline: contain; cursor: grab; touch-action: pan-y pinch-zoom;
}
.partner-carousel__viewport::-webkit-scrollbar { display: none; }
.partner-carousel.is-dragging .partner-carousel__viewport { cursor: grabbing; user-select: none; }
.partner-carousel__track { display: flex; width: max-content; }
.partner-carousel__set { display: flex; align-items: stretch; gap: 18px; padding-right: 18px; }
.partner-carousel__item { flex: 0 0 clamp(154px, 15vw, 184px); }
@media (max-width: 640px) {
  .partner-carousel::before, .partner-carousel::after { width: 24px; }
  .partner-carousel__set { gap: 12px; padding-right: 12px; }
  .partner-carousel__item { flex-basis: 150px; }
}
@media (prefers-reduced-motion: reduce) {
  .partner-carousel::before, .partner-carousel::after { transition: none; }
}
```

- [ ] **Step 6: Verify type checking through the production build**

Run: `cd frontend && npm run build`

Expected: Next.js build completes without TypeScript, JSX, CSS, or accessibility attribute errors.

- [ ] **Step 7: Commit the reusable component**

```bash
git add frontend/src/components/ui/PartnerCarousel.tsx frontend/src/styles/cards.css
git commit -m "feat: add accessible partner carousel"
```

---

### Task 4: Integrate the component-block renderer

**Files:**
- Modify: `frontend/src/components/blocks/BlockRenderer.tsx`
- Modify: `frontend/src/styles/blocks.css`

**Interfaces:**
- Consumes: `PartnerCarousel`, `AssocPartner[]`, and the four registry settings from Tasks 1 and 3.
- Produces: live and studio-preview rendering for `association.partners` when `variant === 'carousel'`, while leaving grid and card variants unchanged.

- [ ] **Step 1: Import and resolve carousel settings**

Add:

```tsx
import PartnerCarousel from '@/components/ui/PartnerCarousel';
import { resolvePartnerCarouselOptions } from '@/lib/partnerCarousel.mjs';
```

In `AssocPartners`, resolve:

```tsx
const carouselOptions = resolvePartnerCarouselOptions(settings);
```

- [ ] **Step 2: Replace only the carousel branch**

Refactor the partner-card creation into a local `renderPartner(partner, duplicate)` function. Preserve `LogoTile`, partner name, optional website display for cards, and external-link behavior. For duplicate external links, set `tabIndex={-1}`.

Replace the existing carousel branch with:

```tsx
<PartnerCarousel
  items={items}
  ariaLabel={lang === 'en' ? 'Partners' : '合作夥伴'}
  autoPlay={carouselOptions.autoPlay}
  speed={carouselOptions.speed}
  direction={carouselOptions.direction}
  pauseOnHover={carouselOptions.pauseOnHover}
  className="hk-partner-carousel"
  renderItem={renderPartner}
/>
```

The non-carousel branch must continue to render `.hk-partner-grid` with the original `list` content.

- [ ] **Step 3: Adapt block-specific CSS to the shared track**

Remove the old overflow declaration from `.hk-partner-carousel` and retain only block-specific sizing:

```css
.hk-partner-carousel .partner-carousel__item { flex-basis: 180px; }
.hk-partner-carousel .hk-partner { height: 100%; }
```

Do not change `.hk-partner-grid`, `.hk-partner`, or the logo tile styles used by the other variants.

- [ ] **Step 4: Run helper, registry, and build checks**

Run:

```bash
cd frontend && node --test src/lib/partnerCarousel.test.mjs
cd frontend && npm run build
cd backend && npm test -- --test-name-pattern="partner carousel|well-formed"
```

Expected: all targeted tests PASS and the frontend build completes.

- [ ] **Step 5: Commit the block-renderer integration**

```bash
git add frontend/src/components/blocks/BlockRenderer.tsx frontend/src/styles/blocks.css
git commit -m "feat: render configurable partner carousel blocks"
```

---

### Task 5: Switch the About page to the approved default carousel

**Files:**
- Modify: `frontend/src/components/pages/AboutPageClient.tsx`
- Modify: `frontend/src/styles/cards.css`

**Interfaces:**
- Consumes: existing `Partner[]` loaded from `/api/partners`, `imgUrl`, `isPlaceholderPartnerName`, and `PartnerCarousel`.
- Produces: an About-page carousel using unified partner records and fixed defaults `autoPlay`, `speed="slow"`, `direction="left"`, and `pauseOnHover`.

- [ ] **Step 1: Import the reusable component**

Add:

```tsx
import PartnerCarousel from '@/components/ui/PartnerCarousel';
```

- [ ] **Step 2: Replace the wrapping grid with the carousel**

Replace `.member-logo-grid` in the partner section with:

```tsx
<PartnerCarousel
  items={partners}
  ariaLabel={t('合作夥伴', 'Partners')}
  autoPlay
  speed="slow"
  direction="left"
  pauseOnHover
  className="about-partner-carousel"
  renderItem={(partner, duplicate) => {
    const partnerName = isPlaceholderPartnerName(partner.name) ? t('合作夥伴', 'Partner Organization') : partner.name;
    const card = (
      <div className="member-logo-card">
        <div className="member-logo-card__surface">
          <img src={imgUrl(partner.logo_url)} alt={duplicate ? '' : partnerName} />
        </div>
      </div>
    );
    return partner.website_url ? (
      <a
        href={partner.website_url}
        target="_blank"
        rel="noopener noreferrer"
        className="member-logo-link"
        aria-label={duplicate ? undefined : `${partnerName} website`}
        tabIndex={duplicate ? -1 : undefined}
      >
        {card}
      </a>
    ) : card;
  }}
/>
```

Remove only the obsolete `.member-logo-grid` wrapper. Preserve the section title, unified data request, empty/error behavior, and card appearance.

- [ ] **Step 3: Add About-page sizing**

Append to `frontend/src/styles/cards.css`:

```css
.about-partner-carousel .member-logo-link,
.about-partner-carousel .member-logo-card { height: 100%; }
.about-partner-carousel .member-logo-card { min-height: 116px; }
```

- [ ] **Step 4: Run all proportional checks**

Run:

```bash
cd frontend && node --test src/lib/partnerCarousel.test.mjs
cd backend && npm test -- --test-name-pattern="partner carousel|well-formed"
cd frontend && npm run build
```

Expected: helper tests and registry tests PASS; production build completes.

- [ ] **Step 5: Perform browser interaction checks**

Start the existing development stack, then verify `/about` and a published page containing an `association.partners` carousel:

- The track moves slowly left without a visible seam.
- Hovering pauses and leaving resumes.
- Mouse dragging, touch dragging, trackpad scrolling, and normal link clicks behave independently.
- Dragging more than 6 px does not open a link.
- Focusing a partner link pauses movement and shows the focus ring.
- Narrow viewports keep 150 px cards and remain draggable.
- Reduced-motion mode disables automatic movement.
- A list narrower than the viewport stays static and is not duplicated.
- Studio settings show variant, group, auto-play, speed, direction, and hover-pause controls.
- Updating a partner in member administration is reflected in both render paths after reload.

- [ ] **Step 6: Commit the About-page integration**

```bash
git add frontend/src/components/pages/AboutPageClient.tsx frontend/src/styles/cards.css
git commit -m "feat: auto-scroll About page partners"
```

---

### Task 6: Final regression verification

**Files:**
- Verify only; no planned source changes.

**Interfaces:**
- Consumes: all deliverables from Tasks 1-5.
- Produces: evidence that the feature is complete without breaking existing public or admin surfaces.

- [ ] **Step 1: Run the complete backend test suite**

Run: `cd backend && npm test`

Expected: all backend tests PASS.

- [ ] **Step 2: Run all standalone frontend Node tests**

Run: `cd frontend && node --test src/lib/*.test.mjs`

Expected: all discovered frontend Node tests PASS.

- [ ] **Step 3: Run the production frontend build**

Run: `cd frontend && npm run build`

Expected: production compilation and static generation complete without errors.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only files named in this plan and pre-existing unrelated user changes appear.
