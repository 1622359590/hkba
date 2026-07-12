# Single-Domain Proxy Design

Date: 2026-07-12
Project: `/Users/mahao/hkba-club`
Status: Approved for implementation planning

## Goal

Serve the public website, CMS, API, and uploaded media through one HTTPS origin without exposing backend ports or embedding a server IP in browser JavaScript.

Production traffic will use:

```text
Browser -> https://hkba.btcsam.com -> Baota Nginx -> Next.js :3000
Next.js /api/* -> Express :37900/api/*
Next.js /uploads/* -> Express :37900/uploads/*
```

## Frontend Request Model

- Browser-side API requests use relative paths such as `/api/banners`.
- Browser-side uploaded media uses relative paths such as `/uploads/image.webp`.
- `NEXT_PUBLIC_API_URL` is no longer embedded into browser bundles.
- Local development also uses the Next.js origin; Next.js forwards requests to the local Express backend on port `37900`.
- Fully qualified external image URLs remain unchanged.

## Next.js Rewrites

`frontend/next.config.ts` owns both internal proxy rules:

```text
/api/:path*     -> http://127.0.0.1:37900/api/:path*
/uploads/:path* -> http://127.0.0.1:37900/uploads/:path*
```

The destination keeps the original path prefix. This prevents the current Baota behavior where `/api/health` is incorrectly sent to Express as `/health`.

The backend destination remains server-only and is not exposed to browser JavaScript.

## Backend Origin Validation

The existing configured `ALLOWED_ORIGINS` allowlist remains supported.

For requests forwarded by the same-domain Next.js proxy, the backend also accepts an `Origin` when its host matches the request's forwarded host. It does not accept arbitrary origins and does not use a wildcard with credentials.

Requests without an `Origin`, including server-to-server health checks, remain allowed.

## Deployment Workflow

- Stop requiring `NEXT_PUBLIC_API_URL` during deployment validation.
- Stop generating `frontend/.env.local` in production.
- Keep parsing `NEXT_PUBLIC_API_URL` from the bundled Secret for backward compatibility, but do not consume it in the application.
- Keep `ALLOWED_ORIGINS` supported as an optional explicit allowlist.
- Preserve the existing ports, PM2 names, database paths, uploads, ownership normalization, and automatic deployment behavior.

## Baota Configuration

After the code deploys successfully, the Baota site needs only one reverse proxy:

```text
Proxy directory: /
Target URL: http://127.0.0.1:3000
```

The separate Baota `/api/` and `/uploads/` reverse proxies must be disabled or deleted so requests reach Next.js first.

Only ports `80` and `443` need public access. Ports `3000` and `37900` remain internal.

## Error Handling

- API responses preserve their existing status codes and JSON bodies through the rewrite.
- Network failures continue to use the existing public-site and CMS error states.
- CORS rejects origins that match neither the explicit allowlist nor the forwarded same-domain host.
- The deployment fails if the production build or PM2 restart fails.

## Verification

- Add focused tests for the shared browser API base and backend same-origin decision logic.
- Verify both Next.js rewrites preserve `/api` and `/uploads` prefixes.
- Run backend syntax checks and the Next.js production build.
- Push to `btcsam/hkba` and require a successful Baota deployment.
- After the two obsolete Baota proxies are removed, verify:
  - `https://hkba.btcsam.com/api/health` returns HTTP `200` JSON.
  - The homepage no longer contains `http://47.76.207.64` in its browser bundles.
  - Public homepage data, admin login, unread-message count, and uploaded media load through the HTTPS domain.

## Non-Goals

- Do not expose Express directly to the public internet.
- Do not duplicate Express routes without the `/api` prefix.
- Do not add wildcard CORS.
- Do not change database schema, authentication behavior, CMS content, or frontend visual design.
