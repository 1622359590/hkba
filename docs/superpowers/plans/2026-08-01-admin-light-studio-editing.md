# HKBA Admin Light Studio Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a readable light admin workspace and make editing published page drafts discoverable through direct component selection.

**Architecture:** Scope a complete admin token override to `.admin-shell`, then update the existing admin and studio selectors to use those tokens. Isolate component-selection behavior in a small pure helper so canvas and outline interactions share one tested path while the existing draft API remains unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS, Node.js built-in test runner

## Global Constraints

- Public frontend colors and layout must remain unchanged.
- Existing draft creation, autosave, preview, publish, and conflict behavior must remain intact.
- Gold is reserved for primary actions and active navigation; teal is used for selection and focus.
- No new runtime dependency.

---

### Task 1: Shared studio selection behavior

**Files:**
- Create: `frontend/src/lib/studioSelection.mjs`
- Create: `frontend/src/lib/studioSelection.test.mjs`
- Modify: `frontend/src/app/admin/studio/page.tsx`

**Interfaces:**
- Produces: `selectStudioBlock(blockId, setSelectedId, setRightPane)` which selects a block and opens the property pane.
- Consumes: React state setters supplied by `StudioInner`.

- [ ] **Step 1: Write the failing test**

Create a Node test that imports `selectStudioBlock`, records both setter calls, and expects `['selected:block-1', 'pane:props']`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/studioSelection.test.mjs`

Expected: FAIL because `studioSelection.mjs` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement the pure helper, then use it for canvas selection, outline click, outline Enter, validation-problem navigation, and newly-created blocks.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/studioSelection.test.mjs`

Expected: PASS with one test.

### Task 2: Published-page editing status

**Files:**
- Modify: `frontend/src/app/admin/studio/page.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: `TreeNode.is_published`, `TreeNode.has_draft`, and current `DraftVersion`.
- Produces: `.hk-studio-status`, `.hk-status-badge`, and `.hk-studio-notice` UI states.

- [ ] **Step 1: Add explicit status copy**

Render `已發布` or `未發布` beside the page title and explain that edits are stored in a draft until republished.

- [ ] **Step 2: Style the status states**

Use compact badges and an unobtrusive notice below the top toolbar; preserve available canvas height.

- [ ] **Step 3: Verify status behavior**

Open a published page and confirm that the draft revision is visible and the copy states the live page is unaffected.

### Task 3: Scoped light admin theme

**Files:**
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Produces: admin-scoped values for `--bg`, `--surface-*`, `--text-*`, `--border-*`, `--gold`, `--cyan`, and semantic feedback colors.

- [ ] **Step 1: Define scoped admin tokens**

Set neutral light surfaces and accessible dark text on `.admin-shell` without changing root public tokens.

- [ ] **Step 2: Update hard-coded dark admin colors**

Replace dark rgba backgrounds and white-only hover colors in sidebar, panels, drawers, studio rails, fields, tables, dialogs, and status controls with admin-scoped neutral colors.

- [ ] **Step 3: Preserve interaction hierarchy**

Keep publish gold, selection/focus teal, destructive red, and unread-message red visually distinct.

### Task 4: Verification

**Files:**
- Modify only if verification exposes a scoped regression.

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: passing test/build and visual evidence.

- [ ] **Step 1: Run focused test**

Run: `node --test src/lib/studioSelection.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: Next.js build and TypeScript checks complete successfully.

- [ ] **Step 3: Inspect in browser**

Check `/admin`, `/admin/pages`, and `/admin/studio` at desktop and narrow viewport widths. Confirm readable contrast, no overlap, and automatic property drawer opening.

- [ ] **Step 4: Confirm public isolation**

Check `/` and confirm the public dark theme and layout are unchanged.
