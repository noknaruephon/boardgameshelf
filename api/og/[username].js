// GET /api/og/<username>
//
// Open Graph image for a shelf: a 1200×630 PNG with five covers fanned like a
// hand of cards on the right and the shelf name, game count and URL on the
// left. Rendered on the Vercel Edge runtime by @vercel/og (Satori + resvg).
// See docs/og-image-spec.md and docs/mockups/og-image-mockup.html (layout C).
//
// v1 serves a single known shelf from games.json. The route shape already
// matches /u/{username}; v2 swaps SHELVES + games.json for a Supabase lookup.

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const SHELVES = {
  // v1 — one known shelf. Replace with a Supabase lookup in v2.
  noknaruephon: { name: "Nok's shelf", url: 'boardgameshelf.vercel.app/u/noknaruephon' },
};

const COVER_COUNT = 5;
const COVER_FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = 'BoardgameShelf/1.0 (+https://boardgameshelf.app)';

// Production tokens from css/base.css. Satori has no CSS variables, so they
// are hardcoded here; keep them in step with the stylesheet.
const T = {
  bg: '#160F0A',
  plate: '#241A10',
  ivory: '#F4EBDA',
  ivory70: 'rgba(244,235,218,0.72)',
  ivory45: 'rgba(244,235,218,0.45)',
  gold: '#E3B04B',
  goldGlow: 'rgba(227,176,75,0.16)',
};

// Each asset URL is a string literal so the Edge bundler can pick it up as a
// bundled file — a computed path would not be resolved at build time.
const ASSETS = {
  games: new URL('../../games.json', import.meta.url),
  frauncesRegular: new URL('../../assets/fonts/Fraunces-Regular.ttf', import.meta.url),
  frauncesMedium: new URL('../../assets/fonts/Fraunces-Medium.ttf', import.meta.url),
  interRegular: new URL('../../assets/fonts/Inter-Regular.ttf', import.meta.url),
  interSemiBold: new URL('../../assets/fonts/Inter-SemiBold.ttf', import.meta.url),
  plexMonoRegular: new URL('../../assets/fonts/IBMPlexMono-Regular.ttf', import.meta.url),
};

const loadBinary = (url) => fetch(url).then((r) => r.arrayBuffer());
const loadJson = (url) => fetch(url).then((r) => r.json());

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

function Tile(cover, i) {
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

export function Card({ shelf, count, covers }) {
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
      covers.map(Tile),
    ),
  );
}

export default async function handler(req) {
  const username = decodeURIComponent(new URL(req.url).pathname.split('/').pop() || '');
  const shelf = SHELVES[username];
  if (!shelf) return new Response('Not found', { status: 404 });

  const [games, fraunces, frauncesMed, inter, interSemi, mono] = await Promise.all([
    loadJson(ASSETS.games),
    loadBinary(ASSETS.frauncesRegular),
    loadBinary(ASSETS.frauncesMedium),
    loadBinary(ASSETS.interRegular),
    loadBinary(ASSETS.interSemiBold),
    loadBinary(ASSETS.plexMonoRegular),
  ]);

  const picked = pickCovers(games, COVER_COUNT);
  const covers = await Promise.all(
    picked.map(async (c) => ({ title: c.title, src: await coverDataUrl(c.src) })),
  );

  return new ImageResponse(Card({ shelf, count: games.length, covers }), {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Fraunces', data: fraunces, weight: 400, style: 'normal' },
      { name: 'Fraunces', data: frauncesMed, weight: 500, style: 'normal' },
      { name: 'Inter', data: inter, weight: 400, style: 'normal' },
      { name: 'Inter', data: interSemi, weight: 600, style: 'normal' },
      { name: 'IBM Plex Mono', data: mono, weight: 400, style: 'normal' },
    ],
    headers: {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
