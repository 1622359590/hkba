# Studio Preview And Draft History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-studio modal preview and durable automatic draft snapshots with change summaries, preview, restore, and protected deletion.

**Architecture:** Store immutable draft snapshots in dedicated tables so publishing semantics remain untouched. Extend the existing draft transaction helper to capture one resulting snapshot per successful mutation, expose snapshot lifecycle endpoints from the page admin router, and split the studio preview/history interfaces into focused components.

**Tech Stack:** Node.js, Express, better-sqlite3, Next.js 16, React 19, TypeScript, existing admin API helpers and block renderer.

## Global Constraints

- Keep `page_versions` publishing behavior and optimistic draft revisions unchanged.
- Never modify a published version during snapshot restore or delete.
- Keep at most 50 automatic snapshots per page.
- Preview tokens remain short-lived, no-store, and noindex.
- Preserve bilingual blocks, media references, permissions, and audit logging.

---

### Task 1: Snapshot Schema And Pure Change Summary

**Files:**
- Create: `backend/db/migrations/014_page_draft_snapshots.sql`
- Create: `backend/lib/draftSnapshots.js`
- Create: `backend/lib/draftSnapshots.test.js`
- Modify: `backend/db/migrate.test.js`
- Modify: `backend/db/migrations-smoke.test.js`

**Interfaces:**
- Produces: `captureDraftState(conn, versionId)`
- Produces: `summarizeDraftChange(before, after)`
- Produces: `createDraftSnapshot(conn, options)`
- Produces: `pruneDraftSnapshots(conn, pageId, keep = 50)`
- Produces: `restoreDraftSnapshot(conn, options)`

- [ ] Write failing tests for added, removed, reordered, bilingual-content, settings, visibility, and SEO summaries.
- [ ] Run `node --test backend/lib/draftSnapshots.test.js` and confirm the missing module failure.
- [ ] Add snapshot and snapshot-block tables with foreign keys, indexes, and cascading child deletion.
- [ ] Implement state capture, structured diffing, immutable copy insertion, retention, and restore helpers.
- [ ] Run library and migration tests and confirm they pass.

### Task 2: Automatic Capture And Snapshot APIs

**Files:**
- Modify: `backend/lib/drafts.js`
- Modify: `backend/routes/admin/pages.js`
- Modify: `backend/routes/preview.js`
- Modify: `backend/test/adminPages.test.js`
- Modify: `backend/test/adminPublish.test.js`

**Interfaces:**
- `applyDraftMutation(conn, node, options, fn)` captures the pre-state, applies the mutation, increments the revision, and stores the resulting snapshot before commit.
- `GET /api/admin/pages/:id/versions` returns `{ currentDraft, snapshots, publishedVersions }`.
- `GET /api/admin/pages/:id/snapshots/:snapshotId` returns snapshot metadata and structured changes.
- `POST /api/admin/pages/:id/snapshots/:snapshotId/preview` creates a `page_snapshot` preview token.
- `POST /api/admin/pages/:id/snapshots/:snapshotId/restore` restores into a new draft revision.
- `DELETE /api/admin/pages/:id/snapshots/:snapshotId` deletes only the selected automatic snapshot.

- [ ] Write failing route tests for grouped history, one snapshot per mutation, idempotent replay, retention, details, preview, restore, permissions, audit, and deletion protection.
- [ ] Integrate automatic capture into successful draft transactions and baseline creation.
- [ ] Implement grouped history and snapshot lifecycle routes.
- [ ] Extend public preview resolution for immutable `page_snapshot` tokens.
- [ ] Run focused admin page and preview tests until all pass.

### Task 3: Modal Preview Component

**Files:**
- Create: `frontend/src/components/admin/StudioPreviewModal.tsx`
- Modify: `frontend/src/app/admin/studio/page.tsx`
- Modify: `frontend/src/styles/studio.css`

**Interfaces:**
- `StudioPreviewModal` consumes `open`, `title`, `revision`, `expiresAt`, `token`, `onClose`, and `onRefreshToken`.
- Device modes are `desktop | tablet | mobile` with stable iframe widths.

- [ ] Replace `window.open` in the primary preview action with modal state populated by the existing preview endpoint.
- [ ] Implement accessible dialog semantics, Escape close, focus return, loading/error/retry, device controls, refresh, new-window open, and close.
- [ ] Add responsive modal and viewport-shell styles without changing the studio canvas.
- [ ] Run the frontend production build.

### Task 4: Understandable History Drawer

**Files:**
- Create: `frontend/src/components/admin/StudioHistoryPanel.tsx`
- Modify: `frontend/src/app/admin/studio/page.tsx`
- Modify: `frontend/src/styles/studio.css`

**Interfaces:**
- `StudioHistoryPanel` consumes grouped history, busy state, and callbacks for refresh, detail, preview, restore, and delete.
- Snapshot summary entries render human-readable component and field labels without raw JSON.

- [ ] Update studio history types and data loading for grouped history.
- [ ] Render separate current-draft, automatic-snapshot, and published-history sections.
- [ ] Add snapshot detail expansion and explicit restore/delete confirmations.
- [ ] Reload current draft and history after restore; refresh only history after delete.
- [ ] Run TypeScript and production build checks.

### Task 5: Full Verification

**Files:**
- Verify all files above.

- [ ] Run `npm test` from `backend/` and confirm zero failures.
- [ ] Run `npm run build` from `frontend/` and confirm TypeScript and all routes pass.
- [ ] Run `git diff --check` on touched files.
- [ ] In the browser, verify modal preview open/device switch/refresh/new-window/close, history grouping, detail expansion, restore confirmation, and delete confirmation.
- [ ] Verify the studio at desktop and mobile widths with no horizontal overflow or clipped controls.
