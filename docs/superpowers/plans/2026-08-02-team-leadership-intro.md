# Team Leadership Introduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the team page a page-specific introduction that explains the leadership committee's responsibilities and composition before the member directory.

**Architecture:** Add a localized content model and a standalone `LeadershipIntro` presentation component. Keep API loading and member grouping in `TeamPageClient`, replacing only its generic heading section with the new component and adding team-page-specific CSS.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS, Node test runner.

## Global Constraints

- Keep the existing `/api/team` data flow and admin-managed member records unchanged.
- The introduction must be a standalone component used only by the team page.
- Support Traditional Chinese and English through the existing language context.
- Do not add third-party dependencies.

---

### Task 1: Localized leadership introduction model

**Files:**
- Create: `frontend/src/components/pages/leadershipIntroContent.ts`
- Test: `frontend/src/components/pages/leadershipIntroContent.test.mts`

**Interfaces:**
- Produces: `getLeadershipIntro(lang: 'zh' | 'en'): LeadershipIntroContent`

- [ ] Write tests proving both languages return the correct page title, responsibility summary, and three composition groups.
- [ ] Run `node --test frontend/src/components/pages/leadershipIntroContent.test.mts` and confirm it fails because the model does not exist.
- [ ] Implement the localized model.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Standalone introduction component

**Files:**
- Create: `frontend/src/components/pages/LeadershipIntro.tsx`
- Create: `frontend/src/styles/team.css`
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/components/pages/TeamPageClient.tsx`

**Interfaces:**
- Consumes: `getLeadershipIntro(lang)` and the existing `useLang()` context.
- Produces: `LeadershipIntro`, a semantic page introduction with responsibility and composition regions.

- [ ] Build the asymmetric introduction layout with a page title, responsibility copy, and three composition entries.
- [ ] Add responsive team-page-only styles and reduced-motion handling.
- [ ] Replace the generic team-page heading section with `LeadershipIntro`.
- [ ] Preserve loading, error, empty, grouping, and member card behavior.

### Task 3: Verification

**Files:**
- Verify only; no new production files expected.

**Interfaces:**
- Consumes: completed tasks 1 and 2.
- Produces: fresh test and build evidence.

- [ ] Run the focused content test.
- [ ] Run the frontend production build.
- [ ] Inspect the team page at desktop and mobile widths if the local app can be launched.
