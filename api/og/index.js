// GET /api/og
//
// The site-wide Open Graph image: a 1200×630 PNG for every page that is not
// a shelf (the landing page, /welcome, and so on). "Pick tonight's game,
// together." on the left, a fan of three abstract cards with a Play pill and
// a Pass dot on the right. No shelf data, no covers, no params. Rendered on
// the Vercel Edge runtime by @vercel/og (Satori + resvg), like the per-shelf
// image at /api/og/[username].
// See docs/og-default-spec.md and docs/mockups/og-default-mockup.html.

import { ImageResponse } from '@vercel/og';
import { loadFonts } from './_fonts.js';
import { surfaceTokens, themeFromUrl } from './_themes.js';

export const config = { runtime: 'edge' };

const SITE_URL = 'boardgameshelf.vercel.app';

// Production tokens from css/base.css. Satori has no CSS variables, so they
// are hardcoded here; keep them in step with the stylesheet. The surfaces
// (bg, ivory, the card face) come from ./_themes.js per theme; this image
// has no shelf, so it renders the default theme unless ?theme= asks for
// another (a preview, and what a themed share link would carry).
const SHARED = {
  gold: '#E4B54D', // --bgs-gold
  goldRing: 'rgba(228,181,77,0.75)', // --bgs-gold at 75%
  goldFrame: 'rgba(228,181,77,0.35)', // --bgs-gold at 35%
  play: '#5FB07F', // --bgs-vote-play
  pass: '#D9645A', // --bgs-vote-pass
};
const tokens = (theme) => ({ ...SHARED, ...surfaceTokens(theme) });

// The ink on the pill and dot, literal in the mockup.
const PLAY_INK = '#0F2418';
const PASS_INK = '#2A0F0D';

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

// The three cards, back to front. `dim` is the black overlay that stands in
// for filter: brightness(), which Satori does not support.
const CARDS = [
  { transform: 'translateX(80px) rotate(22deg)', dim: 0.28 },
  { transform: 'translateX(40px) rotate(11deg)', dim: 0.15 },
  { transform: 'rotate(0deg)', dim: 0 },
];

function CardTile({ transform, dim }, T) {
  return h('div', {
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 236,
      height: 330,
      display: 'flex',
      borderRadius: 18,
      backgroundImage: T.cardGradient,
      boxShadow: `0 0 0 2px ${T.goldRing}, 0 18px 40px rgba(0,0,0,0.45)`,
      transformOrigin: '50% 120%',
      transform,
    },
  },
    // Inner frame
    h('div', {
      style: {
        position: 'absolute',
        top: 14, right: 14, bottom: 14, left: 14,
        display: 'flex',
        borderRadius: 10,
        border: `1px solid ${T.goldFrame}`,
      },
    }),
    // Gem: 20×20 diamond centred on the 236×330 face
    h('div', {
      style: {
        position: 'absolute',
        left: 108,
        top: 155,
        width: 20,
        height: 20,
        display: 'flex',
        backgroundColor: T.gold,
        transform: 'rotate(45deg)',
        opacity: 0.7,
      },
    }),
    dim > 0 && h('div', {
      style: {
        position: 'absolute',
        top: 0, right: 0, bottom: 0, left: 0,
        display: 'flex',
        borderRadius: 18,
        backgroundColor: `rgba(0,0,0,${dim})`,
      },
    }),
  );
}

function PlayPill(T) {
  return h('div', {
    style: {
      position: 'absolute',
      left: -10,
      top: 250,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 22px 12px 16px',
      borderRadius: 999,
      backgroundColor: T.play,
      color: PLAY_INK,
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 24,
      boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
      transform: 'rotate(-6deg)',
    },
  },
    h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none' },
      h('path', {
        d: 'M5 12l5 5L20 7',
        stroke: PLAY_INK,
        'stroke-width': '3',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    ),
    'Play',
  );
}

function PassDot(T) {
  return h('div', {
    style: {
      position: 'absolute',
      right: -26,
      top: 70,
      width: 48,
      height: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 24,
      backgroundColor: T.pass,
      color: PASS_INK,
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 26,
      boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
      opacity: 0.85,
    },
  }, '×');
}

export function Card(T) {
  return h('div', {
    style: {
      position: 'relative',
      width: 1200,
      height: 630,
      display: 'flex',
      backgroundColor: T.bg,
      color: T.ivory,
      overflow: 'hidden',
    },
  },
    // Eyebrow
    h('div', {
      style: {
        position: 'absolute',
        left: 72,
        top: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'Fraunces',
        fontWeight: 500,
        fontSize: 22,
      },
    },
      h('div', { style: { width: 9, height: 9, display: 'flex', backgroundColor: T.gold, transform: 'rotate(45deg)' } }),
      h('div', null, 'BoardgameShelf'),
    ),
    // Headline
    h('div', {
      style: {
        position: 'absolute',
        left: 72,
        top: 212,
        width: 560,
        display: 'flex',
        fontFamily: 'Fraunces',
        fontWeight: 400,
        fontSize: 84,
        lineHeight: 1.02,
        letterSpacing: -0.5,
      },
    }, "Pick tonight's game, together."),
    // Sub-line
    h('div', {
      style: {
        position: 'absolute',
        left: 72,
        top: 428,
        display: 'flex',
        fontFamily: 'Inter',
        fontWeight: 400,
        fontSize: 26,
        color: T.ivory70,
      },
    }, 'Everyone swipes. The table decides.'),
    // URL
    h('div', {
      style: {
        position: 'absolute',
        left: 72,
        bottom: 52,
        display: 'flex',
        fontFamily: 'IBM Plex Mono',
        fontWeight: 400,
        fontSize: 19,
        color: T.ivory45,
      },
    }, SITE_URL),
    // Fan
    h('div', {
      style: {
        position: 'absolute',
        right: 120,
        top: 88,
        width: 300,
        height: 430,
        display: 'flex',
      },
    },
      CARDS.map((card) => CardTile(card, T)),
      PassDot(T),
      PlayPill(T),
    ),
  );
}

export default async function handler(req) {
  const url = new URL(req.url);
  const fonts = await loadFonts(url.origin);
  return new ImageResponse(Card(tokens(themeFromUrl(url))), {
    width: 1200,
    height: 630,
    fonts,
    headers: {
      'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
    },
  });
}
