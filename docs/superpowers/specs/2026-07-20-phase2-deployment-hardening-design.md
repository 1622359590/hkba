# HKBA Phase 2 Deployment Hardening Design

## Objective

Harden the existing Baota GitHub Actions deployment for the Phase 2 CMS without
importing the superseded CMS implementation from `codex/cms-foundation`.
Deployments from `btcsam/main` must preserve production data, apply the current
versioned migrations, restart both PM2 services, and fail when the deployed site
is not healthy.

## Scope

The change is limited to deployment and operational safety:

- validate all required deployment configuration before connecting;
- write an explicit production backend environment;
- preserve SQLite databases, uploads, and database backups during `rsync`;
- create a database backup before starting the new backend;
- rely on the Phase 2 migration runner used by backend initialization;
- restart the API before rebuilding and restarting the frontend;
- run local HTTP smoke checks on the server after both services are online;
- document the required GitHub secrets and recovery procedure.

The change does not alter the Phase 2 page schema, component registry, public
content API, admin UI, or production Nginx configuration.

## Compatibility Decisions

Phase 2 is the canonical CMS model. The older migrations, page-block migration
script, backup command, and smoke command from `codex/cms-foundation` will not be
cherry-picked because they target a different migration chain and API shape.
Equivalent safeguards will use the current Phase 2 modules:

- `backend/scripts/backup-db.js` for SQLite backups;
- `backend/db/init.js` and `backend/db/migrate.js` for schema migration;
- `scripts/smoke-e2e.js` or a focused deployment smoke script for health checks;
- the current cookie-session, CSRF, RBAC, and audit implementation.

## Deployment Flow

1. Checkout the pushed `main` revision.
2. Resolve either the bundled `DEPLOY_SSH_KEY` secret or individual secrets.
3. Validate host, user, ports, deploy path, JWT secret, and initial admin password.
4. Synchronize source files while excluding runtime state and backups.
5. Write `backend/.env` with `NODE_ENV=production` and restricted origins.
6. Install backend production dependencies.
7. Back up the existing database when one is present.
8. Start or reload `hkba-api`; startup applies the Phase 2 migrations.
9. Install frontend dependencies and create a clean production build.
10. Restart `hkba-web`, save the PM2 process list, and normalize ownership.
11. Run smoke checks against the loopback frontend and API routes.

Any failed step stops the workflow. Existing database, uploads, and backups stay
on disk so the operator can restore the previous application revision and data.

## Configuration

The workflow continues to support the existing bundled deployment secret. The
resolved values must include:

- `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT`, and `DEPLOY_PATH`;
- `BACKEND_PORT` and `FRONTEND_PORT`;
- `ALLOWED_ORIGINS` and `JWT_SECRET`;
- `ADMIN_INITIAL_PASSWORD` for first-deploy initialization;
- the OpenSSH private key under `DEPLOY_SSH_KEY`.

`ADMIN_INITIAL_PASSWORD` must not be written to logs. It is only used when an
empty database needs the initial administrator account.

## Failure And Recovery

- Configuration errors fail before file synchronization.
- Backup errors fail before the new API process is started.
- Migration or API startup errors leave the backup available for restoration.
- Frontend build errors leave the existing PM2 frontend process untouched until
  a successful build is ready.
- Smoke-check failures mark the workflow failed even when PM2 reports `online`.
- Recovery uses the newest database backup plus a known-good Git revision.

## Verification

Automated verification will cover:

- shell syntax for workflow helper scripts;
- backend unit and integration tests;
- frontend production build and TypeScript checks;
- deployment configuration parsing tests;
- a local smoke run covering homepage, public content API, admin login boundary,
  and an expected 404;
- a review of workflow exclusions to confirm databases, uploads, and backups are
  never deleted by `rsync --delete`.

## Acceptance Criteria

- The Phase 2 backend test suite passes without regressions.
- The frontend production build succeeds.
- Deployment does not overwrite or delete production runtime data.
- A pre-deploy database backup is created when the database exists.
- PM2 runs `hkba-api` and `hkba-web` with production environment values.
- The workflow fails when the deployed frontend or API cannot answer smoke checks.
- The deployment guide lists every required secret and a tested rollback path.
