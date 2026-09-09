// Draws the game night invite poster onto a canvas.
//
// Every layout number here is the mockup's (docs/mockups/gamenight-invite-
// poster.html), Story first with Square alongside, and each text line is
// placed the way CSS would place it: a line box of `size × line-height` with
// the glyphs' ascent + descent centred in it. Nothing is eyeballed.
//
// Colours come from the --bgs-* tokens on <html> at render time; there are
// no colour literals in this file. Covers load through /api/cover so the
// canvas stays untainted and toBlob() keeps working; a cover that fails
// falls back to the game's curated colour plate with its title set in
// Fraunces, exactly as the mockup's placeholder plates do.
//
// No link and no QR: until there is an RSVP page there is nothing for
// them to point at, so the poster says only what the host knows — the
// games, and the date and place when set.

export const STRIP_MAX = 5;

const W = 1080;

// Story values, Square alongside — the spec's layout table, in px.
// The text block hangs from the bottom margin (footBottom) and the hero
// fills everything above it, reaching `heroOverlap` below the block's top so
// the fade carries the eyebrow. Less text — no date, no place, a one-line
// title — means more artwork, never a gap.
const LAYOUT = {
  story: {
    h: 1920, footBottom: 88, heroOverlap: 120, heroMin: 0.4,
    title: 128, titleFloor: 96,
    tile: 150, gap: 22, tileFont: 26, tilePad: 12, plusFont: 40, caption: 34, stripTop: 44,
    hairlineTop: 56, footTop: 40, date: 44, venue: 34,
  },
  square: {
    h: 1080, footBottom: 60, heroOverlap: 100, heroMin: 0.4,
    title: 84, titleFloor: 64,
    tile: 104, gap: 16, tileFont: 18, tilePad: 8, plusFont: 28, caption: 24, stripTop: 26,
    hairlineTop: 36, footTop: 26, date: 32, venue: 24,
  },
};

// Shared by both formats.
const INSET = 80;
const FADE = 0.46;                       // bottom share of the hero under the fade
const EYEBROW = { font: 34, lh: 1.3 };
const TITLE = { top: 12, maxW: 920, step: 8, lh: 1, tracking: -0.02 };
const PLATE = { font: 96, pad: 120, lh: 1 }; // hero placeholder title
const TILE_RADIUS = 10;
const CAPTION = { lh: 1.35, gap: 8 };    // .say has margin-left 8 on top of the flex gap
const FOOT = { dateLh: 1.2, venueLh: 1.3, venueTop: 6 };

const FONTS = {
  display: '"Fraunces", Georgia, serif',
  ui: '"Inter", system-ui, sans-serif',
  mono: '"IBM Plex Mono", monospace',
};

// ---- colours: tokens only ----

function hexToRgbList(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  const read = name => cs.getPropertyValue(name).trim();
  const rgb = name => read(`${name}-rgb`) || hexToRgbList(read(name));
  return {
    bg: read('--bgs-bg'), plate: read('--bgs-plate'), ivory: read('--bgs-ivory'), gold: read('--bgs-gold'),
    bgRgb: rgb('--bgs-bg'), ivoryRgb: rgb('--bgs-ivory'), goldRgb: rgb('--bgs-gold'),
  };
}

// ---- fonts ----

// Waits for the faces at the weights used, but never more than a moment:
// a font that fails to load must not block sharing.
async function loadFonts(L) {
  if (!document.fonts?.load) return;
  const faces = [
    `300 ${L.title}px Fraunces`, `400 ${PLATE.font}px Fraunces`,
    `400 ${EYEBROW.font}px Inter`,
    `500 ${L.date}px "IBM Plex Mono"`,
  ];
  const timeout = new Promise(resolve => setTimeout(resolve, 3000));
  await Promise.race([Promise.allSettled(faces.map(f => document.fonts.load(f))), timeout]);
}

// ---- text ----

const HAS_LETTER_SPACING = typeof CanvasRenderingContext2D !== 'undefined'
  && 'letterSpacing' in CanvasRenderingContext2D.prototype;

function setFont(ctx, weight, size, family, tracking = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx._tracking = tracking * size;
  if (HAS_LETTER_SPACING) ctx.letterSpacing = `${ctx._tracking}px`;
}

function textWidth(ctx, text) {
  const w = ctx.measureText(text).width;
  return HAS_LETTER_SPACING || !ctx._tracking ? w : w + ctx._tracking * Math.max(0, text.length - 1);
}

function fillText(ctx, text, x, y) {
  if (HAS_LETTER_SPACING || !ctx._tracking) { ctx.fillText(text, x, y); return; }
  let cx = x;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + ctx._tracking; }
}

// Baseline y for a CSS line box of height size×lh whose top is `top`.
function baseline(ctx, top, size, lh) {
  const m = ctx.measureText('Hg');
  const asc = m.fontBoundingBoxAscent ?? size * 0.8;
  const desc = m.fontBoundingBoxDescent ?? size * 0.2;
  return top + (size * lh - (asc + desc)) / 2 + asc;
}

// Word wrap on spaces; a single word wider than the line is broken by character.
function wrap(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const probe = line ? `${line} ${word}` : word;
    if (textWidth(ctx, probe) <= maxW) { line = probe; continue; }
    if (line) lines.push(line);
    line = '';
    if (textWidth(ctx, word) <= maxW) { line = word; continue; }
    for (const ch of word) {
      if (textWidth(ctx, line + ch) <= maxW || !line) line += ch;
      else { lines.push(line); line = ch; }
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Two lines at most; step the size down by 8 to the floor before allowing a
// third. Nothing is ever clipped.
function fitTitle(ctx, text, L) {
  let size = L.title;
  for (;;) {
    setFont(ctx, 300, size, FONTS.display, TITLE.tracking);
    const lines = wrap(ctx, text, TITLE.maxW);
    if (lines.length <= 2 || size - TITLE.step < L.titleFloor) return { size, lines };
    size -= TITLE.step;
  }
}

// ---- shapes and images ----

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Cover-fit with a focal point: fx/fy pick which part of the image survives
// the crop (0 = left/top edge, .5 = centre, 1 = right/bottom edge).
function drawCover(ctx, img, x, y, w, h, fx = 0.5, fy = 0.5) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.drawImage(img, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
}

// Box art carries its title and key art in the upper part, so when the hero
// is wider than the cover (Square's 1080×620 most of all) the crop keeps the
// top rather than the middle band.
const HERO_FOCAL = { x: 0.5, y: 0.25 };

const coverCache = new Map();

/** Resolves to an <img> that is safe to draw, or null. Never rejects. */
export function loadCover(url) {
  if (!url) return Promise.resolve(null);
  if (!coverCache.has(url)) {
    coverCache.set(url, new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => { coverCache.delete(url); resolve(null); }; // a retry may do better
      img.src = `/api/cover?u=${encodeURIComponent(url)}`;
    }));
  }
  return coverCache.get(url);
}

// ---- regions ----

function drawHero(ctx, L, T, headline, img, heroH) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, heroH); ctx.clip();
  if (headline) {
    ctx.fillStyle = headline.color || T.plate;
    ctx.fillRect(0, 0, W, heroH);
    if (img) {
      drawCover(ctx, img, 0, 0, W, heroH, HERO_FOCAL.x, HERO_FOCAL.y);
    } else {
      setFont(ctx, 400, PLATE.font, FONTS.display);
      ctx.fillStyle = `rgba(${T.ivoryRgb},.35)`;
      ctx.textAlign = 'center';
      const lines = wrap(ctx, headline.title, W - PLATE.pad * 2);
      let y = (heroH - lines.length * PLATE.font * PLATE.lh) / 2;
      for (const line of lines) {
        fillText(ctx, line, W / 2, baseline(ctx, y, PLATE.font, PLATE.lh));
        y += PLATE.font * PLATE.lh;
      }
      ctx.textAlign = 'left';
    }
  } else {
    ctx.fillStyle = T.plate;
    ctx.fillRect(0, 0, W, heroH);
  }
  const fadeTop = heroH * (1 - FADE);
  const fade = ctx.createLinearGradient(0, fadeTop, 0, heroH);
  fade.addColorStop(0, `rgba(${T.bgRgb},0)`);
  fade.addColorStop(1, T.bg);
  ctx.fillStyle = fade;
  ctx.fillRect(0, fadeTop, W, heroH - fadeTop);
  ctx.restore();
}

function drawTile(ctx, L, T, game, img, x, y) {
  ctx.save();
  roundRect(ctx, x, y, L.tile, L.tile, TILE_RADIUS);
  ctx.clip();
  ctx.fillStyle = game.color || T.plate;
  ctx.fillRect(x, y, L.tile, L.tile);
  if (img) {
    drawCover(ctx, img, x, y, L.tile, L.tile);
  } else {
    setFont(ctx, 400, L.tileFont, FONTS.display);
    ctx.fillStyle = `rgba(${T.ivoryRgb},.85)`;
    const lines = wrap(ctx, game.title, L.tile - L.tilePad * 2);
    let ly = y + L.tile - L.tilePad - lines.length * L.tileFont;
    for (const line of lines) {
      fillText(ctx, line, x + L.tilePad, baseline(ctx, ly, L.tileFont, 1));
      ly += L.tileFont;
    }
  }
  ctx.restore();
}

function drawPlusTile(ctx, L, T, n, x, y) {
  ctx.save();
  roundRect(ctx, x, y, L.tile, L.tile, TILE_RADIUS);
  ctx.clip();
  // inset 0 0 0 3px: stroke the clipped edge at twice the width, half shows
  ctx.lineWidth = 6;
  ctx.strokeStyle = `rgba(${T.goldRgb},.8)`;
  ctx.stroke();
  setFont(ctx, 500, L.plusFont, FONTS.mono);
  ctx.fillStyle = T.gold;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fillText(ctx, `+${n}`, x + L.tile / 2, y + L.tile / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

/** Strip caption for n games beside the headline. */
export function stripCaption(n) {
  if (n === 0) return 'Bring your own if you like';
  if (n === 1) return 'or this one';
  return `or one of these ${n}`;
}

/**
 * @param {object} opts
 * @param {'story'|'square'} opts.format
 * @param {object|null} opts.headline   legacy game ({ title, color, image, imageLarge }) or null
 * @param {object[]} opts.rest          the other picks, in strip order
 * @param {object} opts.details         { dateLabel, venue } — a missing one leaves that
 *   line out entirely, never a placeholder; with neither, no footer and no hairline
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderInvitePoster({ format = 'story', headline = null, rest = [], details = {} }) {
  const L = LAYOUT[format] || LAYOUT.story;
  const H = L.h;
  const T = readTokens();

  const shown = rest.slice(0, STRIP_MAX);
  const [fontsDone, heroImg, ...tileImgs] = await Promise.all([
    loadFonts(L),
    loadCover(headline?.imageLarge || headline?.image),
    ...shown.map(g => loadCover(g.image || g.imageLarge)),
  ]);
  void fontsDone;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = T.bg;
  ctx.fillRect(0, 0, W, H);

  // Measure the text block first: its height decides where it starts and
  // how tall the hero is.
  const { size, lines } = fitTitle(ctx, headline ? headline.title : 'Pick a game', L);
  const rowH = shown.length ? L.tile : L.caption * CAPTION.lh;
  const hasFoot = Boolean(details.dateLabel || details.venue);
  const footH = !hasFoot ? 0
    : L.hairlineTop + 2 + L.footTop
      + (details.dateLabel ? L.date * FOOT.dateLh : 0)
      + (details.dateLabel && details.venue ? FOOT.venueTop : 0)
      + (details.venue ? L.venue * FOOT.venueLh : 0);
  const bodyH = EYEBROW.font * EYEBROW.lh + TITLE.top + lines.length * size * TITLE.lh + L.stripTop + rowH + footH;
  const bodyTop = Math.max(Math.round(H * L.heroMin) - L.heroOverlap, Math.round(H - L.footBottom - bodyH));
  const heroH = Math.min(H, bodyTop + L.heroOverlap);

  drawHero(ctx, L, T, headline, heroImg, heroH);

  // body: eyebrow, title, strip
  let y = bodyTop;
  setFont(ctx, 400, EYEBROW.font, FONTS.ui);
  ctx.fillStyle = `rgba(${T.ivoryRgb},.7)`;
  fillText(ctx, "We're probably playing", INSET, baseline(ctx, y, EYEBROW.font, EYEBROW.lh));
  y += EYEBROW.font * EYEBROW.lh + TITLE.top;

  setFont(ctx, 300, size, FONTS.display, TITLE.tracking);
  ctx.fillStyle = T.ivory;
  for (const line of lines) {
    fillText(ctx, line, INSET, baseline(ctx, y, size, TITLE.lh));
    y += size * TITLE.lh;
  }
  setFont(ctx, 400, EYEBROW.font, FONTS.ui); // clears the title's tracking
  y += L.stripTop;

  let x = INSET;
  shown.forEach((g, i) => { drawTile(ctx, L, T, g, tileImgs[i], x, y); x += L.tile + L.gap; });
  if (rest.length > STRIP_MAX) { drawPlusTile(ctx, L, T, rest.length - STRIP_MAX, x, y); x += L.tile + L.gap; }
  setFont(ctx, 400, L.caption, FONTS.ui);
  ctx.fillStyle = `rgba(${T.ivoryRgb},.7)`;
  const capTop = y + (rowH - L.caption * CAPTION.lh) / 2;
  fillText(ctx, stripCaption(rest.length), x + CAPTION.gap, baseline(ctx, capTop, L.caption, CAPTION.lh));

  y += rowH;

  // footer: a hairline under the strip, then the date and "at {venue}".
  // Lines the host hasn't decided are left out; with neither there is no
  // footer and no hairline. Everything flows down from the strip, so the
  // gap above the hairline is the same whatever the title's line count.
  if (hasFoot) {
    y = Math.round(y + L.hairlineTop); // whole pixels: a 2px rule must not blur across three rows
    ctx.fillStyle = `rgba(${T.goldRgb},.8)`;
    ctx.fillRect(INSET, y, W - INSET * 2, 2);
    y += 2 + L.footTop;
    if (details.dateLabel) {
      setFont(ctx, 500, L.date, FONTS.mono);
      ctx.fillStyle = T.ivory;
      fillText(ctx, details.dateLabel, INSET, baseline(ctx, y, L.date, FOOT.dateLh));
      y += L.date * FOOT.dateLh + (details.venue ? FOOT.venueTop : 0);
    }
    if (details.venue) {
      setFont(ctx, 400, L.venue, FONTS.ui);
      ctx.fillStyle = `rgba(${T.ivoryRgb},.7)`;
      fillText(ctx, `at ${details.venue}`, INSET, baseline(ctx, y, L.venue, FOOT.venueLh));
    }
  }

  return canvas;
}
