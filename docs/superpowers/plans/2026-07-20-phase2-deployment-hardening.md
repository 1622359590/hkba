# HKBA Phase 2 Deployment Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Phase 2 GitHub Actions deployment preserve production data, initialize credentials securely, back up SQLite safely, and prove both PM2 services are reachable before reporting success.

**Architecture:** Keep `btcsam/main` as the canonical application and add small operational units around it. Database initialization reads an optional secret with a development fallback; the backup script gains an online SQLite backup path; a dependency-free Node smoke script probes the deployed frontend and API; the existing Baota workflow orchestrates those units.

**Tech Stack:** GitHub Actions, Bash, Node.js 20, Express, better-sqlite3, Next.js 16, PM2, rsync.

## Global Constraints

- Do not import the superseded CMS migrations or page model from `codex/cms-foundation`.
- Preserve `backend/db/*.db`, SQLite sidecars, `backend/db/backups/`, and `backend/uploads/` during synchronization.
- Never print `JWT_SECRET`, `ADMIN_INITIAL_PASSWORD`, or the SSH private key.
- Keep the bundled `DEPLOY_SSH_KEY` format and individual GitHub secret overrides compatible.
- Add no runtime dependency.
- Every failed backup, migration startup, build, or smoke check must fail the deployment.

---

### Task 1: Configurable Initial Administrator Password

**Files:**
- Modify: `backend/db/init.js`
- Create: `backend/db/initAdmin.test.js`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: `process.env.ADMIN_INITIAL_PASSWORD`.
- Produces: `resolveInitialAdminPassword(): string`, used only when the `admin` row does not exist.

- [ ] **Step 1: Write the failing password-resolution tests**

Create `backend/db/initAdmin.test.js` with tests that load `init.js` under an isolated environment and assert that `resolveInitialAdminPassword()` returns the configured secret, falls back to `hkba2024` outside production, and throws in production when the secret is absent or shorter than 12 characters.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test db/initAdmin.test.js`

Expected: FAIL because `resolveInitialAdminPassword` is not exported.

- [ ] **Step 3: Implement password resolution and remove password logging**

Add a resolver equivalent to:

```js
function resolveInitialAdminPassword() {
  const configured = process.env.ADMIN_INITIAL_PASSWORD || '';
  if (configured.length >= 12) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_INITIAL_PASSWORD must contain at least 12 characters in production');
  }
  return 'hkba2024';
}
```

Use the returned value for bcrypt hashing and log only `Default admin created: admin`, never the password. Export the resolver and add the variable with guidance to `backend/.env.example`.

- [ ] **Step 4: Run focused and full backend tests**

Run: `node --test db/initAdmin.test.js`

Expected: all focused tests PASS.

Run: `npm test`

Expected: all backend tests PASS with development fallback behavior unchanged.

- [ ] **Step 5: Commit the credential hardening**

```bash
git add backend/db/init.js backend/db/initAdmin.test.js backend/.env.example
git commit -m "fix: secure initial admin provisioning"
```

### Task 2: Online-Safe Pre-Deploy SQLite Backup

**Files:**
- Modify: `backend/scripts/backup-db.js`
- Modify: `backend/test/backupDb.test.js`

**Interfaces:**
- Consumes: SQLite path, backup directory, retention days, and optional clock.
- Produces: `runOnlineBackup(options): Promise<{ backup, sizeBytes, pruned, keepDays }>` while retaining `runBackup(options)` for offline migration callers.

- [ ] **Step 1: Add a failing WAL-aware online backup test**

Extend `backend/test/backupDb.test.js` to create a WAL database with an uncheckpointed committed row, call `await runOnlineBackup(...)`, open the resulting backup, and assert that the row is readable. Also assert retention pruning still occurs.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test test/backupDb.test.js`

Expected: FAIL because `runOnlineBackup` is not exported.

- [ ] **Step 3: Implement the online backup path**

Refactor retention pruning into a shared helper. Implement `runOnlineBackup()` with a read-only `better-sqlite3` connection and `await db.backup(target)` so committed WAL data is captured consistently. Make the CLI call `runOnlineBackup()` and preserve the existing synchronous `runBackup()` export for offline content-migration code.

- [ ] **Step 4: Verify backup behavior**

Run: `node --test test/backupDb.test.js`

Expected: offline and online backup tests PASS.

Run: `npm test`

Expected: all backend tests PASS.

- [ ] **Step 5: Commit the backup change**

```bash
git add backend/scripts/backup-db.js backend/test/backupDb.test.js
git commit -m "fix: back up live sqlite databases safely"
```

### Task 3: Dependency-Free Deployment Smoke Probe

**Files:**
- Create: `scripts/deploy-smoke.js`
- Create: `scripts/deploy-smoke.test.js`

**Interfaces:**
- Consumes CLI flags `--frontend-url`, `--backend-url`, `--attempts`, and `--delay-ms`.
- Produces: exit code `0` after successful frontend `/`, direct backend `/api/health`, and proxied frontend `/api/health` checks; exit code `1` after bounded retries.

- [ ] **Step 1: Write failing probe tests**

Use Node's `http` module to create temporary healthy and unhealthy servers. Test `probeUrl(url)` status/body validation and `runSmoke(options)` retry behavior without spawning production services.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `node --test scripts/deploy-smoke.test.js`

Expected: FAIL because `scripts/deploy-smoke.js` does not exist.

- [ ] **Step 3: Implement the smoke probe**

Use built-in `fetch`, `AbortSignal.timeout(5000)`, and a small retry loop. Require homepage status `200`; require both health endpoints to return status `200` and JSON containing `{ "status": "ok" }`. Mask URL credentials by logging only protocol, host, port, and pathname.

- [ ] **Step 4: Verify smoke tests**

Run: `node --test scripts/deploy-smoke.test.js`

Expected: all smoke tests PASS and unhealthy-server failure is bounded.

- [ ] **Step 5: Commit the smoke probe**

```bash
git add scripts/deploy-smoke.js scripts/deploy-smoke.test.js
git commit -m "test: add deployment smoke probe"
```

### Task 4: Harden Bundled Secret Resolution And Baota Workflow

**Files:**
- Modify: `.github/scripts/resolve-deploy-bundle.sh`
- Modify: `.github/scripts/test-resolve-deploy-bundle.sh`
- Modify: `.github/workflows/deploy-baota.yml`
- Modify: `docs/BAOTA_AUTO_DEPLOY.md`
- Modify: `docs/admin-manual.zh.md`

**Interfaces:**
- Consumes: existing GitHub repository secrets plus `ADMIN_INITIAL_PASSWORD`.
- Produces: resolved `ADMIN_INITIAL_PASSWORD` in `$GITHUB_ENV`, production `backend/.env`, protected runtime directories, pre-deploy backup, deterministic PM2 restart, and post-deploy smoke result.

- [ ] **Step 1: Add failing resolver coverage**

Add `ADMIN_INITIAL_PASSWORD=production-password-123` to the bundled-secret fixture and assert the exact resolved environment line. Add a separate-secret override and assert it wins over the bundled value.

- [ ] **Step 2: Run resolver tests and confirm failure**

Run: `bash .github/scripts/test-resolve-deploy-bundle.sh`

Expected: FAIL because the resolver does not whitelist `ADMIN_INITIAL_PASSWORD`.

- [ ] **Step 3: Extend the resolver**

Add `bundle_ADMIN_INITIAL_PASSWORD`, accept its bundle key, mask it under GitHub Actions, and resolve it using the same separate-secret-first precedence as `JWT_SECRET`.

- [ ] **Step 4: Harden the workflow**

Update the workflow to:

```yaml
env:
  ADMIN_INITIAL_PASSWORD: ${{ secrets.ADMIN_INITIAL_PASSWORD }}
```

Require non-empty `DEPLOY_PATH`, ports, origins, JWT secret, and an initial password of at least 12 characters. Exclude `backend/db/backups/` from `rsync --delete`; create that directory on the server; write `NODE_ENV=production` and `ADMIN_INITIAL_PASSWORD` to `backend/.env` without echoing values; run `node scripts/backup-db.js` only when `backend/db/hkba.db` exists; reload/start the API; build and restart the frontend; run `node scripts/deploy-smoke.js` against loopback URLs; then normalize ownership and save PM2 state.

- [ ] **Step 5: Update operational documentation**

Document the new secret, backup location, smoke behavior, first-deploy password rule, and rollback sequence: stop API, preserve failed DB, restore selected `.bak`, restart API, verify `/api/health`, then restart frontend.

- [ ] **Step 6: Verify workflow and documentation**

Run: `bash -n .github/scripts/resolve-deploy-bundle.sh`

Expected: exit `0`.

Run: `bash .github/scripts/test-resolve-deploy-bundle.sh`

Expected: `All bundled deploy secret tests passed.`

Run: `git diff --check`

Expected: exit `0` with no whitespace errors.

- [ ] **Step 7: Commit deployment orchestration**

```bash
git add .github/scripts/resolve-deploy-bundle.sh .github/scripts/test-resolve-deploy-bundle.sh .github/workflows/deploy-baota.yml docs/BAOTA_AUTO_DEPLOY.md docs/admin-manual.zh.md
git commit -m "ci: harden phase 2 production deployment"
```

### Task 5: Full Verification And Readiness Review

**Files:**
- Modify: `docs/superpowers/plans/2026-07-20-phase2-deployment-hardening.md`

**Interfaces:**
- Consumes: completed Tasks 1-4.
- Produces: checked task boxes and recorded verification evidence in commit history and final report.

- [ ] **Step 1: Run the backend suite**

Run: `cd backend && npm test`

Expected: all tests PASS.

- [ ] **Step 2: Run deployment helper tests**

Run: `bash .github/scripts/test-resolve-deploy-bundle.sh`

Expected: all tests PASS.

Run: `node --test scripts/deploy-smoke.test.js`

Expected: all tests PASS.

- [ ] **Step 3: Run the frontend production build**

Run: `cd frontend && npm run build`

Expected: Next.js compilation, TypeScript, and route generation PASS.

- [ ] **Step 4: Review the final diff for data-loss risks**

Run: `git diff btcsam/main...HEAD -- .github/workflows/deploy-baota.yml backend/db backend/scripts scripts docs`

Expected: no command deletes databases, uploads, or backups; no secret value is printed; the workflow stops on all failed safety checks.

- [ ] **Step 5: Mark the plan complete and commit verification metadata**

Mark all completed checklist items in this plan, run `git diff --check`, stage the plan, and commit:

```bash
git add docs/superpowers/plans/2026-07-20-phase2-deployment-hardening.md
git commit -m "docs: record phase 2 deployment verification"
```
