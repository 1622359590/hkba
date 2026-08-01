# Partner Logo Wall Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the nested partner cards with a flat, professional logo wall while preserving links, carousel behavior, accessibility, and the detailed `cards` variant.

**Architecture:** Keep the existing `AssocPartners` data flow and `LogoTile` fallback behavior. Add one pure presentation helper to make detail visibility testable, then conditionally render names only for the `cards` variant. Rework the shared logo-wall CSS into one flat cool-neutral surface with no nested frame, gradient, shadow, or movement.

**Tech Stack:** Next.js 16.2, React 19, TypeScript, CSS, Node `node:test`; no new dependencies.

## Global Constraints

- Preserve partner order, links, carousel playback, source images, alt text, and fallback initials.
- Remove visible partner names from `logo-wall` and `carousel` variants.
- Preserve names and website text in the explicit `cards` variant.
- Use one flat cool-neutral logo surface with no per-brand treatment.
- Do not change page routes, association data, navigation, or unrelated card components.

---

## File Structure

- Modify `frontend/src/lib/partnerCarousel.mjs`: add a pure variant-to-detail-visibility helper alongside existing partner presentation helpers.
- Modify `frontend/src/lib/partnerCarousel.test.mjs`: verify logo-wall, carousel, and cards detail rules.
- Modify `frontend/src/components/blocks/BlockRenderer.tsx`: conditionally render partner names and website details.
- Modify `frontend/src/styles/blocks.css`: flatten the logo-wall and carousel presentation while preserving the cards variant.

---

### Task 1: Make partner detail visibility explicit and tested

**Files:**
- Modify: `frontend/src/lib/partnerCarousel.mjs`
- Test: `frontend/src/lib/partnerCarousel.test.mjs`
- Modify: `frontend/src/components/blocks/BlockRenderer.tsx:10-13,302-331`

**Interfaces:**
- Consumes: association partner `variant` as an unknown setting normalized to a string.
- Produces: `partnerShowsDetails(variant): boolean`, returning `true` only for `cards`.

- [ ] **Step 1: Add a failing helper test**

Add `partnerShowsDetails` to the existing named import from `./partnerCarousel.mjs`, then append this test:

```js
test('partner details are visible only in the explicit cards variant', () => {
  assert.equal(partnerShowsDetails('cards'), true);
  assert.equal(partnerShowsDetails('logo-wall'), false);
  assert.equal(partnerShowsDetails('carousel'), false);
  assert.equal(partnerShowsDetails(undefined), false);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `cd frontend && node --test src/lib/partnerCarousel.test.mjs`

Expected: FAIL because `partnerShowsDetails` is not exported.

- [ ] **Step 3: Implement the pure helper**

Add to `frontend/src/lib/partnerCarousel.mjs`:

```js
export function partnerShowsDetails(variant) {
  return variant === 'cards';
}
```

- [ ] **Step 4: Use the helper in the public renderer**

Import `partnerShowsDetails` with `resolvePartnerCarouselOptions`, calculate `const showDetails = partnerShowsDetails(variant)`, and render the visible detail markup only when it is true:

```tsx
<LogoTile src={partner.logoUrl} name={partner.name} />
{showDetails ? <span className="hk-partner__name">{partner.name}</span> : null}
{showDetails && partner.websiteUrl ? (
  <span className="hk-partner__site">
    {partner.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
  </span>
) : null}
```

Keep the link wrapper and duplicate carousel tab behavior unchanged.

- [ ] **Step 5: Run the helper test**

Run: `cd frontend && node --test src/lib/partnerCarousel.test.mjs`

Expected: all partner carousel tests PASS.

---

### Task 2: Flatten the logo wall and verify the public page

**Files:**
- Modify: `frontend/src/styles/blocks.css:185-230`

**Interfaces:**
- Consumes: existing `.hk-partner-grid`, `.hk-partner-carousel`, `.hk-partner`, `.hk-partner__tile`, and `.hk-partner-grid--cards` class structure.
- Produces: a flat logo-only wall for default and carousel variants, plus preserved detailed cards styling under `.hk-partner-grid--cards`.

- [ ] **Step 1: Replace the nested logo surface styles**

Use a single flat surface and remove the pseudo-element entirely:

```css
.hk-partner-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
}

.hk-partner-carousel .partner-carousel__item { flex-basis: 170px; }
.hk-partner-carousel .hk-partner { height: 100%; }

.hk-partner {
  display: block;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  text-decoration: none;
}

.hk-partner__tile {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 76px;
  padding: 16px 18px;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.14);
  border-radius: 12px;
  background: #929dab;
  transition: border-color 180ms ease, background-color 180ms ease;
}

.hk-partner:hover .hk-partner__tile {
  border-color: rgba(226, 232, 240, 0.28);
  background: #9ca7b5;
}

.hk-partner:focus-visible {
  outline: 2px solid var(--accent, #3b82f6);
  outline-offset: 3px;
}

.hk-partner__tile img {
  display: block;
  max-width: 100%;
  max-height: 42px;
  object-fit: contain;
}
```

Do not add gradients, inset frames, shadows, image filters, scaling, or vertical translation.

- [ ] **Step 2: Preserve the explicit cards variant**

Keep `.hk-partner-grid--cards` at `minmax(210px, 1fr)` and scope the existing card container treatment to `.hk-partner-grid--cards .hk-partner`. Keep `.hk-partner__name` and `.hk-partner__site` styles for this variant only.

- [ ] **Step 3: Run unit and production checks**

Run: `cd frontend && node --test src/lib/partnerCarousel.test.mjs && npm run build`

Expected: all tests PASS and the Next.js production build exits with code 0.

- [ ] **Step 4: Verify the real `/about` page in the browser**

Start the production frontend on an unused local port and open `/about`. Confirm:

- MetaEra remains readable without a special-case class.
- Trading Base remains visible on the same surface.
- Black, white, yellow, and multicolor logos share one flat treatment.
- No company-name labels appear under logo-wall or carousel items.
- No inner frame, gradient, heavy shadow, hover movement, clipping, or layout gap remains.
- Keyboard focus remains visible and partner links still open correctly.

- [ ] **Step 5: Review the scoped diff**

Run:

```bash
git diff -- frontend/src/lib/partnerCarousel.mjs \
  frontend/src/lib/partnerCarousel.test.mjs \
  frontend/src/components/blocks/BlockRenderer.tsx \
  frontend/src/styles/blocks.css
```

Expected: only the approved partner detail visibility and flat logo-wall presentation are changed.
