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

import qrcode from '../vendor/qrcode-generator.js';

export const STRIP_MAX = 5;
export const NIGHT_URL_BASE = 'https://boardgameshelf.app/n/';

const W = 1080;

// Story values, Square alongside — the spec's layout table, in px.
const LAYOUT = {
  story: {
    h: 1920, hero: 1160, bodyTop: 1040,
    title: 128, titleFloor: 96,
    tile: 150, gap: 22, tileFont: 26, tilePad: 12, plusFont: 40, caption: 34, stripTop: 44,
    hairlineBottom: 330, footBottom: 88, date: 44, host: 34, link: 36, linkTop: 22, qr: 190,
  },
  square: {
    h: 1080, hero: 620, bodyTop: 520,
    title: 84, titleFloor: 64,
    tile: 104, gap: 16, tileFont: 18, tilePad: 8, plusFont: 28, caption: 24, stripTop: 26,
    hairlineBottom: 230, footBottom: 60, date: 32, host: 24, link: 26, linkTop: 14, qr: 140,
  },
};

// Shared by both formats.
const INSET = 80;
const FADE = 0.46;                       // bottom share of the hero under the fade
const BADGE = { right: 72, top: 72, font: 22, padX: 14, padY: 8, radius: 8, lh: 1.3 };
const EYEBROW = { font: 34, lh: 1.3 };
const TITLE = { top: 12, maxW: 920, step: 8, lh: 1, tracking: -0.02 };
const PLATE = { font: 96, pad: 120, lh: 1 }; // hero placeholder title
const TILE_RADIUS = 10;
const CAPTION = { lh: 1.35, gap: 8 };    // .say has margin-left 8 on top of the flex gap
const FOOT = { hostTop: 6, dateLh: 1.2, hostLh: 1.3, linkLh: 1.2 };
const QR = { pad: 14, radius: 12 };

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
    `500 ${L.date}px "IBM Plex Mono"`, `400 ${BADGE.font}px "IBM Plex Mono"`,
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

function drawCover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

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

function drawHero(ctx, L, T, headline, img) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, L.hero); ctx.clip();
  if (headline) {
    ctx.fillStyle = headline.color || T.plate;
    ctx.fillRect(0, 0, W, L.hero);
    if (img) {
      drawCover(ctx, img, 0, 0, W, L.hero);
    } else {
      setFont(ctx, 400, PLATE.font, FONTS.display);
      ctx.fillStyle = `rgba(${T.ivoryRgb},.35)`;
      ctx.textAlign = 'center';
      const lines = wrap(ctx, headline.title, W - PLATE.pad * 2);
      let y = (L.hero - lines.length * PLATE.font * PLATE.lh) / 2;
      for (const line of lines) {
        fillText(ctx, line, W / 2, baseline(ctx, y, PLATE.font, PLATE.lh));
        y += PLATE.font * PLATE.lh;
      }
      ctx.textAlign = 'left';
    }
  } else {
    ctx.fillStyle = T.plate;
    ctx.fillRect(0, 0, W, L.hero);
  }
  const fadeTop = L.hero * (1 - FADE);
  const fade = ctx.createLinearGradient(0, fadeTop, 0, L.hero);
  fade.addColorStop(0, `rgba(${T.bgRgb},0)`);
  fade.addColorStop(1, T.bg);
  ctx.fillStyle = fade;
  ctx.fillRect(0, fadeTop, W, L.hero - fadeTop);
  ctx.restore();
}

function drawBadge(ctx, T) {
  const label = 'Powered by BGG';
  setFont(ctx, 400, BADGE.font, FONTS.mono);
  const w = textWidth(ctx, label) + BADGE.padX * 2;
  const h = BADGE.font * BADGE.lh + BADGE.padY * 2;
  const x = W - BADGE.right - w, y = BADGE.top;
  ctx.fillStyle = `rgba(${T.bgRgb},.55)`;
  roundRect(ctx, x, y, w, h, BADGE.radius);
  ctx.fill();
  ctx.fillStyle = T.ivory;
  fillText(ctx, label, x + BADGE.padX, baseline(ctx, y + BADGE.padY, BADGE.font, BADGE.lh));
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

function drawQr(ctx, L, T, url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const x = W - INSET - L.qr, y = L.h - L.footBottom - L.qr;
  ctx.fillStyle = T.ivory;
  roundRect(ctx, x, y, L.qr, L.qr, QR.radius);
  ctx.fill();
  const inner = L.qr - QR.pad * 2;
  const m = inner / n;
  ctx.fillStyle = T.bg;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      const x0 = Math.round(x + QR.pad + c * m), x1 = Math.round(x + QR.pad + (c + 1) * m);
      const y0 = Math.round(y + QR.pad + r * m), y1 = Math.round(y + QR.pad + (r + 1) * m);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
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
 * @param {object} opts.night           { code, error, dateLabel } — no code: no QR, no link
 * @param {string} opts.host            the host's name, for "at {host}'s"
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderInvitePoster({ format = 'story', headline = null, rest = [], night = {}, host = '' }) {
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

  drawHero(ctx, L, T, headline, heroImg);
  drawBadge(ctx, T);

  // body: eyebrow, title, strip
  let y = L.bodyTop;
  setFont(ctx, 400, EYEBROW.font, FONTS.ui);
  ctx.fillStyle = `rgba(${T.ivoryRgb},.7)`;
  fillText(ctx, "We're probably playing", INSET, baseline(ctx, y, EYEBROW.font, EYEBROW.lh));
  y += EYEBROW.font * EYEBROW.lh + TITLE.top;

  const { size, lines } = fitTitle(ctx, headline ? headline.title : 'Pick a game', L);
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
  const rowH = shown.length ? L.tile : L.caption * CAPTION.lh;
  const capTop = y + (rowH - L.caption * CAPTION.lh) / 2;
  fillText(ctx, stripCaption(rest.length), x + CAPTION.gap, baseline(ctx, capTop, L.caption, CAPTION.lh));

  // hairline
  ctx.fillStyle = `rgba(${T.goldRgb},.8)`;
  ctx.fillRect(INSET, H - L.hairlineBottom - 2, W - INSET * 2, 2);

  // footer: date, host, link — bottom-aligned with the QR plate
  const dateH = L.date * FOOT.dateLh, hostH = L.host * FOOT.hostLh, linkH = L.link * FOOT.linkLh;
  let fy = H - L.footBottom - (dateH + FOOT.hostTop + hostH + L.linkTop + linkH);
  setFont(ctx, 500, L.date, FONTS.mono);
  ctx.fillStyle = T.ivory;
  fillText(ctx, night.dateLabel || 'Date TBC', INSET, baseline(ctx, fy, L.date, FOOT.dateLh));
  fy += dateH + FOOT.hostTop;
  setFont(ctx, 400, L.host, FONTS.ui);
  ctx.fillStyle = `rgba(${T.ivoryRgb},.7)`;
  fillText(ctx, `at ${host}'s`, INSET, baseline(ctx, fy, L.host, FOOT.hostLh));
  fy += hostH + L.linkTop;
  const linkText = night.error ? "Couldn't create the night. Try again."
    : night.code ? `${NIGHT_URL_BASE.replace(/^https?:\/\//, '')}${night.code}` : '';
  if (linkText) {
    setFont(ctx, 500, L.link, FONTS.mono);
    ctx.fillStyle = T.ivory;
    fillText(ctx, linkText, INSET, baseline(ctx, fy, L.link, FOOT.linkLh));
  }

  if (night.code) drawQr(ctx, L, T, `${NIGHT_URL_BASE}${night.code}`);

  return canvas;
}
