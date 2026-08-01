# HKBA Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the confirmed HKBA homepage mockup with the exact blue/cyan tokens, header, hero, mission cards, and entrance animations defined in the approved specification.

**Architecture:** Keep the existing bilingual and CMS page-switch systems intact. A shared homepage presentation component supplies identical Hero and Mission markup to both the local fallback and published CMS paths; modular CSS files retain their existing ownership.

**Tech Stack:** Next.js, React, TypeScript, CSS, IntersectionObserver.

## Global Constraints

- Use the exact values from `docs/superpowers/specs/2026-08-01-mockup-implementation.md`.
- Preserve the bilingual system, public API integration, CMS block renderer, and admin UI.
- Store the generated city artwork at `frontend/public/images/hero-bg.jpg`.
- Respect `prefers-reduced-motion: reduce`.

---

### Task 1: Tokens and navigation

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/styles/navigation.css`

- [ ] Replace public design tokens with the exact blue/cyan values.
- [ ] Match the specified header structure, scroll state, logo, active link, language control, and contact action.
- [ ] Verify desktop and mobile navigation behavior.

### Task 2: Homepage presentation

**Files:**
- Create: `frontend/src/components/home/HomeMockupSections.tsx`
- Modify: `frontend/src/components/HomePageClient.tsx`
- Modify: `frontend/src/components/PublicPageSwitch.tsx`
- Modify: `frontend/src/styles/cards.css`
- Modify: `frontend/src/styles/webgl.css`

- [ ] Implement the exact Hero structure and copy.
- [ ] Implement the exact Mission structure, SVG icons, and four-card grid.
- [ ] Reuse the presentation for both fallback and published homepage states.
- [ ] Retain all existing data-driven sections below the Mission section.

### Task 3: Motion and image

**Files:**
- Modify: `frontend/src/styles/animations.css`
- Modify: `frontend/src/components/ui/ScrollReveal.tsx`
- Replace: `frontend/public/images/hero-bg.jpg`

- [ ] Add the exact `fadeSlideIn`, `bgIn`, and `cardIn` keyframes and delays.
- [ ] Observe the Hero and cards with `IntersectionObserver`.
- [ ] Preserve reduced-motion fallbacks.
- [ ] Install the generated Hong Kong blockchain city image.

### Task 4: Verification

**Files:**
- No source changes expected.

- [ ] Run `npm run build` in `frontend`.
- [ ] Run `npm run dev` in `frontend`.
- [ ] Inspect at 375px, 768px, and 1280px for overflow and specified grid behavior.
