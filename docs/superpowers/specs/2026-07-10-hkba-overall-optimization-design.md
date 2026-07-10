# HKBA Overall Experience Optimization Design

Date: 2026-07-10
Project: `/Users/mahao/hkba-club`
Status: Approved for implementation planning

## Goal

Improve HKBA Club as a complete product across the public website, CMS, interaction feedback, and code hygiene while preserving the current Next.js + Express + SQLite architecture and the existing GitHub Actions to Baota deployment workflow.

The result should feel like a credible Hong Kong blockchain industry association in public and a calm, efficient content tool for administrators.

## Scope

### Public website

Keep the existing route map and align the content hierarchy across `/`, `/about`, `/news`, `/news/[id]`, `/team`, `/members`, and `/contact`.

The homepage order is:

1. Dynamic hero/banner with clear routes to association information and contact.
2. Association summary with mission, vision, and key stats.
3. News feed with category, date, title, and a link to the full listing.
4. Advisory committee with avatar, name, role, organization identity, and biography as separate layers.
5. Partner/member logos in color, with a website link when one exists.
6. Activity and contact CTA modules.

Public content rules:

- Remove grayscale filters from partner logos and use consistent logo tiles with readable contrast.
- Replace temporary values such as `Partner 1`, `Partner 3`, and `Untitled` with real content or formal empty states.
- Use official empty, loading, and error states whenever an API returns no content or fails.
- Keep Traditional Chinese as the default language and preserve the existing English toggle and route behavior.
- Keep public motion restrained: page entry, hover, active, focus, and list transitions only.
- Respect reduced-motion preferences.
- Preserve responsive behavior: cards collapse into readable single-column layouts or intentional horizontal rails rather than compressing text.

## CMS experience

The admin surface remains under `/admin` and keeps the current API namespace and authentication model.

### Dashboard

- Use the available width for content instead of leaving large unused areas.
- Show counts for banners, news, events, team, members, and messages.
- Show unread messages as a primary work queue with a visible count.
- Show recent news with publication state and direct navigation.
- Keep concise shortcuts for the most common content operations.

### Navigation and messages

- Preserve the current sidebar information architecture.
- Improve active states, spacing, icon containers, and keyboard focus.
- Show a red unread dot and a count on the messages navigation item when unread messages exist.
- Refresh the unread state after messages are read, deleted, or updated without requiring a full reload.
- Keep the frontend preview and logout actions visible but visually secondary.

### Content operations

- All create, edit, publish, delete, and mark-read actions show a pending state and a clear success or failure result.
- Destructive actions require a confirmation dialog.
- List pages provide consistent loading, error, empty, and retry states.
- Where the current dataset supports it, add lightweight search/filter controls without changing the REST contract.
- Group form fields into basic information, display content, and publishing settings.
- Image upload controls show accepted formats, size failures, preview state, and upload errors.
- On small screens, the navigation can collapse so the content area remains usable.

## Component and styling direction

Keep the existing dark institutional system: near-black canvas, restrained elevated surfaces, blue-violet accent, bright primary text, muted secondary text, and green status treatment.

The implementation should consolidate repeated UI patterns into small local components where duplication is already affecting consistency:

- Buttons with loading/disabled states.
- Status pills and notification badges.
- Empty/error/loading panels.
- Confirmation dialogs and toast-style operation feedback.
- Shared icon wrapper and image/logo tile behavior.

Do not introduce a new UI framework or replace the current styling system in this pass. Keep public cards editorial and spacious; keep admin surfaces denser and operational.

## Performance and code hygiene

- Reduce duplicate API requests during admin navigation and use existing prefetching carefully.
- Centralize repeated API error handling and operation feedback where practical.
- Remove unused default assets and dead components only after confirming they are not referenced.
- Fix repeated default database initialization so startup does not duplicate stats or milestones.
- Keep image dimensions stable to prevent layout shifts.
- Preserve the current deployment files and environment variable contract unless a change is required for correctness.
- Avoid unrelated refactors and do not migrate SQLite, uploads, or the API namespace in this pass.

## Data and error behavior

Existing public and admin endpoints remain the source of truth. UI changes should consume current data fields such as `website_url`, role/title fields, publication state, and unread message counts.

When data is missing:

- Prefer a formal empty state with a useful next action.
- Do not expose implementation placeholders to public visitors.
- Keep admin failures actionable and concise.
- Preserve auth redirect behavior for expired or missing admin tokens.

## Verification

Implementation is complete when all of the following are verified:

- Frontend production build passes.
- Backend startup and public API smoke checks pass.
- Repeated database initialization does not increase default stats or milestone counts.
- Public routes open without runtime errors and show color partner logos, structured team cards, and formal empty states.
- Admin login, dashboard, messages, members, news, banners, team, and settings pages open successfully.
- Message unread dot/count appears, updates after read/delete, and disappears when no unread messages remain.
- Common buttons have working navigation or mutation behavior plus visible pending/success/failure feedback.
- Desktop and narrow viewport layouts do not show broken overflow, clipped text, or the previously observed unused content area.
- GitHub Actions and Baota deployment configuration remain intact.

## Non-goals

- No PostgreSQL/Prisma migration.
- No Aliyun OSS migration.
- No full shadcn/ui rewrite.
- No broad route or API namespace renaming.
- No content invention where the database does not provide an authoritative value.

