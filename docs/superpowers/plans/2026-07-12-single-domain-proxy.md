# Single-Domain Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route browser API and uploaded-media requests through the Next.js origin so Baota needs only one reverse proxy to port `3000`.

**Architecture:** Browser code uses relative `/api/*` and `/uploads/*` URLs. Next.js rewrites both path families to Express on `127.0.0.1:37900`, while the backend CORS policy accepts explicit allowlisted origins and origins matching the forwarded request host.

**Tech Stack:** Next.js 16, React 19, Express 4, Node.js built-in test runner, GitHub Actions, Baota Nginx

## Global Constraints

- Do not expose Express directly to the public internet.
- Preserve `/api` and `/uploads` path prefixes during internal forwarding.
- Do not embed `NEXT_PUBLIC_API_URL` into browser bundles.
- Do not add wildcard CORS or weaken credential handling.
- Preserve PM2 names, ports, database files, uploads, and `www:www` ownership normalization.
- Keep local development working through the Next.js dev server on port `3000` and Express on port `37900`.

---

### Task 1: Add a Testable Same-Origin CORS Policy

**Files:**
- Create: `backend/lib/corsPolicy.js`
- Create: `backend/lib/corsPolicy.test.js`
- Modify: `backend/server.js`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `isOriginAllowed({ origin, allowedOrigins, host, forwardedHost }): boolean`.
- Consumes: the request `Origin`, `Host`, and `X-Forwarded-Host` headers plus the existing comma-separated `ALLOWED_ORIGINS` environment value.

- [ ] **Step 1: Write failing policy tests**

Use `node:test` and `node:assert/strict` to verify no-origin requests, explicit allowlist matches, same-domain forwarded-host matches, direct host matches, malformed origins, and foreign origins.

```js
test('allows the public origin when it matches the forwarded host', () => {
  assert.equal(isOriginAllowed({
    origin: 'https://hkba.btcsam.com',
    allowedOrigins: [],
    host: '127.0.0.1:37900',
    forwardedHost: 'hkba.btcsam.com',
  }), true);
});

test('rejects an unrelated origin', () => {
  assert.equal(isOriginAllowed({
    origin: 'https://attacker.example',
    allowedOrigins: ['https://hkba.btcsam.com'],
    host: 'hkba.btcsam.com',
    forwardedHost: '',
  }), false);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test backend/lib/corsPolicy.test.js`

Expected: FAIL because `backend/lib/corsPolicy.js` does not exist.

- [ ] **Step 3: Implement the policy helper**

Normalize comma-separated forwarded hosts to the first value, compare URL hosts case-insensitively, allow explicit exact origins, and return `false` for malformed origins.

```js
function isOriginAllowed({ origin, allowedOrigins, host, forwardedHost }) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHost = (forwardedHost || host || '').split(',')[0].trim().toLowerCase();
    return Boolean(requestHost) && originHost === requestHost;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Integrate the policy in Express**

Replace the static `cors({ origin })` setup with per-request options. Keep `credentials: true`; call back with `true` only when `isOriginAllowed` returns true and otherwise return `new Error('CORS blocked')` without reflecting arbitrary origins.

- [ ] **Step 5: Add and run the backend test command**

Add `"test": "node --test"` to `backend/package.json`, then run `npm test` from `backend/`.

Expected: all CORS policy tests pass.

- [ ] **Step 6: Commit the backend policy**

```bash
git add backend/lib/corsPolicy.js backend/lib/corsPolicy.test.js backend/server.js backend/package.json
git commit -m "fix: allow proxied same-origin API requests"
```

### Task 2: Move Browser Traffic to Relative Same-Origin URLs

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/adminApi.ts`
- Modify: `frontend/src/app/admin/login/page.tsx`
- Modify: `frontend/src/components/admin/FormControls.tsx`
- Modify: `frontend/next.config.ts`
- Delete: `frontend/.env.example`

**Interfaces:**
- Produces: browser fetches to `/api/*` and media URLs under `/uploads/*`.
- Consumes: Express on `http://127.0.0.1:37900` through Next.js rewrites only.

- [ ] **Step 1: Add the missing API rewrite**

Keep the existing uploads rewrite and add:

```ts
{
  source: '/api/:path*',
  destination: 'http://127.0.0.1:37900/api/:path*',
}
```

Change the uploads destination from `localhost` to `127.0.0.1` for consistency.

- [ ] **Step 2: Remove browser API origin constants**

In public API helpers, admin helpers, and login, fetch the supplied `/api/*` path directly instead of prefixing it with `NEXT_PUBLIC_API_URL`.

```ts
const res = await fetch(path, { cache: 'no-store' });
```

Keep existing methods, headers, tokens, JSON bodies, status handling, and UI error copy unchanged.

- [ ] **Step 3: Make internal media URLs relative**

For uploaded media, return or render `/uploads/*` values directly. Preserve fully qualified external `http://` and `https://` image URLs.

- [ ] **Step 4: Verify no browser code embeds the old API origin**

Run:

```bash
! rg -n 'NEXT_PUBLIC_API_URL|47\.76\.207\.64' frontend/src frontend/next.config.ts
```

Expected: no matches and exit status `0`.

- [ ] **Step 5: Run the production build**

Run: `npm run build` from `frontend/`.

Expected: compile, TypeScript, and all 19 routes complete successfully.

- [ ] **Step 6: Inspect build output for the old IP**

Run:

```bash
! rg -n '47\.76\.207\.64|NEXT_PUBLIC_API_URL' frontend/.next/static
```

Expected: no matches and exit status `0`.

- [ ] **Step 7: Commit frontend proxying**

```bash
git add frontend/next.config.ts frontend/src frontend/.env.example
git commit -m "fix: proxy browser API traffic through Next.js"
```

### Task 3: Simplify Deployment and Documentation

**Files:**
- Modify: `.github/workflows/deploy-baota.yml`
- Modify: `README.md`
- Modify: `frontend/README.md`
- Modify: `docs/BAOTA_AUTO_DEPLOY.md`

**Interfaces:**
- Consumes: the existing bundled deployment Secret and one Baota proxy to `127.0.0.1:3000`.
- Produces: deployments that do not require or generate `NEXT_PUBLIC_API_URL`.

- [ ] **Step 1: Remove production consumption of `NEXT_PUBLIC_API_URL`**

Keep the resolver parser backward-compatible, but remove `NEXT_PUBLIC_API_URL` from required validation, the remote SSH environment, and `frontend/.env.local` generation.

Make `ALLOWED_ORIGINS` optional because same-origin forwarded-host validation is now built in. Keep `JWT_SECRET`, `SSH_HOST`, and `SSH_USER` required.

- [ ] **Step 2: Update deployment documentation**

Document one Baota proxy only:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

State explicitly that old Baota `/api/` and `/uploads/` proxy entries must be deleted or disabled.

- [ ] **Step 3: Update local-development documentation**

Remove instructions to create `frontend/.env.local`. Document that the frontend dev server forwards API and uploads traffic to the backend on `37900`.

- [ ] **Step 4: Validate workflow and docs**

Run:

```bash
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/deploy-baota.yml'); puts 'workflow yaml ok'"
! rg -n 'frontend/\.env\.local|Set NEXT_PUBLIC_API_URL|public API origin' README.md frontend/README.md docs/BAOTA_AUTO_DEPLOY.md
git diff --check
```

Expected: YAML parses, obsolete instructions are absent, and diff check is clean.

- [ ] **Step 5: Commit deployment simplification**

```bash
git add .github/workflows/deploy-baota.yml README.md frontend/README.md docs/BAOTA_AUTO_DEPLOY.md
git commit -m "docs: simplify Baota to one reverse proxy"
```

### Task 4: Verify, Push, and Deploy

**Files:**
- Verify only: all files changed in Tasks 1-3

**Interfaces:**
- Consumes: the single-domain implementation and existing `btcsam/hkba` deployment workflow.
- Produces: a successful server deployment ready for the Baota proxy cleanup.

- [ ] **Step 1: Run the full local verification suite**

Run:

```bash
(cd backend && npm test)
bash backend/db/test-seed-first-deploy.sh
bash .github/scripts/test-resolve-deploy-bundle.sh
find backend -path 'backend/node_modules' -prune -o -name '*.js' -type f -print0 | xargs -0 -n1 node --check
(cd frontend && npm run build)
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/deploy-baota.yml')"
git diff --check
```

Expected: all tests, syntax checks, production build, YAML parsing, and diff checks pass.

- [ ] **Step 2: Confirm outgoing commits and clean state**

Run:

```bash
git status --short
git log --oneline btcsam/main..HEAD
```

Expected: clean worktree and only the approved single-domain work.

- [ ] **Step 3: Push and monitor deployment**

Run:

```bash
git push btcsam main
gh run list --repo btcsam/hkba --workflow 'Deploy to Baota Server' --limit 1
gh run watch RUN_ID --repo btcsam/hkba --exit-status
```

Expected: GitHub Actions completes successfully and both PM2 services remain online.

- [ ] **Step 4: Complete the Baota handoff**

Tell the operator to disable/delete the `/api/` and `/uploads/` Baota proxies and keep only `/ -> http://127.0.0.1:3000`.

After that UI change, run:

```bash
curl -fsS https://hkba.btcsam.com/api/health
curl -fsS https://hkba.btcsam.com/ >/dev/null
```

Expected: health JSON with `status: ok` and an HTTP-success homepage.
