# HKBA Overall Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the HKBA public site, CMS interaction quality, and project hygiene while preserving the current Next.js + Express + SQLite stack and Baota deployment workflow.

**Architecture:** Keep the current route map and REST API contract. Add a small set of shared frontend primitives for operation feedback and admin states, then apply them to the existing public and admin pages. Keep backend changes limited to idempotent database initialization, stable API error behavior, and upload validation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 plus existing CSS classes/inline styles, Express 4, better-sqlite3, JWT, multer.

## Global Constraints

- Preserve the current Next.js + Express + SQLite architecture.
- Keep public routes `/`, `/about`, `/news`, `/news/[id]`, `/team`, `/members`, and `/contact`.
- Keep the current API namespaces and JWT-protected admin write routes.
- Do not migrate to PostgreSQL/Prisma, Aliyun OSS, shadcn/ui, or a new API namespace in this pass.
- Keep Traditional Chinese as the default public language and preserve the existing English toggle.
- Remove grayscale partner presentation and temporary public labels such as `Partner 1` and `Untitled`.
- Preserve `.github/workflows/deploy-baota.yml`, `docs/BAOTA_AUTO_DEPLOY.md`, and deployment environment names.
- Use ASCII in new source comments and keep comments limited to non-obvious behavior.

---

## File Map

Create:

- `frontend/src/components/ui/Feedback.tsx`: shared loading, empty, error, toast, and confirmation UI.
- `frontend/src/components/admin/ActionButton.tsx`: admin button with pending and disabled states.

Modify:

- `frontend/src/app/globals.css`: shared tokens, responsive admin layout, logo/card states, focus states, and reduced-motion rules.
- `frontend/src/components/admin/FormControls.tsx`: accessible form controls and shared upload feedback.
- `frontend/src/lib/adminApi.ts`: typed error parsing and a single operation-event helper.
- `frontend/src/components/Header.tsx`: active route state and menu close behavior.
- `frontend/src/components/Footer.tsx`: link hover/focus states and contact fallback.
- `frontend/src/app/page.tsx`: public homepage states, color partner links, structured team cards, and formal fallbacks.
- `frontend/src/app/about/page.tsx`: formal data states and consistent proof sections.
- `frontend/src/app/news/page.tsx`: category filter loading/error/empty states and stable pagination.
- `frontend/src/app/news/[id]/page.tsx`: article error/loading state and latest-news navigation.
- `frontend/src/app/team/page.tsx`: structured profile cards and group empty state.
- `frontend/src/app/members/page.tsx`: color logo grid, website links, and empty state.
- `frontend/src/app/contact/page.tsx`: reset feedback on edit and stable submit states.
- `frontend/src/app/admin/layout.tsx`: navigation feedback, responsive sidebar behavior, and unread message synchronization.
- `frontend/src/app/admin/page.tsx`: wider dashboard composition and work queue presentation.
- `frontend/src/app/admin/banners/page.tsx`: pending/error/success/delete confirmation states.
- `frontend/src/app/admin/news/page.tsx`: pending/error/success/delete confirmation states.
- `frontend/src/app/admin/events/page.tsx`: pending/error/success/delete confirmation states.
- `frontend/src/app/admin/team/page.tsx`: pending/error/success/delete confirmation states.
- `frontend/src/app/admin/members/page.tsx`: pending/error/success/delete confirmation states and responsive grid.
- `frontend/src/app/admin/pages/page.tsx`: clearer page labels and save feedback.
- `frontend/src/app/admin/messages/page.tsx`: pending read/delete actions and unread event dispatch.
- `frontend/src/app/admin/settings/page.tsx`: validation and save feedback.
- `backend/db/init.js`: confirm idempotent stats/milestone defaults and deduplicate only exact legacy duplicates.
- `backend/routes/contact.js`: validate message fields and return consistent status payloads.
- `backend/routes/upload.js`: constrain upload directory input and preserve the 5 MB allowlist.
- `README.md`: update current commands and verification notes if implementation changes usage.

---

## Task 1: Shared Feedback And Admin Action Primitives

**Files:**
- Create: `frontend/src/components/ui/Feedback.tsx`
- Create: `frontend/src/components/admin/ActionButton.tsx`
- Modify: `frontend/src/lib/adminApi.ts`
- Modify: `frontend/src/components/admin/FormControls.tsx`
- Test: `frontend` production build and TypeScript check

**Interfaces:**
- `Feedback.tsx` exports `LoadingState`, `EmptyState`, `ErrorState`, `Toast`, and `ConfirmDialog` components.
- `ActionButton.tsx` exports `ActionButton({ children, pending, variant, onClick, type, disabled })`.
- `adminApi.ts` exports `adminRequestError(error: unknown): string` and `notifyAdminDataChanged(event: string): void`.

- [ ] **Step 1: Define feedback component contracts.**

Create components with explicit props:

```ts
export function LoadingState({ label }: { label?: string }): JSX.Element;
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }): JSX.Element;
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element;
export function Toast({ tone, message, onDismiss }: { tone: 'success' | 'error' | 'info'; message: string; onDismiss: () => void }): JSX.Element;
export function ConfirmDialog({ title, description, confirmLabel, onConfirm, onCancel, pending }: ConfirmDialogProps): JSX.Element;
```

Use `role="status"` for loading, `role="alert"` for errors, `aria-live="polite"` for toasts, and focus-visible styles from the global CSS.

- [ ] **Step 2: Add the shared admin action button.**

Render a native button with `aria-busy={pending}`, `disabled={disabled || pending}`, a visible `處理中...` label while pending, and the existing `btn-accent`, `btn-secondary`, and `admin-action` visual variants.

- [ ] **Step 3: Normalize admin error messages and update events.**

In `adminApi.ts`, parse JSON `{ error }` responses before falling back to `網絡錯誤，請確認後端服務是否運行`. Add:

```ts
export function notifyAdminDataChanged(event: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(`hkba:${event}`));
}
```

- [ ] **Step 4: Update `FormControls.tsx`.**

Add `id`/`htmlFor` pairing to `FormField`, `aria-label` to image removal and file inputs, reset the file input after upload, and show the accepted file rule `JPG、PNG、GIF、WebP、SVG、ICO，最大 5MB` below the upload control.

- [ ] **Step 5: Build to verify the primitives compile.**

Run `cd frontend && npm run build`.

Expected: the Next.js production build completes without TypeScript errors.

- [ ] **Step 6: Commit the shared primitives.**

```bash
git add frontend/src/components/ui/Feedback.tsx frontend/src/components/admin/ActionButton.tsx frontend/src/lib/adminApi.ts frontend/src/components/admin/FormControls.tsx
git commit -m "feat: add shared admin feedback primitives"
```

## Task 2: Global Visual System And Responsive Layout

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/components/Footer.tsx`

**Interfaces:**
- Existing classes such as `.btn-primary`, `.btn-secondary`, `.btn-accent`, `.glass-card`, `.profile-card`, `.partner-card`, `.admin-shell`, and `.admin-panel` keep their names so existing pages remain compatible.

- [ ] **Step 1: Add stable layout tokens and focus rules.**

Add CSS variables for surface, border, muted text, accent, success, danger, and content widths. Add `:focus-visible` styles for links, buttons, inputs, selects, and textareas. Add `button:disabled` and `[aria-busy="true"]` cursor/opacity rules.

- [ ] **Step 2: Make public and admin grids use available width.**

Set the admin content wrapper to `width: min(100%, 1440px)`, use `grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))` for stat cards, and use `minmax(0, 1fr)` tracks for work grids so the member page no longer leaves a fixed empty right column.

- [ ] **Step 3: Add responsive admin sidebar rules.**

At widths below 900px, keep the sidebar as a horizontal top navigation with an overflow rail or a compact toggle class, reduce content padding to 20px, and ensure tables/cards do not force viewport overflow.

- [ ] **Step 4: Add reduced-motion behavior.**

Inside `@media (prefers-reduced-motion: reduce)`, set animation and transition durations to `1ms`, disable smooth scrolling, and remove transform-based hover movement while preserving focus and color changes.

- [ ] **Step 5: Improve header active state and mobile closure.**

Use `usePathname()` in `Header.tsx` to add `aria-current="page"` and an `is-active` class. Close the mobile menu on pathname change and when Escape is pressed. Add a visible menu focus ring.

- [ ] **Step 6: Add footer link states and safe contact fallback.**

When contact info fails, render a concise `聯絡資訊暫未提供` state rather than an empty column. Add focus-visible and hover states to quick links and contact links.

- [ ] **Step 7: Run formatting checks.**

Run `cd frontend && npm run build` and inspect the generated page layout at 1440px and 390px widths in the browser.

- [ ] **Step 8: Commit the global layout work.**

```bash
git add frontend/src/app/globals.css frontend/src/components/Header.tsx frontend/src/components/Footer.tsx
git commit -m "style: tighten responsive HKBA layout system"
```

## Task 3: Public Content And Interaction Pass

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/about/page.tsx`
- Modify: `frontend/src/app/news/page.tsx`
- Modify: `frontend/src/app/news/[id]/page.tsx`
- Modify: `frontend/src/app/team/page.tsx`
- Modify: `frontend/src/app/members/page.tsx`
- Modify: `frontend/src/app/contact/page.tsx`

**Interfaces:**
- Public pages continue using `apiGet`, `apiPost`, `imgUrl`, and existing API paths.
- Partner cards use `website_url` when present and otherwise link to `/contact`.
- Public pages use `LoadingState`, `EmptyState`, and `ErrorState` for requests that currently fail silently.

- [ ] **Step 1: Add request state to each public page.**

For each `useEffect` request, track `loading`, `error`, and loaded data. Use `ErrorState` with a retry callback that reruns the page loader. Do not replace a successful empty response with fake content.

- [ ] **Step 2: Update homepage hero and section fallbacks.**

Keep the existing banner carousel, but show a formal HKBA hero when the banner endpoint is empty. Render stats only from loaded stats or the existing four official defaults. Show a section-level empty state for news, team, and partners. Keep CTA links to `/about`, `/news`, `/team`, `/members`, and `/contact`.

- [ ] **Step 3: Restore color partner links.**

Use `imgUrl(p.logo_url)` with `filter: none`, preserve the logo's aspect ratio with `object-fit: contain`, and render an external anchor with `target="_blank"` only when `website_url` is non-empty. Use `/contact` for non-linkable entries.

- [ ] **Step 4: Structure team cards.**

Render avatar, group label, full name, title, and biography in separate DOM blocks. Use `profile-card__head` for avatar/name identity and keep the title below the name so long titles wrap without overlapping the avatar.

- [ ] **Step 5: Improve news listing and detail.**

Keep category query filtering and pagination. Disable the active pagination button, show loading feedback while changing category/page, and render a retry state on API failure. On detail pages, show a clear not-found/error state and retain the latest-news section with links back to valid article IDs.

- [ ] **Step 6: Improve contact form behavior.**

Keep submit disabled while `status === 'sending'`. Attach a form-change handler that resets `sent` or `error` status to idle, keep field values after errors, and show a visible success panel with a fresh-form action after a successful submission.

- [ ] **Step 7: Verify public routes.**

Run the backend and frontend dev servers, then visit `/`, `/about`, `/news`, `/news/1` when an article exists, `/team`, `/members`, and `/contact` at desktop and narrow widths.

Expected: no silent blank sections, no grayscale partner logos, no visible placeholder names, and no clipped profile titles.

- [ ] **Step 8: Commit the public experience pass.**

```bash
git add frontend/src/app/page.tsx frontend/src/app/about/page.tsx frontend/src/app/news/page.tsx 'frontend/src/app/news/[id]/page.tsx' frontend/src/app/team/page.tsx frontend/src/app/members/page.tsx frontend/src/app/contact/page.tsx
git commit -m "feat: improve public HKBA content experience"
```

## Task 4: Admin Shell, Dashboard, And Messages

**Files:**
- Modify: `frontend/src/app/admin/layout.tsx`
- Modify: `frontend/src/app/admin/page.tsx`
- Modify: `frontend/src/app/admin/messages/page.tsx`

**Interfaces:**
- `AdminLayout` listens for `hkba:messages-updated` and `hkba:content-updated` events and refreshes the unread count.
- Message actions call `/api/contact/messages/:id/read` and `/api/contact/messages/:id` and dispatch `notifyAdminDataChanged('messages-updated')` after success.

- [ ] **Step 1: Make unread refresh event-driven and interval-safe.**

Keep one `refreshUnreadMessages` callback, subscribe once to the custom event, and add a 60-second refresh interval only while an admin token exists. Clear the interval on unmount. Keep failed count requests at zero.

- [ ] **Step 2: Improve the admin shell layout.**

Use semantic navigation labels, preserve the red dot and count, add a compact sidebar class for narrow screens, and keep the topbar content aligned with the full width of `.admin-content`.

- [ ] **Step 3: Recompose the dashboard work area.**

Use a two-column `minmax(0, 1.5fr) minmax(280px, 0.75fr)` grid on desktop and one column below 980px. Keep six stat links, but add an unread-message emphasis state and a direct “處理留言” action. Use a fixed-height progress track and text that remains readable at all widths.

- [ ] **Step 4: Add action states to messages.**

Track `loading`, `pendingId`, `error`, and `toast` in `messages/page.tsx`. Disable only the active row action, show `處理中...`, confirm deletion with `ConfirmDialog`, and dispatch the update event after read/delete.

- [ ] **Step 5: Verify unread behavior.**

Log in, open `/admin/messages`, mark an unread item read, and delete one item. Expected: the sidebar dot/count and dashboard count update without a full page reload.

- [ ] **Step 6: Commit the shell and messages work.**

```bash
git add frontend/src/app/admin/layout.tsx frontend/src/app/admin/page.tsx frontend/src/app/admin/messages/page.tsx
git commit -m "feat: streamline admin dashboard and message queue"
```

## Task 5: Admin CRUD Operation Feedback

**Files:**
- Modify: `frontend/src/app/admin/banners/page.tsx`
- Modify: `frontend/src/app/admin/news/page.tsx`
- Modify: `frontend/src/app/admin/events/page.tsx`
- Modify: `frontend/src/app/admin/team/page.tsx`
- Modify: `frontend/src/app/admin/members/page.tsx`
- Modify: `frontend/src/app/admin/pages/page.tsx`
- Modify: `frontend/src/app/admin/settings/page.tsx`

**Interfaces:**
- Every save/delete path uses `ActionButton`, `ConfirmDialog`, `ErrorState`, and `Toast` from the shared primitives.
- Successful mutations call the existing `load` function and `notifyAdminDataChanged('content-updated')`.

- [ ] **Step 1: Add explicit state variables to each CRUD page.**

Use `saving`, `deletingId`, `loading`, `error`, and `toast` state with the exact mutation lifecycle: set pending, call API, reload data, dispatch update event, show success; catch and show `adminRequestError(error)`; finally clear pending.

- [ ] **Step 2: Replace browser `confirm()` calls.**

Open `ConfirmDialog` with the selected record name and route-specific copy. Keep deletion disabled while the request is pending and close the dialog after success or cancellation.

- [ ] **Step 3: Improve list loading and empty states.**

At the top of every list page, render `LoadingState` while the first load is pending, `ErrorState` with a retry callback after failure, and `EmptyState` with the existing “新增” action when no records exist.

- [ ] **Step 4: Improve form labels and member/logo layout.**

Use `AdminCard` sections for basic information, display content, and publishing/visibility settings. Ensure member logo tiles use the available grid width and show real names or a formal missing-name label only inside admin.

- [ ] **Step 5: Validate settings before request.**

Require a non-empty old password, a new password of at least 8 characters, and matching confirmation before calling `/api/auth/change-password`. Display field-level guidance and clear the form only after success.

- [ ] **Step 6: Verify every mutation.**

For banners, news, events, team, members, pages, and settings, create one record, edit it, cancel an edit, trigger a validation/API error, and delete a test record. Expected: no double submissions, visible feedback, and list refresh after success.

- [ ] **Step 7: Commit CRUD feedback work.**

```bash
git add frontend/src/app/admin/banners/page.tsx frontend/src/app/admin/news/page.tsx frontend/src/app/admin/events/page.tsx frontend/src/app/admin/team/page.tsx frontend/src/app/admin/members/page.tsx frontend/src/app/admin/pages/page.tsx frontend/src/app/admin/settings/page.tsx
git commit -m "feat: add reliable admin mutation feedback"
```

## Task 6: Backend Hygiene And Safety Verification

**Files:**
- Modify: `backend/db/init.js`
- Modify: `backend/routes/contact.js`
- Modify: `backend/routes/upload.js`
- Modify: `README.md`

**Interfaces:**
- `POST /api/contact/message` returns `400` with `{ error: '請填寫必要信息' }` when name, email, or message is blank.
- Upload routes accept only `jpg`, `jpeg`, `png`, `gif`, `webp`, `svg`, `ico`, and `pdf`, with a 5 MB per-file limit.

- [ ] **Step 1: Add a repeatable database idempotency smoke script.**

Run this from `backend` without modifying user records:

```bash
node - <<'NODE'
const { initDatabase, getDb, closeDatabase } = require('./db/init');
initDatabase();
const first = getDb();
const before = {
  stats: first.prepare('SELECT COUNT(*) AS count FROM stats').get().count,
  milestones: first.prepare('SELECT COUNT(*) AS count FROM milestones').get().count,
};
closeDatabase();
initDatabase();
const second = getDb();
const after = {
  stats: second.prepare('SELECT COUNT(*) AS count FROM stats').get().count,
  milestones: second.prepare('SELECT COUNT(*) AS count FROM milestones').get().count,
};
console.log({ before, after });
if (before.stats !== after.stats || before.milestones !== after.milestones) process.exit(1);
closeDatabase();
NODE
```

Expected: `before` and `after` counts are identical.

- [ ] **Step 2: Validate contact messages before database writes.**

Trim name, email, and message values; reject blank required fields; preserve optional subject as an empty string. Return the existing JSON error shape so the frontend can show it directly.

- [ ] **Step 3: Constrain upload directories.**

Accept only a single safe directory name matching `/^[a-zA-Z0-9_-]+$/`; use `general` when absent or invalid. Keep the 5 MB limit and extension allowlist, and return `400` for multer file-filter and size errors through the existing error handler.

- [ ] **Step 4: Update README verification notes.**

Document the exact frontend build command, backend smoke command, local ports `3000` and `37900`, and the requirement to change the default admin password in production.

- [ ] **Step 5: Run backend verification.**

Run `cd backend && npm install`, the idempotency script, then `node server.js` and `curl http://localhost:37900/api/health`.

Expected health response includes `"status":"ok"`; public endpoints `/api/partners`, `/api/team`, and `/api/news?limit=1` return JSON.

- [ ] **Step 6: Commit backend hygiene work.**

```bash
git add backend/db/init.js backend/routes/contact.js backend/routes/upload.js README.md
git commit -m "fix: harden HKBA content and upload flows"
```

## Task 7: Full Verification And Cleanup

**Files:**
- Inspect all files under `frontend/src` and `backend`
- Remove only confirmed unreferenced files under `frontend/public`
- Modify any file that still contains a confirmed broken control or placeholder found during verification

- [ ] **Step 1: Search for known cleanup targets.**

Run:

```bash
rg -n "Partner [0-9]+|Untitled|filter:.*grayscale|confirm\(|console\.log\(|TODO|TBD" frontend backend
```

Remove or replace only matches that are user-visible or dead code. Keep intentional error logging and legitimate placeholder text inside admin-only form guidance.

- [ ] **Step 2: Run frontend build.**

```bash
cd frontend
npm run build
```

Expected: build succeeds with no TypeScript or ESLint-blocking error.

- [ ] **Step 3: Run backend smoke checks.**

Start the backend with `node server.js`, then run:

```bash
curl -fsS http://localhost:37900/api/health
curl -fsS http://localhost:37900/api/partners
curl -fsS http://localhost:37900/api/team
curl -fsS 'http://localhost:37900/api/news?limit=1'
```

Expected: each command returns JSON and the health response contains `status` equal to `ok`.

- [ ] **Step 4: Verify public and admin browser flows.**

Check desktop `1440x900` and narrow `390x844` viewports for `/`, `/about`, `/news`, `/team`, `/members`, `/contact`, `/admin`, `/admin/messages`, and `/admin/members`. Verify no horizontal overflow, no clipped card titles, no grayscale partner logos, and no large unused member-page column.

- [ ] **Step 5: Verify deployment files are unchanged in behavior.**

Run `git diff HEAD~1 -- .github/workflows/deploy-baota.yml docs/BAOTA_AUTO_DEPLOY.md` and confirm no deployment secret names, ports, or deploy path were changed by the optimization work.

- [ ] **Step 6: Review final diff and commit cleanup.**

Run `git diff --check`, `git status --short`, and `git log --oneline -8`. Commit any final cleanup with:

```bash
git add frontend backend README.md
git commit -m "chore: finish HKBA quality pass"
```

