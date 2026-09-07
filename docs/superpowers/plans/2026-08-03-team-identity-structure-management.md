# Team Identity Structure Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hard-coded team identities with a database-backed identity structure that administrators can manage and that member editing, Studio, and public rendering share.

**Architecture:** A new `team_member_groups` table stores stable identity codes, bilingual labels, global order, and activation state while `team_members.group_name` remains the compatibility reference. A focused backend library enforces invariants, the existing team router exposes compatible public and authenticated management endpoints, and frontend consumers receive the same identity metadata through admin and public payloads.

**Tech Stack:** SQLite migrations, Node.js/Express, Node built-in test runner, Next.js 16, React 19, TypeScript, vanilla JavaScript helper tests.

## Global Constraints

- Seed exactly five defaults: `honorary_chairman`, `chairman`, `vice_chairman`, `committee`, and `advisor`.
- Preserve every existing non-default `team_members.group_name` as an enabled legacy identity during migration.
- Identity codes are immutable after creation and match `^[a-z0-9_]{2,40}$`.
- At least one identity must remain active.
- An identity referenced by any member cannot be deleted; return HTTP 409.
- Keep `GET /api/team/groups` compatible as an ordered array of active identity codes.
- New member assignments require an active identity; an edited member may retain its own inactive identity.
- Global identity order is the default; a member-directory component may save its own `roleOrder` override.
- Preserve unrelated and already-present user changes in overlapping files, especially `frontend/src/app/admin/team/page.tsx`, `frontend/src/app/admin/studio/PropertyForm.tsx`, `frontend/src/components/blocks/BlockRenderer.tsx`, and `backend/components/registry/definitions/association.js`.

---

### Task 1: Identity schema, defaults, and domain invariants

**Files:**
- Create: `backend/db/migrations/016_team_member_groups.sql`
- Create: `backend/lib/teamGroups.js`
- Create: `backend/lib/teamGroups.test.js`
- Modify: `backend/db/migrate.test.js`
- Modify: `backend/db/migrations-smoke.test.js`

**Interfaces:**
- Consumes: Existing `team_members.group_name` text values.
- Produces: `listTeamGroups(db, { activeOnly })`, `createTeamGroup(db, input)`, `updateTeamGroup(db, code, input)`, `reorderTeamGroups(db, codes)`, `deleteTeamGroup(db, code)`, and `assertAssignableTeamGroup(db, code, currentCode)`.

- [ ] **Step 1: Write failing migration and domain tests**

Add tests asserting the five rows and order:

```js
assert.deepEqual(
  db.prepare('SELECT code FROM team_member_groups ORDER BY sort_order, code').all().map((row) => row.code),
  ['honorary_chairman', 'chairman', 'vice_chairman', 'committee', 'advisor']
);
```

Create a legacy member before migration and assert `custom_patron` becomes an active `is_legacy = 1` row. In `teamGroups.test.js`, cover invalid codes, bilingual fallback, duplicate creation, last-active protection, complete-permutation reorder validation, 409-style in-use deletion, active assignment rejection, and retention of the member's current inactive code.

- [ ] **Step 2: Run tests to verify the schema and library are absent**

Run: `node --test backend/db/migrate.test.js backend/db/migrations-smoke.test.js backend/lib/teamGroups.test.js`

Expected: FAIL because migration 016 and `backend/lib/teamGroups.js` do not exist.

- [ ] **Step 3: Implement migration 016**

Create the table and defaults, then preserve old codes:

```sql
CREATE TABLE IF NOT EXISTS team_member_groups (
  code TEXT PRIMARY KEY,
  label_zh TEXT NOT NULL,
  label_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  is_legacy INTEGER NOT NULL DEFAULT 0 CHECK (is_legacy IN (0, 1)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO team_member_groups (code, label_zh, label_en, sort_order) VALUES
  ('honorary_chairman', '榮譽主席', 'Honorary Chairman', 10),
  ('chairman', '會長', 'Chairman', 20),
  ('vice_chairman', '副會長', 'Vice Chairman', 30),
  ('committee', '委員', 'Committee Member', 40),
  ('advisor', '顧問', 'Advisor', 50);

INSERT OR IGNORE INTO team_member_groups (code, label_zh, label_en, sort_order, is_active, is_legacy)
SELECT group_name, group_name, group_name, 1000 + MIN(id), 1, 1
FROM team_members
WHERE TRIM(group_name) <> ''
GROUP BY group_name;
```

- [ ] **Step 4: Implement the domain library**

Use a `TeamGroupError` carrying `status` and `code`. Normalize labels by trimming and falling back to the other language. Reordering must compare a de-duplicated submitted code set with every stored code inside one transaction; write `sort_order = (index + 1) * 10`. Deletion must count `team_members WHERE group_name = ?` before deleting. Updating `is_active` to false must reject the operation when it would leave zero active identities.

- [ ] **Step 5: Run focused tests**

Run: `node --test backend/db/migrate.test.js backend/db/migrations-smoke.test.js backend/lib/teamGroups.test.js`

Expected: PASS with no failures.

- [ ] **Step 6: Commit schema and domain layer**

```bash
git add backend/db/migrations/016_team_member_groups.sql backend/db/migrate.test.js backend/db/migrations-smoke.test.js backend/lib/teamGroups.js backend/lib/teamGroups.test.js
git commit -m "feat: add team identity data model"
```

### Task 2: Identity management and member validation APIs

**Files:**
- Modify: `backend/routes/team.js`
- Create: `backend/test/teamGroups.test.js`

**Interfaces:**
- Consumes: Task 1 domain functions.
- Produces: compatible `GET /api/team/groups`; authenticated `/api/team/groups/all`, `POST /api/team/groups`, `PUT /api/team/groups/order`, `PUT /api/team/groups/:code`, and `DELETE /api/team/groups/:code`.

- [ ] **Step 1: Write failing HTTP tests**

Use the existing temporary-database Express test pattern. Assert:

```js
assert.deepEqual((await get('/api/team/groups')).body, [
  'honorary_chairman', 'chairman', 'vice_chairman', 'committee', 'advisor'
]);
assert.equal((await authenticatedGet('/api/team/groups/all')).body[0].member_count, 0);
assert.equal((await authenticatedDelete('/api/team/groups/chairman')).status, 409);
```

Also test create, rename, disable, full reorder, invalid partial reorder, unknown group assignment, inactive new assignment, and retaining an unchanged inactive group while editing a member.

- [ ] **Step 2: Run the HTTP tests and confirm missing endpoints**

Run: `node --test backend/test/teamGroups.test.js`

Expected: FAIL because management endpoints are not registered.

- [ ] **Step 3: Replace hard-coded group behavior in the team router**

Register static routes before `/:id` member routes. Return admin rows shaped as:

```js
{
  code: 'chairman',
  label_zh: '會長',
  label_en: 'Chairman',
  sort_order: 20,
  is_active: 1,
  is_legacy: 0,
  member_count: 3
}
```

Map `TeamGroupError.status` to the response status and use the existing error response conventions. Call `assertAssignableTeamGroup` before both member insert and update; pass the stored member's current group to update validation.

- [ ] **Step 4: Run API and existing backend tests**

Run: `node --test backend/test/teamGroups.test.js backend/lib/teamGroups.test.js backend/test/publicContent.test.js`

Expected: PASS with no failures.

- [ ] **Step 5: Commit API behavior**

```bash
git add backend/routes/team.js backend/test/teamGroups.test.js
git commit -m "feat: expose team identity management API"
```

### Task 3: Team admin identity manager and dynamic member selector

**Files:**
- Create: `frontend/src/lib/teamGroupOrder.mjs`
- Create: `frontend/src/lib/teamGroupOrder.test.mjs`
- Create: `frontend/src/components/admin/team/TeamGroupManager.tsx`
- Modify: `frontend/src/app/admin/team/page.tsx`
- Modify: `frontend/src/styles/admin.css`

**Interfaces:**
- Consumes: Task 2 admin API rows.
- Produces: `moveTeamGroup(groups, code, direction)` and a team page with `members` / `groups` tabs.

- [ ] **Step 1: Write failing order-helper tests**

```js
assert.deepEqual(moveTeamGroup(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c']);
assert.deepEqual(moveTeamGroup(['a', 'b', 'c'], 'a', -1), ['a', 'b', 'c']);
assert.deepEqual(moveTeamGroup(['a', 'b', 'c'], 'b', 1), ['a', 'c', 'b']);
```

- [ ] **Step 2: Run the helper test and confirm failure**

Run: `node --test frontend/src/lib/teamGroupOrder.test.mjs`

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement the pure reorder helper**

Export `moveTeamGroup(codes, code, direction)` without mutating the input. Return an unchanged copy for missing codes or out-of-range moves.

- [ ] **Step 4: Build the identity manager component**

Define:

```ts
export type TeamGroup = {
  code: string;
  label_zh: string;
  label_en: string;
  sort_order: number;
  is_active: number;
  is_legacy: number;
  member_count: number;
};
```

The component loads `/api/team/groups/all`, supports add/edit modals, activation toggles, drag-and-drop plus arrow reordering, and delete confirmation. Persist every reorder with `PUT /api/team/groups/order` using `{ codes }`; restore the prior array and show a toast on failure. Disable deletion in the UI when `member_count > 0` and state the exact number of members to transfer.

- [ ] **Step 5: Replace the hard-coded member group selector**

Add tabs to `team/page.tsx`. Load group rows once and create member form options from active rows. When editing a member assigned to an inactive identity, append that row with the label suffix `（已停用）`. Keep current modal and unrelated user styling changes intact.

- [ ] **Step 6: Run helper tests and frontend build**

Run: `node --test frontend/src/lib/teamGroupOrder.test.mjs && npm run build --prefix frontend`

Expected: helper tests PASS and Next.js build exits 0.

- [ ] **Step 7: Commit admin UI**

```bash
git add frontend/src/lib/teamGroupOrder.mjs frontend/src/lib/teamGroupOrder.test.mjs frontend/src/components/admin/team/TeamGroupManager.tsx frontend/src/app/admin/team/page.tsx frontend/src/styles/admin.css
git commit -m "feat: manage team identities in admin"
```

### Task 4: Shared public identity metadata and deterministic rendering

**Files:**
- Modify: `backend/routes/publicContent.js`
- Modify: `backend/test/publicContent.test.js`
- Modify: `backend/components/registry/definitions/association.js`
- Modify: `backend/components/registry/registry.test.js`
- Modify: `frontend/src/components/blocks/BlockRenderer.tsx`
- Modify: `frontend/src/lib/selectBoardMembers.mjs`
- Modify: `frontend/src/lib/selectBoardMembers.test.mjs`
- Modify: `frontend/src/lib/publicContent.ts`

**Interfaces:**
- Consumes: Active `team_member_groups` and member `group_name` / `sort_order`.
- Produces: public association payload `groups`; renderer setting `roleOrder: string[]`; deterministic `selectPeopleByRoles(people, settings, groups)`.

- [ ] **Step 1: Write failing public payload and ordering tests**

Assert `/api/public/association` returns active groups ordered by `sort_order` with `code`, `labelZh`, `labelEn`, and `sortOrder`. Extend helper tests with:

```js
assert.deepEqual(
  selectPeopleByRoles(people, { roles: ['advisor', 'chairman'], roleOrder: ['chairman', 'advisor'] }, groups).map((person) => person.id),
  [chairmanId, advisorId]
);
```

Also test global-order fallback, inactive/unknown role omission, component role filtering, and same-role `sortOrder` then `id` ordering.

- [ ] **Step 2: Run tests and confirm missing metadata/order support**

Run: `node --test backend/test/publicContent.test.js frontend/src/lib/selectBoardMembers.test.mjs backend/components/registry/registry.test.js`

Expected: FAIL because public groups and `roleOrder` are absent.

- [ ] **Step 3: Add groups to the public association payload**

Select active identities ordered by `sort_order, code`. Add `sort_order AS sortOrder` to people and return:

```js
res.ok({ partners, people, groups, milestones, events, contact, resources: [] });
```

Update TypeScript payload types accordingly.

- [ ] **Step 4: Add component role-order schema and renderer logic**

Add `roleOrder` as an array of strings to `association.members`. Preserve the existing uncommitted member controls (`roles`, `selectedMemberIds`, `groupByRole`, bio/social/limit). Implement `selectPeopleByRoles` so selected IDs retain explicit order, otherwise identities follow component `roleOrder` then global order, and members within an identity follow `sortOrder` then `id`.

- [ ] **Step 5: Run focused backend and renderer tests**

Run: `node --test backend/test/publicContent.test.js frontend/src/lib/selectBoardMembers.test.mjs backend/components/registry/registry.test.js`

Expected: PASS with no failures.

- [ ] **Step 6: Commit public and renderer integration**

```bash
git add backend/routes/publicContent.js backend/test/publicContent.test.js backend/components/registry/definitions/association.js backend/components/registry/registry.test.js frontend/src/components/blocks/BlockRenderer.tsx frontend/src/lib/selectBoardMembers.mjs frontend/src/lib/selectBoardMembers.test.mjs frontend/src/lib/publicContent.ts
git commit -m "feat: share team identity ordering with public pages"
```

### Task 5: Studio identity selection and override ordering

**Files:**
- Create: `frontend/src/lib/memberRoleSelection.mjs`
- Create: `frontend/src/lib/memberRoleSelection.test.mjs`
- Create: `frontend/src/components/admin/studio/MemberRoleSelector.tsx`
- Modify: `frontend/src/app/admin/studio/PropertyForm.tsx`
- Modify: `frontend/src/app/admin/studio/page.tsx`
- Modify: `frontend/src/styles/studio.css`

**Interfaces:**
- Consumes: `AssocData.groups`, block `settings.roles`, and block `settings.roleOrder`.
- Produces: an accessible Studio control that selects identities and saves a component-specific order.

- [ ] **Step 1: Write failing selection-state tests**

Test that toggling a role updates `roles`, preserves `roleOrder`, prevents the final selected role from being removed, and that moving a role returns a complete selected-role order without mutating input.

- [ ] **Step 2: Run tests and confirm helper absence**

Run: `node --test frontend/src/lib/memberRoleSelection.test.mjs`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement pure selection helpers and Studio component**

`MemberRoleSelector` receives:

```ts
{
  groups: AssocGroup[];
  selected: string[];
  order: string[];
  onChange: (selected: string[], order: string[]) => void;
}
```

Render active identity rows with checkbox, bilingual label, member count, drag handle, and up/down buttons. Empty `roles` means all active groups. Once the user changes a checkbox, store an explicit non-empty selection. Display an inline message when the user attempts to remove the final selected identity.

- [ ] **Step 4: Integrate the selector into schema-driven properties**

Pass `associationData.groups` from Studio page into `PropertyForm`. For `association.members`, render `MemberRoleSelector` before generic settings and omit generic `roles` / `roleOrder` comma-separated inputs. Send updates through separate `onChange('settings', 'roles', selected)` and `onChange('settings', 'roleOrder', order)` calls.

- [ ] **Step 5: Run Studio helper tests and frontend build**

Run: `node --test frontend/src/lib/memberRoleSelection.test.mjs frontend/src/lib/teamGroupOrder.test.mjs frontend/src/lib/selectBoardMembers.test.mjs && npm run build --prefix frontend`

Expected: all helper tests PASS and build exits 0.

- [ ] **Step 6: Commit Studio controls**

```bash
git add frontend/src/lib/memberRoleSelection.mjs frontend/src/lib/memberRoleSelection.test.mjs frontend/src/components/admin/studio/MemberRoleSelector.tsx frontend/src/app/admin/studio/PropertyForm.tsx frontend/src/app/admin/studio/page.tsx frontend/src/styles/studio.css
git commit -m "feat: configure member identities in studio"
```

### Task 6: Full verification and documentation alignment

**Files:**
- Modify: `docs/superpowers/specs/2026-08-03-member-role-order-controls-design.md`

**Interfaces:**
- Consumes: Completed feature behavior.
- Produces: Documentation pointing to the five database-backed defaults and the identity-management design.

- [ ] **Step 1: Correct the earlier prototype identity document**

Replace the inferred six-role list with the five confirmed defaults and link to `2026-08-03-team-identity-structure-management-design.md`. State that additional legacy identities may appear only when existing member data requires preservation.

- [ ] **Step 2: Run all verification commands**

Run:

```bash
npm test --prefix backend
node --test frontend/src/lib/*.test.mjs
npm run build --prefix frontend
git diff --check
```

Expected: backend test suite has 0 failures, all frontend helper tests pass, production build exits 0, and `git diff --check` prints nothing.

- [ ] **Step 3: Verify migration behavior on a fresh and legacy database**

Run: `node --test backend/db/migrate.test.js backend/db/migrations-smoke.test.js`

Expected: both files pass, including five-default and legacy-preservation assertions.

- [ ] **Step 4: Commit documentation correction**

```bash
git add docs/superpowers/specs/2026-08-03-member-role-order-controls-design.md
git commit -m "docs: align member roles with managed identities"
```
