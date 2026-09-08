// POST /api/sync/collection — step one of the client-driven sync loop.
//
// Verifies the caller, asks BGG for what their profile's bgg_username owns,
// reconciles user_games against it, and hands back the ids the client should
// push through /api/sync/things next. See docs/claude-code-multiuser.md §4.

import { handler, json, HttpError } from '../_lib/http.js';
import { adminClient, requireProfile } from '../_lib/supabase.js';
import { bggFetch, parseCollection } from '../_lib/bgg.js';

const STALE_DAYS = 30;
const CHUNK = 200;          // ids per PostgREST `in` filter — keeps URLs short
const WRITE_CHUNK = 500;    // rows per upsert
const EPOCH = '1970-01-01T00:00:00Z';

const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function selectIn(db, table, columns, column, ids) {
  const out = [];
  for (const part of chunks(ids, CHUNK)) {
    const { data, error } = await db.from(table).select(columns).in(column, part);
    if (error) throw error;
    out.push(...data);
  }
  return out;
}

const norm = (v) => (v === undefined || v === null || v === '' ? null : typeof v === 'number' ? v : (Number.isFinite(Number(v)) ? Number(v) : v));

/** True when any field the collection sync owns differs. */
function differs(current, next) {
  if (!current) return true;
  return current.owned !== next.owned
    || current.wishlist !== next.wishlist
    || norm(current.user_rating) !== norm(next.user_rating)
    || (current.num_plays ?? 0) !== next.num_plays
    || (current.comment || null) !== (next.comment || null);
}

export default handler(async (req, res) => {
  const { profile } = await requireProfile(req);
  const db = adminClient();

  const { status, text } = await bggFetch('/collection', {
    username: profile.bgg_username, own: 1, stats: 1,
  });
  if (status === 202) { json(res, 202, { status: 'queued' }); return; }

  const { error, items } = parseCollection(text);
  if (error) {
    if (error.kind === 'not_found') {
      throw new HttpError(404, `BGG has no user called “${profile.bgg_username}”. Check the spelling in Settings.`);
    }
    if (error.kind === 'private') {
      throw new HttpError(403, `BGG says this collection is private. Make it public on BGG (Collection → Settings), then sync again.`);
    }
    throw new HttpError(502, `BGG answered with an error: ${error.message}`);
  }

  const now = new Date().toISOString();
  const ids = items.map((i) => i.bgg_id);

  // 1. Make sure every owned game has a row in the cache, so the user_games
  //    foreign key holds and the shelf can render straight away. A row the
  //    cache has never seen gets the collection endpoint's name, year,
  //    players, time and pictures, stamped with the epoch so it counts as
  //    stale below and the thing loop fills in the rest. Existing rows are
  //    left alone (ignoreDuplicates) — they may carry curated extras.
  const known = new Map(
    (await selectIn(db, 'games', 'bgg_id, updated_at', 'bgg_id', ids)).map((g) => [g.bgg_id, g]),
  );
  const placeholders = items
    .filter((i) => !known.has(i.bgg_id))
    .map((i) => ({
      bgg_id: i.bgg_id, name: i.name, year_published: i.year_published,
      min_players: i.min_players, max_players: i.max_players,
      min_playtime: i.min_playtime, max_playtime: i.max_playtime,
      bgg_rating: i.bgg_rating, subtype: i.subtype,
      thumbnail_url: i.thumbnail_url, image_url: i.image_url,
      updated_at: EPOCH,
    }));
  for (const part of chunks(placeholders, WRITE_CHUNK)) {
    const { error: e } = await db.from('games').upsert(part, { onConflict: 'bgg_id', ignoreDuplicates: true });
    if (e) throw e;
  }

  // 2. Reconcile user_games. Only rows that actually changed are written —
  //    the fast path for a re-sync with nothing new is: read, compare, done.
  const { data: current, error: cErr } = await db
    .from('user_games')
    .select('bgg_id, owned, wishlist, user_rating, num_plays, comment')
    .eq('user_id', profile.id);
  if (cErr) throw cErr;
  const currentMap = new Map(current.map((r) => [r.bgg_id, r]));

  const changed = items
    .filter((i) => differs(currentMap.get(i.bgg_id), i))
    .map((i) => ({
      user_id: profile.id, bgg_id: i.bgg_id,
      owned: i.owned, wishlist: i.wishlist, user_rating: i.user_rating,
      num_plays: i.num_plays, comment: i.comment, synced_at: now,
    }));
  for (const part of chunks(changed, WRITE_CHUNK)) {
    const { error: e } = await db.from('user_games').upsert(part, { onConflict: 'user_id,bgg_id' });
    if (e) throw e;
  }

  const keep = new Set(ids);
  const removed = current.map((r) => r.bgg_id).filter((id) => !keep.has(id));
  for (const part of chunks(removed, CHUNK)) {
    const { error: e } = await db.from('user_games').delete().eq('user_id', profile.id).in('bgg_id', part);
    if (e) throw e;
  }

  // 3. What the thing loop still has to fetch: never cached, or cached more
  //    than STALE_DAYS ago. Placeholders inserted above are not in `known`,
  //    so they are in this list by construction.
  const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
  const missing = ids.filter((id) => {
    const g = known.get(id);
    return !g || new Date(g.updated_at).getTime() < cutoff;
  });

  json(res, 200, {
    status: 'ok',
    total: ids.length,
    changed: changed.length,
    removed: removed.length,
    missing,
  });
});
