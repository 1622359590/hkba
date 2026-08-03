# HKBA Lifecycle Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin galaxy map with a lifecycle-aware operations dashboard that guides first-time setup and surfaces only real unfinished work for established sites.

**Architecture:** A framework-independent model converts page, news, Banner, team, and message data into onboarding tasks, attention items, and recent releases. A focused React dashboard component renders the model, while the admin page remains responsible for parallel data loading, partial-failure tracking, refresh events, and search. The news center gains a query-string intent so dashboard items can open the exact draft.

**Tech Stack:** Next.js 16, React 19, TypeScript, native CSS, Node.js built-in test runner.

## Global Constraints

- Preserve the existing left navigation and all unrelated dirty-worktree changes.
- Do not add backend tables, endpoints, chart libraries, or analytics.
- Missing English may only appear as the reason attached to an unpublished page or news draft.
- Show no more than six attention items.
- A failed data source degrades locally; only total failure replaces the dashboard.
- Use real links, visible focus states, and reduced-motion fallbacks.

---

### Task 1: Lifecycle dashboard model

**Files:**
- Create: `frontend/src/lib/adminDashboardModel.mjs`
- Create: `frontend/src/lib/adminDashboardModel.test.mjs`

**Interfaces:**
- Consumes: arrays of page nodes, news rows, legacy Banner rows, legacy team rows, unread message count, and failed source names.
- Produces: `flattenDashboardPages(nodes)` and `buildAdminDashboardModel(input)` returning `{ mode, setupTasks, attentionItems, recentItems, isHealthy, completedSetupCount }`.

- [ ] **Step 1: Write failing model tests**

Cover these exact behaviors with `node:test` and `node:assert/strict`:

```js
test('uses onboarding mode before the first publication', () => {
  const model = buildAdminDashboardModel({ pages: [], news: [], banners: [], team: [], unread: 0, failed: [] });
  assert.equal(model.mode, 'onboarding');
  assert.equal(model.setupTasks.length, 5);
});

test('attaches missing English to a page draft instead of creating a separate alert', () => {
  const model = buildAdminDashboardModel({
    pages: [{ id: 'home', node_type: 'page', path: '/', title_zh: '首頁', missing_en: true, has_draft: true, is_published: true, children: [] }],
    news: [], banners: [{ is_active: 1 }], team: [{ is_active: 1 }], unread: 0, failed: [],
  });
  assert.equal(model.attentionItems.length, 1);
  assert.match(model.attentionItems[0].description, /英文/);
});

test('limits and orders real operational work', () => {
  const model = buildAdminDashboardModel(fixtureWithPageDraftsNewsDraftsMissingConfigAndMessages());
  assert.equal(model.attentionItems.length, 6);
  assert.equal(model.attentionItems[0].kind, 'page-draft');
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test frontend/src/lib/adminDashboardModel.test.mjs`

Expected: FAIL because `adminDashboardModel.mjs` does not exist.

- [ ] **Step 3: Implement the minimal pure model**

Define stable item shapes:

```js
{
  id: 'page-draft:<id>',
  kind: 'page-draft' | 'news-draft' | 'configuration' | 'message',
  title: string,
  description: string,
  href: string,
  actionLabel: string,
  priority: number,
  updatedAt: string | null,
}
```

Operational mode begins when any page or news row is published. Generate page items only for `has_draft`, news items only for `status === 'draft'`, configuration items only in operational mode, and one aggregate message item when `unread > 0`. Sort by ascending priority then descending timestamp and slice to six.

- [ ] **Step 4: Run model tests and verify GREEN**

Run: `node --test frontend/src/lib/adminDashboardModel.test.mjs`

Expected: all tests PASS with zero failures.

- [ ] **Step 5: Commit the model**

```bash
git add frontend/src/lib/adminDashboardModel.mjs frontend/src/lib/adminDashboardModel.test.mjs
git commit -m "feat: model admin dashboard lifecycle"
```

### Task 2: Lifecycle dashboard presentation

**Files:**
- Create: `frontend/src/components/admin/dashboard/LifecycleDashboard.tsx`
- Create: `frontend/src/components/admin/dashboard/LifecycleDashboard.contract.test.mjs`

**Interfaces:**
- Consumes: the Task 1 model, `failedSources: string[]`, and `onRetry: () => void`.
- Produces: onboarding, operations, healthy, partial-failure, and total-failure UI states.

- [ ] **Step 1: Write a failing presentation contract test**

Read the TSX source and assert that it contains:

```js
assert.match(source, /開始設置 HKBA 網站/);
assert.match(source, /待完成/);
assert.match(source, /網站運行正常/);
assert.match(source, /快速開始/);
assert.match(source, /最近發佈/);
assert.match(source, /href=\{item\.href\}/);
assert.doesNotMatch(source, /GalaxyMap|星系/);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node --test frontend/src/components/admin/dashboard/LifecycleDashboard.contract.test.mjs`

Expected: FAIL because the component file does not exist.

- [ ] **Step 3: Implement the presentation component**

Render:

- `DashboardSkeleton` with the final layout's block shapes.
- `DashboardFailure` when all five sources fail.
- `OnboardingDashboard` with next task, completion count, and five setup rows.
- `OperationsDashboard` with up to six attention links, four quick links, recent releases, and healthy replacement copy.
- A compact partial-sync notice listing only failed sources and a retry button.

Use semantic links and buttons; do not use click handlers on generic containers.

- [ ] **Step 4: Run the presentation contract test and verify GREEN**

Run: `node --test frontend/src/components/admin/dashboard/LifecycleDashboard.contract.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit the presentation component**

```bash
git add frontend/src/components/admin/dashboard/LifecycleDashboard.tsx frontend/src/components/admin/dashboard/LifecycleDashboard.contract.test.mjs
git commit -m "feat: add lifecycle dashboard states"
```

### Task 3: Dashboard data controller and direct news intent

**Files:**
- Modify: `frontend/src/app/admin/page.tsx`
- Modify: `frontend/src/app/admin/news/page.tsx`
- Create: `frontend/src/app/admin/dashboard.contract.test.mjs`
- Create: `frontend/src/app/admin/news/newsDeepLink.contract.test.mjs`

**Interfaces:**
- Consumes: Task 1 `buildAdminDashboardModel`, Task 2 `LifecycleDashboard`, existing `adminGet` and `adminGetData` helpers.
- Produces: live dashboard data and `/admin/news?id=<id>` deep-link behavior.

- [ ] **Step 1: Write failing controller contract tests**

The dashboard test must assert all five endpoints, both update-event names, `buildAdminDashboardModel`, `LifecycleDashboard`, and absence of `GalaxyMap`. The news test must assert `useSearchParams`, retrieval of `id`, and calling `openEditor` for that ID.

- [ ] **Step 2: Run both tests and verify RED**

Run:

```bash
node --test frontend/src/app/admin/dashboard.contract.test.mjs frontend/src/app/admin/news/newsDeepLink.contract.test.mjs
```

Expected: FAIL because the current dashboard still imports the galaxy map and the news page ignores query intents.

- [ ] **Step 3: Replace the admin dashboard controller**

In `page.tsx`:

- Preserve `GlobalSearch` and its real page/news entries.
- Load pages, 50 news rows, `/api/banners/all`, `/api/team/all`, and unread count with isolated fallbacks.
- Build the model with `useMemo`.
- Listen for `hkba:content-updated` and `hkba:messages-updated`, calling the same loader.
- Pass loading, model, failures, and retry to `LifecycleDashboard`.
- Remove all galaxy imports, icon paths, and node construction.

- [ ] **Step 4: Add news deep-link intent**

Import `useSearchParams`. Read `const requestedNewsId = searchParams.get('id')`. After `openEditor` exists, add an effect guarded by a ref so a new URL ID opens once and does not reopen after the editor closes:

```ts
useEffect(() => {
  if (!requestedNewsId || openedIntentRef.current === requestedNewsId) return;
  openedIntentRef.current = requestedNewsId;
  void openEditor(requestedNewsId);
}, [openEditor, requestedNewsId]);
```

- [ ] **Step 5: Run controller contract tests and verify GREEN**

Run the Step 2 command.

Expected: both test files PASS.

- [ ] **Step 6: Commit the controller changes**

```bash
git add frontend/src/app/admin/page.tsx frontend/src/app/admin/news/page.tsx frontend/src/app/admin/dashboard.contract.test.mjs frontend/src/app/admin/news/newsDeepLink.contract.test.mjs
git commit -m "feat: connect admin operations dashboard"
```

### Task 4: Responsive visual system and full verification

**Files:**
- Modify: `frontend/src/styles/admin.css`
- Create: `frontend/src/components/admin/dashboard/dashboardStyles.contract.test.mjs`

**Interfaces:**
- Consumes: class names emitted by `LifecycleDashboard.tsx`.
- Produces: desktop two-column layout, single-column fallback, focus states, skeletons, and reduced-motion behavior.

- [ ] **Step 1: Write a failing CSS contract test**

Assert the stylesheet contains `.admin-dashboard`, `.admin-dashboard-attention`, `.admin-dashboard-quick`, `.admin-dashboard-skeleton`, a `@media (max-width: 1100px)` rule, `:focus-visible`, and `prefers-reduced-motion` coverage for dashboard transitions.

- [ ] **Step 2: Run the CSS contract test and verify RED**

Run: `node --test frontend/src/components/admin/dashboard/dashboardStyles.contract.test.mjs`

Expected: FAIL because the new classes do not exist.

- [ ] **Step 3: Append scoped dashboard CSS**

Use existing admin tokens and radius conventions. The main operational grid is `minmax(0, 1.45fr) minmax(240px, .55fr)`, collapses below 1100px, and uses one dark emphasis surface only for the onboarding next step. Attention rows use dividers rather than nested cards. Keep transitions between 150ms and 200ms.

- [ ] **Step 4: Run unit and contract tests**

Run:

```bash
node --test \
  frontend/src/lib/adminDashboardModel.test.mjs \
  frontend/src/components/admin/dashboard/LifecycleDashboard.contract.test.mjs \
  frontend/src/app/admin/dashboard.contract.test.mjs \
  frontend/src/app/admin/news/newsDeepLink.contract.test.mjs \
  frontend/src/components/admin/dashboard/dashboardStyles.contract.test.mjs
```

Expected: all tests PASS with zero failures.

- [ ] **Step 5: Run the frontend production build**

Run: `npm run build` from `frontend`.

Expected: Next.js build exits 0 with no TypeScript errors.

- [ ] **Step 6: Verify in the browser**

At `http://localhost:61646/admin`, verify desktop rendering, no horizontal overflow, the correct lifecycle state, attention links, and zero console errors. At a viewport near 1100px, verify the quick actions move below the attention queue.

- [ ] **Step 7: Commit scoped styles and tests**

```bash
git add frontend/src/styles/admin.css frontend/src/components/admin/dashboard/dashboardStyles.contract.test.mjs
git commit -m "style: polish lifecycle admin dashboard"
```
