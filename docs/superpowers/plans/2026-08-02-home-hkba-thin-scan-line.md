# HKBA Thin Scan Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the homepage HKBA wordmark so its moving scan reads as a precise 1px line with a narrow internal highlight instead of a thick light column.

**Architecture:** Keep the existing `HeroScanWordmark` markup, shared `--hero-scan-y` timeline, 3.4 second cycle, and reduced-motion behavior. Expose the approved scan metrics through the existing presentation model, pass them into CSS custom properties, and use those properties to narrow the gradient stops, texture mask, and glow radius.

**Tech Stack:** Next.js 16, React, CSS Modules, Node.js built-in test runner

## Global Constraints

- The main scan line remains exactly `1px` high.
- The visible internal highlight occupies approximately `6%–8%` of the letter height.
- The brightest core remains within approximately `2%–3%` of the scan position.
- Glow radii are no more than half of the initial implementation.
- The 3.4 second animation cycle, layout, wordmark geometry, mobile sizing, and 52% reduced-motion resting position remain unchanged.

---

### Task 1: Narrow the HKBA scan highlight

**Files:**
- Modify: `frontend/src/lib/heroWordmark.test.mjs`
- Modify: `frontend/src/lib/heroWordmark.mjs`
- Modify: `frontend/src/components/home/HeroScanWordmark.tsx`
- Modify: `frontend/src/components/home/HeroScanWordmark.module.css`

**Interfaces:**
- Consumes: the existing `--hero-scan-y` custom property and `HeroScanWordmark` layer classes.
- Produces: `heroWordmarkPresentation()` metrics for `bandEdgePct`, `corePct`, `beamPx`, and `glowPx`, consumed as CSS custom properties by the existing component.

- [ ] **Step 1: Write the failing presentation contract test**

Extend `frontend/src/lib/heroWordmark.test.mjs` to assert the approved scan metrics returned by the real presentation model:

```js
assert.deepEqual(presentation.scan, {
  bandEdgePct: 4,
  corePct: 1.5,
  beamPx: 1,
  glowPx: 3,
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd frontend
node --test src/lib/heroWordmark.test.mjs
```

Expected: FAIL because the current presentation model does not expose the approved narrow scan metrics.

- [ ] **Step 3: Implement the narrow scan treatment**

Add the literal scan metrics to `heroWordmarkPresentation()`, pass them from `HeroScanWordmark.tsx` as CSS custom properties, then update `HeroScanWordmark.module.css`:

- confine the visible `.light` transition to `--hero-scan-y - 4%` through `--hero-scan-y + 4%`;
- keep the white/cyan core within roughly `-1%` through `+2%`;
- confine `.texture` and its mask to the same narrow interval;
- reduce the light-layer drop shadow from `7px` to `3px`;
- keep `.beam` at `1px` and reduce its shadows from `6px / 14px` to `3px / 7px`.

- [ ] **Step 4: Run focused and related tests**

Run:

```bash
cd frontend
node --test src/lib/heroWordmark.test.mjs src/lib/partnerCarousel.test.mjs src/lib/partnerMarqueePresentation.test.mjs
```

Expected: 16 tests pass, 0 fail.

- [ ] **Step 5: Verify in the browser**

At desktop width, sample the wordmark during motion and confirm the beam remains `1px`, the internal bright area stays below one tenth of the wordmark height, and the base/light/texture rectangles remain identical. At 390px width, confirm no horizontal overflow. With reduced motion enabled, confirm the scan stays fixed at `52%`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/heroWordmark.test.mjs frontend/src/lib/heroWordmark.mjs frontend/src/components/home/HeroScanWordmark.tsx frontend/src/components/home/HeroScanWordmark.module.css
git commit -m "fix: refine HKBA scan line"
```
