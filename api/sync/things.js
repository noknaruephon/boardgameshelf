// POST /api/sync/things { ids: [...] } — step two of the sync loop.
//
// Fetches up to 20 things from BGG and upserts them into the shared games
// cache. The upsert lists only the columns BGG owns, so `extras` (curated
// content from games.json) survives every sync. Ids BGG does not return are
// skipped and reported; the client keeps going.

import { handler, json, HttpError } from '../_lib/http.js';
import { adminClient, requireProfile } from '../_lib/supabase.js';
import { bggFetch, parseThings } from '../_lib/bgg.js';
import { readBody } from '../_lib/http.js';

export const MAX_IDS = 20;

export default handler(async (req, res) => {
  // Writes go to a shared table, so a signed-in user with a profile is
  // required here too — the anon key alone must not be able to churn the cache.
  await requireProfile(req);

  const body = await readBody(req);
  const ids = Array.isArray(body.ids) ? body.ids.map(String).map((s) => s.trim()) : [];
  if (!ids.length) throw new HttpError(400, 'ids must be a non-empty array.');
  if (ids.length > MAX_IDS) throw new HttpError(400, `At most ${MAX_IDS} ids per request.`);
  if (ids.some((id) => !/^\d{1,12}$/.test(id))) throw new HttpError(400, 'ids must be BGG numeric ids.');

  const { status, text } = await bggFetch('/thing', { id: ids.join(','), stats: 1 });
  if (status === 202) { json(res, 202, { status: 'queued' }); return; }

  const now = new Date().toISOString();
  const rows = parseThings(text).map((r) => ({ ...r, updated_at: now }));

  if (rows.length) {
    const { error } = await adminClient().from('games').upsert(rows, { onConflict: 'bgg_id' });
    if (error) throw error;
  }

  const done = rows.map((r) => r.bgg_id);
  const doneSet = new Set(done);
  json(res, 200, { status: 'ok', done, skipped: ids.filter((id) => !doneSet.has(id)) });
});
