// Session-expiry form guard (spec: main design §12 — an expired session must
// not lose unsaved local edits; the user is guided to re-login).
//
// When adminApi sees a 401 it dispatches `hkba:session-expired` right before
// redirecting to the login page. Pages subscribe via stashOnSessionExpired to
// snapshot their form state into sessionStorage; after re-login the login
// page returns to the original URL (?next=...), where takeFormState restores
// the snapshot. Snapshots expire after 30 minutes.

const PREFIX = 'hkba_form_stash:';
const MAX_AGE_MS = 30 * 60 * 1000;

interface StashEnvelope {
  at: number;
  data: unknown;
}

export function stashFormState(key: string, data: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify({ at: Date.now(), data } satisfies StashEnvelope));
  } catch {
    // sessionStorage may be unavailable (private mode); losing the stash is
    // acceptable and must never break the redirect flow.
  }
}

export function takeFormState<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    sessionStorage.removeItem(`${PREFIX}${key}`);
    const envelope = JSON.parse(raw) as StashEnvelope;
    if (!envelope || typeof envelope.at !== 'number' || Date.now() - envelope.at > MAX_AGE_MS) return null;
    return envelope.data as T;
  } catch {
    return null;
  }
}

// Subscribes to the session-expired event; returns an unsubscribe function
// suitable as a React effect cleanup.
export function stashOnSessionExpired(key: string, getData: () => unknown): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => stashFormState(key, getData());
  window.addEventListener('hkba:session-expired', handler);
  return () => window.removeEventListener('hkba:session-expired', handler);
}
