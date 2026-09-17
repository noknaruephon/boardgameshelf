// GET /api/og/<username>
//
// Open Graph image for a shelf: a 1200×630 PNG with five covers fanned like a
// hand of cards on the right and the shelf name, game count and URL on the
// left. Rendered on the Vercel Edge runtime by @vercel/og (Satori + resvg).
// See docs/og-image-spec.md and docs/mockups/og-image-mockup.html (layout C).
//
// The shelf comes from Supabase by slug: the profile's display_name, its
// owned games' covers and their count. Reads go through PostgREST with the
// anon key, so RLS decides what is visible — a private shelf is a 404 here
// exactly as it is at /u/{slug}. The `?v=` the pages put on this URL is a
// cache-buster for link previewers (display_name_updated_at); the handler
// ignores it.

import { ImageResponse } from '@vercel/og';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../js/config.js';
import { loadFonts } from './_fonts.js';
import { surfaceTokens, themeFromUrl } from './_themes.js';

export const config = { runtime: 'edge' };

const COVER_COUNT = 5;
// PostgREST's per-request cap. More than this many owned games only affects
// which covers are candidates; the count comes from Content-Range.
const GAMES_LIMIT = 1000;
const COVER_FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = 'BoardgameShelf/1.0 (+https://boardgameshelf.app)';

// Production tokens from css/base.css. Satori has no CSS variables, so they
// are hardcoded here; keep them in step with the stylesheet. The surfaces
// (bg, plate, ivory) come from ./_themes.js for the shelf owner's saved
// theme (profiles.theme, default walnut), so the preview looks like the
// shelf; ?theme= overrides it for previews.
const SHARED = {
  gold: '#E4B54D',
  goldGlow: 'rgba(228,181,77,0.16)',
};
const tokens = (theme) => ({ ...SHARED, ...surfaceTokens(theme) });

/** One PostgREST GET with the anon key. Returns the parsed rows and the response. */
async function rest(path, extraHeaders = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
      ...extraHeaders,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path.split('?')[0]} returned ${res.status}`);
  return { rows: await res.json(), res };
}

/**
 * The shelf behind /u/{slug}, or null when there is none the anon role may
 * see. Name is display_name, falling back to the BGG username and the slug
 * exactly as the shelf header does.
 */
async function loadShelf(slug) {
  const { rows } = await rest(
    `profiles?slug=eq.${encodeURIComponent(slug)}&select=id,slug,display_name,bgg_username,show_expansions,theme&limit=1`,
  );
  const p = rows[0];
  if (!p) return null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.display_name || p.bgg_username || p.slug,
    showExpansions: !!p.show_expansions,
    theme: p.theme || null,
  };
}

/**
 * Owned games in the shape pickCovers() reads ({ title, image, bggRating })
 * plus the total count. Expansions count only when the owner shows them on
 * the shelf, matching the shelf's own count line.
 */
async function loadGames(shelf) {
  const filter = shelf.showExpansions ? '' : '&games.subtype=eq.boardgame';
  const { rows, res } = await rest(
    `user_games?user_id=eq.${encodeURIComponent(shelf.id)}&owned=is.true` +
      `&select=games!inner(name,image_url,bgg_rating)${filter}&limit=${GAMES_LIMIT}`,
    { Prefer: 'count=exact' },
  );
  const games = rows.map((r) => ({
    title: r.games?.name || '',
    image: r.games?.image_url || '',
    bggRating: r.games?.bgg_rating,
  }));
  // Content-Range: 0-9/196 — the total is exact even when the rows are capped.
  const total = Number((res.headers.get('content-range') || '').split('/')[1]);
  return { games, count: Number.isFinite(total) ? total : games.length };
}

// Satori accepts plain element objects, so no React (and no JSX transform)
// is needed. Nested arrays of children are flattened, null/false are dropped,
// and a childless node gets no `children` key at all: Satori requires
// `display: flex` on any <div> whose children value is not a string, and an
// empty array would count.
function h(type, props, ...children) {
  const kids = children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);
  const el = { type, props: { ...(props || {}) } };
  if (kids.length === 1) el.props.children = kids[0];
  else if (kids.length > 1) el.props.children = kids;
  return el;
}

/**
 * Pick the covers to fan out, deterministically so the image is stable
 * between renders and cacheable: games with a full-size `image`, sorted by
 * BGG rating descending, ties by title, first `n`. Pads with cover-less
 * entries (rendered as a plate with the title) when fewer than `n` qualify.
 */
export function pickCovers(games, n) {
  const byRating = (a, b) =>
    (Number(b.bggRating) || 0) - (Number(a.bggRating) || 0) ||
    String(a.title || '').localeCompare(String(b.title || ''));
  const withImage = games
    .filter((g) => typeof g.image === 'string' && g.image.startsWith('https://'))
    .sort(byRating)
    .slice(0, n)
    .map((g) => ({ title: g.title || '', src: g.image }));
  if (withImage.length >= n) return withImage;
  const chosen = new Set(withImage.map((g) => g.title));
  const padding = games
    .filter((g) => !chosen.has(g.title))
    .sort(byRating)
    .slice(0, n - withImage.length)
    .map((g) => ({ title: g.title || '', src: null }));
  return withImage.concat(padding);
}

/** Type size for the shelf name: never lets it wrap to a third line. */
export function nameSize(name) {
  const len = String(name || '').length;
  if (len > 22) return 56;
  if (len > 14) return 72;
  return 92;
}

/**
 * Fetch a cover and return it as a data URL, or null if it cannot be loaded.
 * Doing the fetch here rather than leaving it to Satori means a missing or
 * broken cover degrades to a plate tile instead of failing the whole render.
 */
export async function coverDataUrl(src) {
  if (!src) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), COVER_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(src, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!/^image\/(jpeg|png|gif|webp)$/.test(type)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Fan geometry, index 0→4, lifted from the mockup.
const FAN = [
  'rotate(-22deg) translateY(-6px)',
  'rotate(-11deg) translateY(-16px)',
  'rotate(0deg) translateY(-22px)',
  'rotate(11deg) translateY(-16px)',
  'rotate(22deg) translateY(-6px)',
];

function Tile(cover, i, T) {
  const base = {
    position: 'absolute',
    display: 'flex',
    width: 230,
    height: 322,
    left: '50%',
    top: '50%',
    margin: '-161px 0 0 -115px',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: T.plate,
    boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
    transformOrigin: '50% 150%',
    transform: FAN[i] || FAN[2],
  };
  if (cover.src) {
    return h('div', { style: base },
      h('img', { src: cover.src, width: 230, height: 322, style: { width: '100%', height: '100%', objectFit: 'cover' } }),
    );
  }
  // No cover: plate with the title, bottom-aligned.
  return h('div', { style: { ...base, alignItems: 'flex-end', padding: 24 } },
    h('div', {
      style: {
        display: 'flex',
        fontFamily: 'Fraunces',
        fontWeight: 400,
        fontSize: 28,
        lineHeight: 1.1,
        color: T.ivory,
        letterSpacing: -0.56,
      },
    }, cover.title),
  );
}

export function Card({ shelf, count, covers, T }) {
  return h('div', {
    style: {
      width: 1200,
      height: 630,
      display: 'flex',
      backgroundColor: T.bg,
      color: T.ivory,
      overflow: 'hidden',
    },
  },
    // Copy column
    h('div', {
      style: {
        width: 560,
        padding: '64px 0 60px 64px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      },
    },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        h('div', { style: { width: 10, height: 10, borderRadius: 2, backgroundColor: T.gold, transform: 'rotate(45deg)' } }),
        h('div', { style: { fontFamily: 'Fraunces', fontWeight: 500, fontSize: 22, letterSpacing: -0.22 } }, 'BoardgameShelf'),
      ),
      h('div', { style: { display: 'flex', flexDirection: 'column' } },
        h('div', {
          style: {
            fontFamily: 'Fraunces',
            fontWeight: 400,
            fontSize: nameSize(shelf.name),
            lineHeight: 1,
            letterSpacing: -0.02 * nameSize(shelf.name),
          },
        }, shelf.name),
        h('div', { style: { display: 'flex', fontFamily: 'Inter', fontWeight: 400, fontSize: 26, color: T.ivory70, marginTop: 18 } },
          h('span', { style: { fontWeight: 600, color: T.gold } }, String(count)),
          h('span', null, ' games on the shelf'),
        ),
      ),
      h('div', { style: { fontFamily: 'IBM Plex Mono', fontWeight: 400, fontSize: 18, color: T.ivory45 } }, shelf.url),
    ),
    // Hand
    h('div', { style: { flex: 1, position: 'relative', display: 'flex' } },
      h('div', {
        style: {
          position: 'absolute',
          top: 0, right: 0, bottom: 0, left: 0,
          backgroundImage: `radial-gradient(60% 55% at 60% 62%, ${T.goldGlow}, transparent 70%)`,
        },
      }),
      covers.map((cover, i) => Tile(cover, i, T)),
    ),
  );
}

export default async function handler(req) {
  const url = new URL(req.url);
  const slug = decodeURIComponent(url.pathname.split('/').pop() || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(slug)) return new Response('Not found', { status: 404 });

  const origin = url.origin;
  const [shelf, fonts] = await Promise.all([loadShelf(slug), loadFonts(origin)]);
  if (!shelf) return new Response('Not found', { status: 404 });
  shelf.url = `${url.host}/u/${shelf.slug}`;

  const { games, count } = await loadGames(shelf);
  const picked = pickCovers(games, COVER_COUNT);
  const covers = await Promise.all(
    picked.map(async (c) => ({ title: c.title, src: await coverDataUrl(c.src) })),
  );

  const T = tokens(themeFromUrl(url) || shelf.theme);
  return new ImageResponse(Card({ shelf, count, covers, T }), {
    width: 1200,
    height: 630,
    fonts,
    headers: {
      'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
