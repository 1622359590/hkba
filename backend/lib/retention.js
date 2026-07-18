// Retention policy selectors (spec: data-api §12).
//
// Pure functions that decide which rows a cleanup job may prune. They never
// touch a database; callers pass rows and the current time, and receive the
// ids safe to delete. Media referenced by published versions is excluded
// upstream and must never reach these selectors.

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_PUBLISHED_KEEP = 20;
const DEFAULT_DRAFT_MAX_AGE_DAYS = 30;
const DEFAULT_DRAFT_MIN_KEEP = 20;
const DEFAULT_TRASH_DAYS = 30;

function parseTime(value) {
  if (value == null) return null;
  // SQLite datetimes are stored as naive UTC; only strings carrying a time
  // component without an explicit timezone get the 'Z' suffix. Date-only
  // strings already parse as UTC, and ISO strings keep their own offset.
  let text = String(value).trim().replace(' ', 'T');
  if (text.length > 10 && !/([zZ]|[+-]\d{2}:?\d{2})$/.test(text)) text += 'Z';
  const time = Date.parse(text);
  return Number.isNaN(time) ? null : time;
}

function byNewest(a, b) {
  const ta = parseTime(a.published_at) ?? parseTime(a.created_at) ?? 0;
  const tb = parseTime(b.published_at) ?? parseTime(b.created_at) ?? 0;
  if (ta !== tb) return tb - ta;
  return (b.revision || 0) - (a.revision || 0);
}

// Pages keep the most recent `keep` published versions (§12). Pass all
// published/superseded versions of ONE page; returns ids eligible for prune.
function selectPublishedVersionsToPrune(versions, options = {}) {
  const keep = options.keep ?? DEFAULT_PUBLISHED_KEEP;
  const sorted = [...versions].sort(byNewest);
  return sorted.slice(keep).map((version) => version.id);
}

// Draft autosave revisions: keep at least the newest `minKeep`, and anything
// younger than `maxAgeDays`; prune the rest (§12). `now` is ms since epoch.
function selectDraftRevisionsToPrune(revisions, now, options = {}) {
  const maxAgeDays = options.maxAgeDays ?? DEFAULT_DRAFT_MAX_AGE_DAYS;
  const minKeep = options.minKeep ?? DEFAULT_DRAFT_MIN_KEEP;
  const cutoff = now - maxAgeDays * DAY_MS;
  const sorted = [...revisions].sort(byNewest);
  const prune = [];
  sorted.forEach((revision, index) => {
    if (index < minKeep) return; // newest minKeep always survive
    const created = parseTime(revision.created_at);
    if (created == null || created < cutoff) prune.push(revision.id);
  });
  return prune;
}

// Recycle bin rows are purged after `days` (§12). Items expose deleted_at.
function selectTrashToPurge(items, now, options = {}) {
  const days = options.days ?? DEFAULT_TRASH_DAYS;
  const cutoff = now - days * DAY_MS;
  return items
    .filter((item) => {
      const deleted = parseTime(item.deleted_at);
      return deleted != null && deleted < cutoff;
    })
    .map((item) => item.id);
}

module.exports = {
  DEFAULT_PUBLISHED_KEEP,
  DEFAULT_DRAFT_MAX_AGE_DAYS,
  DEFAULT_DRAFT_MIN_KEEP,
  DEFAULT_TRASH_DAYS,
  selectPublishedVersionsToPrune,
  selectDraftRevisionsToPrune,
  selectTrashToPurge,
};
