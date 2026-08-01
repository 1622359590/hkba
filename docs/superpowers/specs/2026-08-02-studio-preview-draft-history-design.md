# Studio Preview And Draft History Design

## Scope

Improve the page studio in two connected areas:

1. Replace the separate-window preview action with an in-studio modal preview.
2. Add durable automatic draft snapshots with understandable change summaries, preview, restore, and deletion controls.

The public renderer, bilingual content model, published-version behavior, and existing optimistic draft revision protocol remain unchanged.

## Current Behavior To Correct

The displayed draft revision is an optimistic-lock counter on one mutable draft row. It is not a list of restorable drafts. The current history endpoint lists version rows, but normal draft saves overwrite the same draft content and only increment its revision. Therefore the system cannot currently explain or restore an individual auto-save.

The new interface must label the current revision as a save revision and present automatic snapshots separately from published versions.

## Modal Preview

### Opening

The existing preview endpoint continues to issue a short-lived token for the current draft. The studio stores the returned URL, revision, and expiry time in modal state instead of immediately opening a browser window.

### Layout

The modal covers the studio with a dark overlay and a centered preview workspace. Its toolbar contains:

- Page title and draft revision.
- Token expiry time.
- Desktop, tablet, and mobile viewport controls.
- Refresh command.
- Open-in-new-window command.
- Close command.

The preview body is an iframe using the existing admin preview page. Desktop, tablet, and mobile modes constrain the iframe shell to stable widths. The modal must not close from an accidental backdrop click. Escape closes it, focus remains inside the dialog while open, and focus returns to the preview button after close.

Loading and failure states are visible inside the preview area. Retrying requests a fresh token rather than reusing an expired one.

## Automatic Snapshot Model

### Tables

Add `page_draft_snapshots` with:

- `id`
- `page_id`
- `revision`
- `source_version_id`
- `seo`
- `change_summary`
- `created_by`
- `created_at`

Add `page_draft_snapshot_blocks` with a complete copy of each block needed to restore or preview the snapshot. Snapshot blocks preserve component type/version, order, parent relationship, visibility, anchor, bilingual content, and settings.

Snapshots are independent from `page_versions`; they do not participate in publishing state or `page_nodes.draft_version_id` / `published_version_id` pointers.

### Creation

Every successful, non-replayed draft mutation creates a snapshot in the same database transaction after the mutation result is known. Replayed mutation IDs never create duplicate snapshots.

The snapshot stores the resulting draft state and a computed change summary. The initial draft state also receives a baseline snapshot when needed, so the first edit has a meaningful comparison point.

### Change Summary

The backend compares the previous and resulting draft states and stores structured data for:

- Added blocks.
- Removed blocks.
- Reordered or reparented blocks.
- Visibility changes.
- Chinese content fields changed.
- English content fields changed.
- Settings keys changed.
- SEO fields changed.

The summary uses component labels from the registry where available and falls back to component type. It does not store secrets or raw media binaries.

### Retention

Keep the newest 50 automatic snapshots per page. After creating a new snapshot, delete older snapshots and their child rows in the same transaction. Published and superseded page versions are governed by the existing page-version retention policy and are not affected.

## History API And Actions

Extend the history response into three explicit groups:

- `currentDraft`: current version ID, revision, block count, and update time.
- `snapshots`: automatic snapshots with summary counts and metadata.
- `publishedVersions`: published and superseded page versions.

Add a snapshot detail endpoint that returns the structured change summary and enough metadata for the history drawer. Add a snapshot preview-token endpoint that renders the stored snapshot through the existing preview renderer without mutating the draft.

### Restore

Restoring a snapshot replaces the current draft SEO and blocks inside one transaction, increments the draft revision, refreshes media references, and creates a new automatic snapshot describing the restore. It never changes the currently published version. The response returns the new draft revision.

### Delete

Deleting an automatic snapshot removes only that snapshot and its copied blocks. Current draft rows and published/superseded versions cannot be deleted through this action. The UI requires confirmation and disables deletion while another history action is running.

## Studio History Interface

The right history drawer contains sections for current draft, automatic snapshots, and published history.

Each automatic snapshot row shows:

- Revision and relative/absolute timestamp.
- Actor when available.
- Concise change summary, such as “Hero: modified Chinese title and button link”.
- Component count.
- Actions for details, preview, restore, and delete.

The detail view expands structured changes without dumping raw JSON. Restore and delete use explicit confirmation dialogs. After either action the studio reloads the draft and history without leaving the current page.

## Permissions And Audit

- Reading and previewing snapshots requires `content.read`.
- Restoring snapshots requires the existing rollback permission.
- Deleting snapshots requires `content.write`.
- Restore and delete actions write audit events with page ID, snapshot ID, source revision, and resulting draft revision where applicable.

## Verification

- Database migration smoke tests cover tables, constraints, indexes, and cascading snapshot-block deletion.
- Draft mutation tests prove one snapshot per successful mutation and no duplicate snapshot on idempotent replay.
- API tests cover grouped history, details, preview, restore, retention, permission checks, and protected deletion behavior.
- Frontend production build passes.
- Browser checks cover modal preview, device switching, retry/close behavior, history summaries, confirmation dialogs, and loading/error states at desktop and mobile widths.
