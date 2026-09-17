import { supabase } from './supabase.js';
import { DEFAULT_SHELF_SLUG } from './config.js';

// Loads a shelf from Supabase and hands it back in the shape the shelf, the
// filters, the modal and the game-night pages have consumed since games.json:
// { bggId, title, players:[min,max], time:[min,max], weight, weightScore,
//   bggRating, image, blurb, why, tag, … }. Nothing downstream had to change.
//
// Reads go through the anon key (or the signed-in user's JWT, which
// supabase-js attaches automatically); RLS decides what comes back.

const PAGE = 1000; // PostgREST's default max rows per request

const PROFILE_COLUMNS = 'id, slug, bgg_username, display_name, display_name_updated_at, is_public, show_expansions, theme, last_synced_at';

/** @returns {Promise<object|null>} null when unknown — or private and not yours */
export async function fetchProfileBySlug(slug) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('slug', String(slug || '').toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** 'public' | 'private' | null (no such shelf). See shelf_status() in the migration. */
export async function fetchShelfStatus(slug) {
  const { data, error } = await supabase.rpc('shelf_status', { p_slug: String(slug || '').toLowerCase() });
  if (error) throw error;
  return data || null;
}

// ---- row → legacy game ----

/**
 * The current theme's plate colour as a hex string, for a game with no
 * curated colour of its own. Read from the cascade (css/base.css) so it
 * follows the theme; callers append alpha digits and paint it on canvas,
 * so this has to be a real hex, never var().
 */
function plateColor() {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue('--bgs-plate').trim();
}

// /_vercel/image resizes and re-encodes a BGG cover on the edge. Widths must
// be ones listed in vercel.json. Anything that is not a BGG URL (a local
// /covers/ file, an empty string) is returned as is.
export function sizedCover(url, width) {
  if (!/^https:\/\/cf\.geekdo-images\.com\//.test(url)) return url;
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${width}&q=75`;
}

// Thresholds read off games.json: every "light" game there is under 2.0 and
// every "heavy" one 3.3 or above, with "medium" between.
export function weightBucket(score) {
  if (!(score > 0)) return 'medium';
  if (score < 2.0) return 'light';
  if (score >= 3.35) return 'heavy';
  return 'medium';
}

const MAX_BLURB = 420;
function blurbFromDescription(description) {
  const first = String(description || '').split(/\n\s*\n/)[0].trim();
  if (first.length <= MAX_BLURB) return first;
  const cut = first.slice(0, MAX_BLURB);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > MAX_BLURB / 2 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

const num = (v, fallback = 0) => (v === null || v === undefined || v === '' ? fallback : Number(v));

/**
 * One user_games row (with its `games` row embedded) → the legacy game shape.
 * Curated fields from games.json live in games.extras and win when present;
 * everything else is derived from BGG's data so a freshly synced shelf reads
 * the same way the owner's does.
 */
export function toLegacyGame(ug) {
  const g = ug.games || ug;
  const x = g.extras || {};

  const minP = num(g.min_players, 1) || 1;
  const maxP = Math.max(minP, num(g.max_players, minP) || minP);
  const minT = num(g.min_playtime, num(g.max_playtime, 0));
  const maxT = Math.max(minT, num(g.max_playtime, minT));
  const weightScore = num(g.weight, 0);
  const mechanics = Array.isArray(g.mechanics) ? g.mechanics : [];
  const categories = Array.isArray(g.categories) ? g.categories : [];

  const game = {
    bggId: String(g.bgg_id),
    title: g.name || `BGG #${g.bgg_id}`,
    players: [minP, maxP],
    time: [minT, maxT],
    weight: x.weight || weightBucket(weightScore),
    weightScore,
    bggRating: num(g.bgg_rating, 0),
    color: x.color || plateColor(),
    // Both use BGG's full cover. Its thumbnail is ~200px, which is blurry on
    // a phone at 2–3× density, and BGG signs each size into the URL so no
    // middle size can be derived. The thumbnail is only a fallback.
    image: g.image_url || g.thumbnail_url || '',
    imageLarge: g.image_url || g.thumbnail_url || '',
    // Sized through Vercel's image optimiser (vercel.json "images"). The
    // originals run to several thousand pixels a side; 197 of them decoded
    // on a phone, plus one more per detail modal, is what made iOS Safari
    // reload the shelf. 384 covers a 3x card, 1080 a 3x modal. Consumers
    // fall back to `image` when the optimiser is unavailable.
    imageSmall: sizedCover(g.image_url || g.thumbnail_url || '', 384),
    imageMid: sizedCover(g.image_url || g.thumbnail_url || '', 1080),
    blurb: x.blurb || blurbFromDescription(g.description),
    why: Array.isArray(x.why) ? x.why : [],
    // js/vibes.js keys its rules off this string; two mechanics and a
    // category stand in for the curated tag line on shelves that never had
    // one (categories carry words like "Negotiation" and "Party Game" that
    // the vibe rules look for).
    tag: x.tag || [...mechanics.slice(0, 2), ...categories.slice(0, 1)].join(' · '),
    playerRecommendations: x.playerRecommendations || g.player_recommendations || null,
    mechanics,
    categories,
    subtype: g.subtype === 'boardgameexpansion' ? 'boardgameexpansion' : 'boardgame',
    yearPublished: g.year_published ?? null,
    // the user's own collection data, when the row came from user_games
    userRating: ug.user_rating ?? null,
    numPlays: ug.num_plays ?? 0,
    comment: ug.comment ?? null,
  };

  // Optional curated fields: only present when games.json had them, so the
  // modal's "if (g.backImage)" style checks keep working unchanged.
  for (const key of ['caption', 'caption_override', 'teach', 'fingerprint', 'backImage', 'spineImage', 'tableShot']) {
    if (x[key] !== undefined && x[key] !== null) game[key] = x[key];
  }
  return game;
}

/**
 * Every owned game on a profile's shelf, in the legacy shape. Pages through
 * PostgREST's 1,000-row cap so a big collection comes back whole.
 * @param {string} profileId
 * @returns {Promise<object[]>}
 */
export async function fetchShelfGames(profileId) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('user_games')
      .select('bgg_id, owned, wishlist, user_rating, num_plays, comment, games(*)')
      .eq('user_id', profileId)
      .eq('owned', true)
      .order('bgg_id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of data) if (row.games) out.push(toLegacyGame(row));
    if (data.length < PAGE) break;
  }
  return out;
}

/**
 * Where "Back to the shelf" should go for a game night: the owner's shelf.
 * Sessions from before profiles existed (owner_id null) belong to
 * DEFAULT_SHELF_SLUG; an owner whose profile is private is invisible here,
 * so that case falls back to the front page.
 */
export async function shelfHrefForSession(session) {
  // A night started from a bag page goes back to the bag.
  if (session?.bag_id) return `/bag/${encodeURIComponent(session.bag_id)}`;
  const ownerId = session?.owner_id || null;
  if (!ownerId) return `/u/${DEFAULT_SHELF_SLUG}`;
  const { data, error } = await supabase
    .from('profiles')
    .select('slug')
    .eq('id', ownerId)
    .maybeSingle();
  if (error || !data?.slug) return '/';
  return `/u/${data.slug}`;
}

/** The label for the link shelfHrefForSession points at. */
export function backLabelForSession(session) {
  return session?.bag_id ? 'Back to the bag' : 'Back to the shelf';
}

/**
 * The games a game night was dealt from. Sessions created before profiles
 * existed have no owner_id and fall back to DEFAULT_SHELF_SLUG.
 */
export async function fetchGamesForSession(session) {
  let ownerId = session?.owner_id || null;
  if (!ownerId) {
    const fallback = await fetchProfileBySlug(DEFAULT_SHELF_SLUG);
    ownerId = fallback?.id || null;
  }
  if (!ownerId) throw new Error('no shelf for this game night');
  return fetchShelfGames(ownerId);
}
