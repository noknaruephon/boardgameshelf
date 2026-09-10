// BoardGameGeek XML API2: fetch + parse for the two endpoints the sync uses.
//
//   collection?username=X&own=1&stats=1   → what a user owns
//   thing?id=1,2,3&stats=1                 → the shared per-game record
//
// Both parsers are pure (XML string in, plain objects out) so they can be
// tested against recorded fixtures without touching the network — see
// bgg.test.mjs. Every id is kept as a string: BGG ids are opaque and
// games.bgg_id is text.

import { XMLParser } from 'fast-xml-parser';
import { HttpError } from './http.js';

const BASE = 'https://boardgamegeek.com/xmlapi2';
const USER_AGENT = 'BoardgameShelf/1.0 (+https://github.com/noknaruephon/boardgameshelf)';
const FETCH_TIMEOUT_MS = 8000;

export const BGG_DOWN = "BGG isn't responding right now. Your last synced shelf is still up — try again in a few minutes.";

/**
 * One request to BGG. 202 is returned to the caller (it means "queued, ask
 * again"); anything else that isn't a 200 becomes an HttpError with copy the
 * settings page can show as is.
 */
export async function bggFetch(path, params) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const headers = { 'User-Agent': USER_AGENT, Accept: 'application/xml' };
  if (process.env.BGG_API_TOKEN) headers.Authorization = `Bearer ${process.env.BGG_API_TOKEN}`;

  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    throw new HttpError(502, BGG_DOWN, { bgg: 'unreachable' });
  }

  if (res.status === 202) return { status: 202, text: '' };
  if (res.status === 429) {
    throw new HttpError(503, 'BGG is rate-limiting us. Wait a minute and try again.', { retryable: true });
  }
  if (res.status >= 500) throw new HttpError(502, BGG_DOWN, { bgg: res.status });
  if (res.status === 401 || res.status === 403) {
    // The token hint is for whoever runs the server, not the person syncing.
    console.error(`BGG answered ${res.status}. If BGG now requires an API token, set BGG_API_TOKEN on the server.`);
    throw new HttpError(502, 'BGG refused the request. Try again in a minute.', { bgg: res.status });
  }
  if (!res.ok) throw new HttpError(502, `BGG answered ${res.status}.`, { bgg: res.status });

  return { status: 200, text: await res.text() };
}

// ---------------------------------------------------------------------------
// XML → objects
// ---------------------------------------------------------------------------

// Elements that can repeat and must always come back as arrays, even when
// there is exactly one of them.
const ALWAYS_ARRAY = new Set([
  'items.item', 'item.name', 'item.link', 'item.poll', 'poll.results', 'results.result',
  'errors.error', 'ranks.rank',
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,       // keep everything as strings; we convert on purpose
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name, jpath) => ALWAYS_ARRAY.has(jpath.split('.').slice(-2).join('.')),
});

const text = (v) => {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') return text(v['#text']);
  return String(v);
};
const attr = (node, name) => (node && node[`@_${name}`] !== undefined ? String(node[`@_${name}`]) : '');
const int = (s) => { const n = parseInt(String(s), 10); return Number.isFinite(n) ? n : null; };
const num = (s) => { const n = parseFloat(String(s)); return Number.isFinite(n) ? n : null; };
const flag = (s) => String(s) === '1';

// BGG double-encodes its descriptions: the XML carries `&amp;#10;` for a
// newline and `&amp;quot;` for a quote, so after the XML parser has decoded
// one layer a second pass is still needed. Numeric and the handful of named
// entities BGG actually emits.
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', eacute: 'é', ouml: 'ö', uuml: 'ü', auml: 'ä' };
export function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => (name.toLowerCase() in NAMED ? NAMED[name.toLowerCase()] : m));
}

/** Plain-text description: entities decoded, tags stripped, whitespace tidy. */
export function cleanDescription(raw) {
  return decodeEntities(raw)
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---- collection ----

const INVALID_USER = /invalid username/i;

/**
 * @returns {{ error: null | { kind: 'not_found' | 'private' | 'other', message: string },
 *             items: Array<object> }}
 */
export function parseCollection(xml) {
  const doc = parser.parse(xml);

  if (doc.errors) {
    const messages = (doc.errors.error || []).map((e) => text(e.message)).filter(Boolean);
    const message = messages.join(' ') || 'BGG returned an error.';
    const kind = INVALID_USER.test(message) ? 'not_found'
      : /private|not authorized|permission/i.test(message) ? 'private'
      : 'other';
    return { error: { kind, message }, items: [] };
  }

  const list = (doc.items && doc.items.item) || [];
  const items = [];
  for (const it of list) {
    const id = attr(it, 'objectid');
    if (!id) continue;
    const status = it.status || {};
    // own=1 already narrows the list, but a stale cache on BGG's side has been
    // known to leak prevowned rows — the flag is the contract, not the query.
    if (!flag(attr(status, 'own'))) continue;

    const stats = it.stats || {};
    const rating = stats.rating || {};
    const ratingValue = attr(rating, 'value');

    items.push({
      bgg_id: id,
      // The collection endpoint says "boardgame" for expansions too; the thing
      // endpoint's `type` is authoritative and overwrites this later.
      subtype: attr(it, 'subtype') === 'boardgameexpansion' ? 'boardgameexpansion' : 'boardgame',
      name: decodeEntities(text(it.name)) || `BGG #${id}`,
      year_published: int(text(it.yearpublished)),
      thumbnail_url: text(it.thumbnail) || null,
      image_url: text(it.image) || null,
      min_players: int(attr(stats, 'minplayers')),
      max_players: int(attr(stats, 'maxplayers')),
      min_playtime: int(attr(stats, 'minplaytime')),
      max_playtime: int(attr(stats, 'maxplaytime')) ?? int(attr(stats, 'playingtime')),
      bgg_rating: num(attr(rating.average, 'value')),
      owned: true,
      wishlist: flag(attr(status, 'wishlist')),
      user_rating: /^n\/a$/i.test(ratingValue) ? null : num(ratingValue),
      num_plays: int(text(it.numplays)) ?? 0,
      comment: decodeEntities(text(it.comment)).trim() || null,
    });
  }

  // BGG lists a game once per owned copy (collid differs). One row per game.
  const seen = new Set();
  return { error: null, items: items.filter((i) => !seen.has(i.bgg_id) && seen.add(i.bgg_id)) };
}

// ---- user ----

/**
 * The user endpoint answers 200 for any name; an unknown one comes back with
 * an empty id attribute. The name attribute carries BGG's canonical casing.
 * @returns {{ id: string, name: string } | null}
 */
export function parseUser(xml) {
  const doc = parser.parse(xml);
  const user = doc.user;
  if (!user) return null;
  const id = attr(user, 'id');
  if (!id) return null;
  return { id, name: attr(user, 'name') || '' };
}

/** How many items a collection response lists — for brief=1 lookups. */
export function countCollectionItems(xml) {
  const doc = parser.parse(xml);
  if (doc.errors || !doc.items) return null;
  const total = int(attr(doc.items, 'totalitems'));
  if (total !== null) return total;
  return (doc.items.item || []).length;
}

// ---- thing ----

const POLL_LABEL = { Best: 'best', Recommended: 'recommended', 'Not Recommended': 'not' };

/** { "2": "best", "3": "recommended", "5": "not" } from the numplayers poll. */
export function playerRecommendations(polls) {
  const poll = (polls || []).find((p) => attr(p, 'name') === 'suggested_numplayers');
  if (!poll || !int(attr(poll, 'totalvotes'))) return null;
  const out = {};
  for (const r of poll.results || []) {
    const n = attr(r, 'numplayers');
    if (!/^\d+$/.test(n)) continue; // "4+" rows describe beyond max players
    let best = null;
    let bestVotes = 0;
    for (const opt of r.result || []) {
      const votes = int(attr(opt, 'numvotes')) ?? 0;
      const label = POLL_LABEL[attr(opt, 'value')];
      if (label && votes > bestVotes) { best = label; bestVotes = votes; }
    }
    if (best) out[n] = best;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Every <item> in a thing response as a games row (without updated_at, which
 * the handler stamps). Items BGG did not return are simply absent.
 */
export function parseThings(xml) {
  const doc = parser.parse(xml);
  const list = (doc.items && doc.items.item) || [];
  const rows = [];
  for (const it of list) {
    const id = attr(it, 'id');
    if (!id) continue;
    const type = attr(it, 'type');
    if (type !== 'boardgame' && type !== 'boardgameexpansion') continue;

    const names = it.name || [];
    const primary = names.find((n) => attr(n, 'type') === 'primary') || names[0];
    const links = it.link || [];
    const ratings = (it.statistics && it.statistics.ratings) || {};

    rows.push({
      bgg_id: id,
      name: attr(primary, 'value') || `BGG #${id}`,
      year_published: int(attr(it.yearpublished, 'value')),
      min_players: int(attr(it.minplayers, 'value')),
      max_players: int(attr(it.maxplayers, 'value')),
      min_playtime: int(attr(it.minplaytime, 'value')) ?? int(attr(it.playingtime, 'value')),
      max_playtime: int(attr(it.maxplaytime, 'value')) ?? int(attr(it.playingtime, 'value')),
      weight: num(attr(ratings.averageweight, 'value')),
      bgg_rating: num(attr(ratings.average, 'value')),
      subtype: type,
      mechanics: links.filter((l) => attr(l, 'type') === 'boardgamemechanic').map((l) => attr(l, 'value')),
      categories: links.filter((l) => attr(l, 'type') === 'boardgamecategory').map((l) => attr(l, 'value')),
      description: cleanDescription(text(it.description)) || null,
      thumbnail_url: text(it.thumbnail) || null,
      image_url: text(it.image) || null,
      player_recommendations: playerRecommendations(it.poll),
    });
  }
  return rows;
}
