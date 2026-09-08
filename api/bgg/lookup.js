// GET /api/bgg/lookup?name=<bgg username>
//
// Live check for the onboarding form: does this BGG account exist, and
// roughly how many games does it own. Auth required, so only signed-in users
// can spend BGG requests through it. The brief collection call is deliberate:
// BGG builds the collection in the background and answers 202 the first
// time, so asking now means the real sync a moment later usually gets a 200.
//
// Returns only { found, username, count } — never BGG's XML or any other
// field. Results are cached per instance for ten minutes and each user gets
// at most one lookup a second.

import { handler, json, queryParams, HttpError } from '../_lib/http.js';
import { requireProfileOrUser } from '../_lib/supabase.js';
import { bggFetch, parseUser, countCollectionItems } from '../_lib/bgg.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
const PER_USER_INTERVAL_MS = 1000;
const NAME_RE = /^[A-Za-z0-9 ._-]{1,64}$/;

const cache = new Map();      // lowercased name → { result, expires }
const lastCall = new Map();   // user id → timestamp

function cached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) { cache.delete(key); return null; }
  return hit.result;
}

async function lookup(name) {
  let user;
  try {
    user = await bggFetch('/user', { name });
  } catch (err) {
    if (err instanceof HttpError && err.extra?.bgg === 404) return { found: false };
    throw err;
  }
  if (user.status !== 200) return { found: false };   // 202 here means BGG is busy; treat as not found for now
  const parsed = parseUser(user.text);
  if (!parsed) return { found: false };

  const username = parsed.name || name;
  const collection = await bggFetch('/collection', { username, own: 1, brief: 1, subtype: 'boardgame' });
  if (collection.status === 202) return { found: true, username, count: null };
  return { found: true, username, count: countCollectionItems(collection.text) };
}

export default handler(async (req, res) => {
  const { user } = await requireProfileOrUser(req);

  const name = String(queryParams(req).name || '').trim();
  if (!name || !NAME_RE.test(name)) throw new HttpError(400, 'Enter a BGG username.');

  const last = lastCall.get(user.id) || 0;
  if (Date.now() - last < PER_USER_INTERVAL_MS) {
    res.setHeader('Retry-After', '1');
    throw new HttpError(429, 'One lookup a second, please.', { retryAfter: 1 });
  }
  lastCall.set(user.id, Date.now());

  const key = name.toLowerCase();
  let result = cached(key);
  if (!result) {
    result = await lookup(name);
    // A 202 on the collection is worth re-asking sooner than ten minutes.
    const ttl = result.found && result.count === null ? 15 * 1000 : CACHE_TTL_MS;
    cache.set(key, { result, expires: Date.now() + ttl });
  }
  json(res, 200, result);
}, { methods: ['GET'] });
