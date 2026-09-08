import { supabase } from './supabase.js';
import { getAccessToken, getUser } from './auth.js';

// The client-driven sync loop (docs/claude-code-multiuser.md §4), shared by
// settings.html and welcome.html.
//
//   1. POST /api/sync/collection until it stops answering 202 "queued"
//      (every 5 s, at most 12 tries).
//   2. POST /api/sync/things for the ids it reported missing, 20 at a time,
//      no faster than one request a second, with progress after each batch.
//   3. Stamp profiles.last_synced_at.
//
// Nothing runs on the server for longer than one BGG round-trip.

export const QUEUE_RETRY_MS = 5000;
export const QUEUE_MAX_TRIES = 12;
export const BATCH_SIZE = 20;
export const BATCH_INTERVAL_MS = 1000;

/** Seconds a batch takes end to end, for the "about 30s left" estimate. */
export const BATCH_SECONDS = 1.1;

export class SyncError extends Error {
  constructor(message, kind = 'error', status = 0) {
    super(message);
    this.kind = kind;    // 'busy' | 'not_found' | 'private' | 'down' | 'auth' | 'error'
    this.status = status;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const noop = () => {};

async function post(path, body, token) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  return { res, data };
}

function toSyncError(res, data) {
  const message = data.message || `Sync failed (${res.status}).`;
  if (res.status === 401) return new SyncError(message, 'auth', 401);
  if (res.status === 404) return new SyncError(message, 'not_found', 404);
  if (res.status === 403) return new SyncError(message, 'private', 403);
  if (res.status === 502 || res.status === 503) return new SyncError(message, 'down', res.status);
  return new SyncError(message, 'error', res.status);
}

/** User-facing copy for a failed sync. The server's own message wins when it has one. */
export function syncErrorMessage(err) {
  const kind = err instanceof SyncError ? err.kind : 'error';
  if (kind === 'busy') return 'BGG is busy, try again in a minute.';
  if (kind === 'auth') return 'Your session expired — sign in again.';
  if (kind === 'down') return err.message || 'BGG is down right now. Your last synced shelf is still up.';
  return err?.message || 'Sync failed. Try again in a minute.';
}

/**
 * Runs one full sync, reporting through callbacks. Resolves with the summary
 * on success and with null after onError; it never throws.
 *
 * @param {object}   [handlers]
 * @param {function} [handlers.onStep]     (text, { waiting }) — what the loop is doing now;
 *   `waiting` is true while BGG is still preparing the collection (202)
 * @param {function} [handlers.onProgress] (done, total) — things fetched so far
 * @param {function} [handlers.onBatch]    (games) — the games just cached:
 *   [{ bgg_id, name, thumbnail_url }]
 * @param {function} [handlers.onDone]     (summary)
 * @param {function} [handlers.onError]    (message, kind)
 * @returns {Promise<{ total:number, changed:number, removed:number, fetched:number, skipped:number }|null>}
 */
export async function runSync({
  onStep = noop, onProgress = noop, onBatch = noop, onDone = noop, onError = noop,
} = {}) {
  try {
    const token = await getAccessToken();
    const user = await getUser();
    if (!token || !user) throw new SyncError('Sign in to sync.', 'auth', 401);

    // 1. collection
    let collection = null;
    for (let attempt = 1; attempt <= QUEUE_MAX_TRIES; attempt++) {
      onStep(
        attempt > 1
          ? `BGG is preparing your collection… (try ${attempt} of ${QUEUE_MAX_TRIES})`
          : 'Asking BGG for your collection…',
        { waiting: true, attempt },
      );
      const { res, data } = await post('/api/sync/collection', {}, token);
      if (res.status === 202) { await sleep(QUEUE_RETRY_MS); continue; }
      if (!res.ok) throw toSyncError(res, data);
      collection = data;
      break;
    }
    if (!collection) throw new SyncError('BGG is busy, try again in a minute.', 'busy', 202);

    // 2. things, in batches, no faster than one a second
    const ids = collection.missing || [];
    const total = ids.length;
    let done = 0;
    let fetched = 0;
    let skipped = 0;
    onStep(total ? 'Fetching game details…' : 'Everything is already up to date.', { waiting: false });
    onProgress(done, total);

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const started = Date.now();

      let result = null;
      for (let attempt = 1; attempt <= 3 && !result; attempt++) {
        const { res, data } = await post('/api/sync/things', { ids: batch }, token);
        if (res.status === 202 || (res.status === 503 && data.retryable)) {
          // BGG queued or throttled this one; give it a moment and ask again.
          await sleep(QUEUE_RETRY_MS);
          continue;
        }
        if (!res.ok) throw toSyncError(res, data);
        result = data;
      }
      if (!result) throw new SyncError('BGG is busy, try again in a minute.', 'busy', 202);

      fetched += result.done.length;
      skipped += (result.skipped || []).length;
      done += batch.length;
      if (Array.isArray(result.games) && result.games.length) onBatch(result.games);
      onProgress(done, total);

      const elapsed = Date.now() - started;
      if (i + BATCH_SIZE < ids.length && elapsed < BATCH_INTERVAL_MS) await sleep(BATCH_INTERVAL_MS - elapsed);
    }

    // 3. done
    const { error } = await supabase
      .from('profiles')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw error;

    const summary = { total: collection.total, changed: collection.changed, removed: collection.removed, fetched, skipped };
    onStep('Done', { waiting: false });
    onDone(summary);
    return summary;
  } catch (err) {
    onError(syncErrorMessage(err), err instanceof SyncError ? err.kind : 'error');
    return null;
  }
}
