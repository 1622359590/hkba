# HKBA Admin Completion Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the canonical page tree, add real structured page components, and render the studio canvas with public dark-theme fidelity.

**Architecture:** An idempotent backend provisioner creates missing canonical pages as drafts and converts the legacy membership page without publishing new content. Existing structured APIs remain authoritative; page components query their data through the public content payload. The light admin shell contains a nested dark canvas token scope.

**Tech Stack:** Node.js, Express, SQLite, Next.js 16, React 19, TypeScript, CSS

## Global Constraints

- Never auto-publish a newly provisioned page.
- Never overwrite existing canonical page content or versions.
- Public legacy pages remain the fallback until a workstudio page is published.
- Provisioning must be idempotent.
- No new runtime dependency.

---

### Task 1: Canonical page provisioner

**Files:**
- Create: `backend/lib/ensureSystemPages.js`
- Create: `backend/lib/ensureSystemPages.test.js`
- Modify: `backend/scripts/migrate-content.js`
- Modify: `.github/workflows/deploy-baota.yml`

**Interfaces:**
- Produces: `ensureSystemPages(conn): { created: string[], converted: string[] }`.

- [ ] Write a failing in-memory database test for seven canonical paths, membership conversion, draft-only creation, required block types, redirects, and idempotency.
- [ ] Run the focused test and confirm the missing module failure.
- [ ] Implement the provisioner and invoke it after content migration.
- [ ] Add the idempotent content migration command to deployment after backup/seed.
- [ ] Run the focused and migration test suites.

### Task 2: Structured event rendering

**Files:**
- Modify: `backend/components/registry/definitions/association.js`
- Modify: `backend/routes/publicContent.js`
- Modify: `frontend/src/lib/publicContent.ts`
- Modify: `frontend/src/components/blocks/BlockRenderer.tsx`
- Test: `backend/test/publicContent.test.js`

**Interfaces:**
- Adds `events` to the association payload and `AssocData`.
- Registers and renders `association.events`.

- [ ] Add a failing API assertion for published events in the association payload.
- [ ] Add the registry contract and public query.
- [ ] Add bilingual event cards with date, location, summary, and registration link.
- [ ] Run public-content tests.

### Task 3: Public news page switch

**Files:**
- Modify: `frontend/src/components/pages/NewsListClient.tsx`

**Interfaces:**
- Wraps the existing news page with `PublicPageSwitch path="/news"` while retaining the existing list as fallback.

- [ ] Add the wrapper without changing the legacy list behavior.
- [ ] Verify a missing/unpublished page still renders the legacy list.

### Task 4: Dark public-fidelity studio canvas

**Files:**
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Produces a dark token scope on `.hk-canvas` nested inside the light `.admin-shell`.

- [ ] Restore public background, surface, text, border, gold, and cyan tokens inside the canvas.
- [ ] Keep editor selection and labels visible.
- [ ] Verify light admin chrome and dark canvas at desktop and narrow widths.

### Task 5: End-to-end verification

**Files:**
- Modify only if verification identifies a scoped defect.

- [ ] Run `npm test` in `backend`.
- [ ] Run `node --test src/lib/studioSelection.test.mjs` in `frontend`.
- [ ] Run `npm run build` in `frontend`.
- [ ] Provision the isolated preview database and confirm seven page-tree nodes.
- [ ] Inspect `/admin/studio` and one public fallback page in the browser with no console errors.
