// Pictogram library for the "Teach me in 60 seconds" section.
//
// Every scene draws into a 0 0 100 100 box, keeps a 6px margin from the edges
// and puts no text baseline below y=96. Scenes are composed from the PG
// primitives — a game's beat names a scene, never a drawing — so adding a game
// means adding data, and at most a scene from existing pieces.
//
// Colour is the grammar: gold is the thing the player does; ivory is the world;
// dim ivory is something that exists but isn't in play this frame. One gold
// element per scene, two at most. Only the pg-* classes from game-modal.css are
// used, so the scenes retheme with the app. Nothing here animates.
//
// PG and the seven Cascadia scenes are the approved set from
// docs/mockups/teach-60s.html, kept byte-for-byte. Everything after them
// implements docs/teach/teach-scenes.py.

// Pictogram library. Every piece draws into a 100×100 box. A game's beat
// names a scene; a scene is a handful of pieces at positions. Adding a game
// never means drawing — at most it means adding a scene from existing pieces.
const PG = {
  hex(x, y, r = 14, cls = 'pg-line', fill = '') {
    const pts = [0,1,2,3,4,5].map((i) => {
      const a = Math.PI / 3 * i + Math.PI / 6;
      return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${pts}" class="${cls} ${fill}"/>`;
  },
  // tile = hex with the small animal "slot" mark printed on it
  tile(x, y, r = 14, cls = 'pg-line', fill = 'pg-fill') {
    return PG.hex(x, y, r, cls, fill) + `<circle cx="${x}" cy="${y}" r="3" class="${cls === 'pg-gold' ? 'pg-gold' : 'pg-dim'}"/>`;
  },
  token(x, y, r = 6, cls = 'pg-ivory-solid') { return `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`; },
  card(x, y, w = 22, h = 30, cls = 'pg-line') { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="${cls} pg-fill"/>`; },
  arrow(x1, y1, x2, y2, cls = 'pg-gold') {
    const ang = Math.atan2(y2 - y1, x2 - x1), k = 6;
    const ax = x2 - k * Math.cos(ang - .5), ay = y2 - k * Math.sin(ang - .5);
    const bx = x2 - k * Math.cos(ang + .5), by = y2 - k * Math.sin(ang + .5);
    return `<path d="M${x1} ${y1}L${x2} ${y2}M${ax.toFixed(1)} ${ay.toFixed(1)}L${x2} ${y2}L${bx.toFixed(1)} ${by.toFixed(1)}" class="${cls}"/>`;
  },
  trophy(x, y, cls = 'pg-gold') {
    return `<g transform="translate(${x - 12} ${y - 14})" class="${cls}">
      <path d="M6 2h12v8a6 6 0 0 1-12 0z"/><path d="M6 4H3a3 3 0 0 0 3 6M18 4h3a3 3 0 0 1-3 6"/>
      <path d="M12 16v4M8 22h8"/></g>`;
  },
  hand(x, y, cls = 'pg-gold') {
    // Tabler hand-finger, simplified
    return `<g transform="translate(${x - 12} ${y - 12})" class="${cls}">
      <path d="M8 13V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0V12"/>
      <path d="M14 10.5a1.5 1.5 0 0 1 3 0V12"/>
      <path d="M17 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2 .208a6 6 0 0 1-5.012-2.7L7 19c-.312-.479-1.407-2.388-3.286-5.728a1.5 1.5 0 0 1 .536-2.022 1.867 1.867 0 0 1 2.28.28L8 13"/></g>`;
  },
  lock(x, y, cls = 'pg-gold') {
    return `<g transform="translate(${x - 8} ${y - 9})" class="${cls}">
      <rect x="2" y="8" width="12" height="10" rx="2"/><path d="M5 8V5a3 3 0 0 1 6 0v3"/></g>`;
  },
  bag(x, y, cls = 'pg-line') {
    return `<g transform="translate(${x - 12} ${y - 12})" class="${cls}">
      <path d="M9 4h6l1 4H8z"/><path d="M6 8h12l2 8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" class="pg-fill"/></g>`;
  },
  check(x, y, cls = 'pg-gold') { return `<path d="M${x - 6} ${y}l4 4 8-8" class="${cls}"/>`; },
  cross(x, y, cls = 'pg-gold') { return `<path d="M${x - 5} ${y - 5}l10 10M${x + 5} ${y - 5}l-10 10" class="${cls}"/>`; },
  // a tile+token pair as it sits in the market
  pair(x, y, hot = false) {
    const c = hot ? 'pg-gold' : 'pg-dim';
    return PG.tile(x, y, 11, c, hot ? 'pg-gold-fill' : 'pg-fill') + PG.token(x + 22, y, 5, hot ? 'pg-gold-solid' : 'pg-dim');
  },
  // a small player map: three touching tiles
  map(x, y, cls = 'pg-line') {
    return PG.tile(x, y, 13, cls) + PG.tile(x + 22.5, y + 13, 13, cls) + PG.tile(x, y + 26, 13, cls);
  },
};

// ---- Additional primitives (docs/teach/teach-scenes.py) ----
// Same contract as above: (x, y) is the visual centre, `cls` is the stroke
// class, and the shapes are Tabler paths simplified rather than traced.

// Solid-fill class that pairs with a stroke class, for pips, sand, needles.
const solidFor = (cls) => (cls === 'pg-gold' ? 'pg-gold-solid' : 'pg-ivory-solid');
const fillFor = (cls) => (cls === 'pg-gold' ? 'pg-gold-fill' : 'pg-fill');

Object.assign(PG, {
  // Wrap any piece(s) in a rotation about (x, y).
  rot(deg, x, y, inner) { return `<g transform="rotate(${deg} ${x} ${y})">${inner}</g>`; },
  line(x1, y1, x2, y2, cls = 'pg-line') { return `<path d="M${x1} ${y1}L${x2} ${y2}" class="${cls}"/>`; },
  // Text. Gold mono by default; ivory text borrows the ivory-solid fill and
  // sets the face by attribute, so no extra CSS class is needed.
  txt(x, y, s, gold = true, size = 11) {
    return gold
      ? `<text x="${x}" y="${y}" text-anchor="middle" class="pg-mono" style="font-size:${size}px">${s}</text>`
      : `<text x="${x}" y="${y}" text-anchor="middle" class="pg-ivory-solid" font-family="'IBM Plex Mono',monospace" font-weight="600" font-size="${size}">${s}</text>`;
  },
  // die: rounded square with pips. face: 1–6, 'skull' or 'gem'. s = side.
  die(x, y, cls = 'pg-line', face = 5, s = 18) {
    const h = s / 2, d = s * 0.27, pip = solidFor(cls);
    let out = `<rect x="${x - h}" y="${y - h}" width="${s}" height="${s}" rx="${(s * 0.18).toFixed(1)}" class="${cls} ${fillFor(cls)}"/>`;
    if (face === 'skull') return out + PG.skull(x, y, cls, s / 26);
    if (face === 'gem') return out + `<path d="M${x - d} ${y - 1}l${d * 0.6} ${-d * 0.8}h${d * 0.8}l${d * 0.6} ${d * 0.8}L${x} ${y + d}z" class="${cls}"/>`;
    const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
      4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
      6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[face] || [];
    return out + P.map(([px, py]) => `<circle cx="${(x + px * d).toFixed(1)}" cy="${(y + py * d).toFixed(1)}" r="${(s * 0.09).toFixed(1)}" class="${pip}"/>`).join('');
  },
  // meeple: head, arms out, two legs. k scales it (1 ≈ 20 units tall).
  meeple(x, y, cls = 'pg-line', fill = 'pg-fill', k = 1) {
    return `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-3-4L-9-1v3l5-1-2 8h4.5L0 4l1.5 5H6L4 1l5 1v-3L3-4a3.8 3.8 0 1 0-6 0z" class="${cls} ${fill}"/></g>`;
  },
  coin(x, y, cls = 'pg-line', r = 6) {
    return `<circle cx="${x}" cy="${y}" r="${r}" class="${cls} ${fillFor(cls)}"/><circle cx="${x}" cy="${y}" r="${(r * 0.45).toFixed(1)}" class="${cls}"/>`;
  },
  // a stack of n coins seen edge-on
  coinStack(x, y, n = 3, cls = 'pg-line') {
    let out = '';
    for (let i = 0; i < n; i++) out += `<ellipse cx="${x}" cy="${y - i * 4}" rx="8" ry="3" class="${cls} ${fillFor(cls)}"/>`;
    return out;
  },
  // one coin seen edge-on, for the top of a stack
  coinEdge(x, y, cls = 'pg-gold') { return `<ellipse cx="${x}" cy="${y}" rx="8" ry="3" class="${cls} ${fillFor(cls)}"/>`; },
  banknote(x, y, cls = 'pg-line') {
    return `<rect x="${x - 14}" y="${y - 8}" width="28" height="16" rx="2" class="${cls} ${fillFor(cls)}"/><circle cx="${x}" cy="${y}" r="3.5" class="${cls}"/>`;
  },
  gavel(x, y, cls = 'pg-gold') {
    return `<g transform="translate(${x} ${y}) rotate(-40)" class="${cls}"><rect x="-9" y="-13" width="18" height="8" rx="2" class="${fillFor(cls)}"/><path d="M0-5v17"/></g>`;
  },
  shield(x, y, cls = 'pg-line') {
    return `<path d="M${x} ${y - 11}l9 3v6c0 5.5-4 9.5-9 11-5-1.5-9-5.5-9-11v-6z" class="${cls} ${fillFor(cls)}"/>`;
  },
  skull(x, y, cls = 'pg-line', k = 1) {
    return `<g transform="translate(${x} ${y}) scale(${k})" class="${cls}"><path d="M-8-2a8 8 0 0 1 16 0v4a3 3 0 0 1-3 3v4h-10v-4a3 3 0 0 1-3-3z" class="${fillFor(cls)}"/><circle cx="-3.2" cy="-1.5" r="1.9" class="${solidFor(cls)}"/><circle cx="3.2" cy="-1.5" r="1.9" class="${solidFor(cls)}"/><path d="M-2 9v-3M2 9v-3"/></g>`;
  },
  pencil(x, y, cls = 'pg-gold') {
    return `<g transform="translate(${x - 12} ${y - 12})" class="${cls}"><path d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16v4"/><path d="M13.5 6.5l4 4"/></g>`;
  },
  // sheet: a page with ruled lines (or a grid when grid=true)
  sheet(x, y, cls = 'pg-line', w = 24, h = 30, grid = false) {
    const l = x - w / 2, t = y - h / 2;
    let out = `<rect x="${l}" y="${t}" width="${w}" height="${h}" rx="2.5" class="${cls} ${fillFor(cls)}"/>`;
    if (grid) {
      for (let i = 1; i < 3; i++) out += `<path d="M${l + (w * i) / 3} ${t}v${h}" class="pg-dim"/>`;
      for (let i = 1; i < 4; i++) out += `<path d="M${l} ${t + (h * i) / 4}h${w}" class="pg-dim"/>`;
    } else {
      for (let i = 1; i < 4; i++) out += `<path d="M${l + 5} ${t + (h * i) / 4}h${w - 10}" class="pg-dim"/>`;
    }
    return out;
  },
  // speech bubble; tail on the left (or right when flip). lines: bars inside.
  bubble(x, y, cls = 'pg-line', lines = 0, flip = false, w = 30, h = 20) {
    const l = x - w / 2, t = y - h / 2, r = 4;
    const tail = flip
      ? `h${w - r - 12}l6 6v-6h6a${r} ${r} 0 0 0 ${r}-${r}`
      : `h6v6l6-6h${w - r - 12}a${r} ${r} 0 0 0 ${r}-${r}`;
    const path = `M${l} ${t + r}a${r} ${r} 0 0 1 ${r}-${r}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1-${r} ${r}h-${w - 2 * r}a${r} ${r} 0 0 1-${r}-${r}z`;
    const tailPath = flip
      ? `M${l + w - 10} ${t + h}l-2 6 8-6`
      : `M${l + 10} ${t + h}l2 6-8-6`;
    let out = `<path d="${path}" class="${cls} ${fillFor(cls)}"/><path d="${tailPath}" class="${cls} ${fillFor(cls)}"/>`;
    for (let i = 0; i < lines; i++) {
      const ly = t + h / 2 + (i - (lines - 1) / 2) * 5;
      out += `<path d="M${l + 7} ${ly}h${w - 14 - (i === lines - 1 && lines > 1 ? 6 : 0)}" class="${cls === 'pg-gold' ? 'pg-gold' : 'pg-dim'}"/>`;
    }
    return out;
  },
  // hourglass; sand 0..1 is how much is left in the top bulb
  hourglass(x, y, cls = 'pg-line', sand = 0.5, sandCls = solidFor(cls)) {
    const top = sand > 0 ? `<path d="M${x - 5 * sand} ${y - 3 - 6 * sand}h${10 * sand}L${x} ${y - 1}z" class="${sandCls}"/>` : '';
    const bot = `<path d="M${x - 6 * (1 - sand)} ${y + 10}h${12 * (1 - sand)}L${x} ${y + 10 - 8 * (1 - sand)}z" class="${sandCls}"/>`;
    return `<path d="M${x - 8} ${y - 13}h16v3l-6 10 6 10v3h-16v-3l6-10-6-10z" class="${cls}"/>${top}${bot}`;
  },
  eye(x, y, cls = 'pg-line') {
    return `<path d="M${x - 12} ${y}c3-6 7-8 12-8s9 2 12 8c-3 6-7 8-12 8s-9-2-12-8z" class="${cls}"/><circle cx="${x}" cy="${y}" r="3" class="${cls}"/>`;
  },
  magnifier(x, y, cls = 'pg-gold') {
    return `<circle cx="${x - 3}" cy="${y - 3}" r="9" class="${cls}"/><path d="M${x + 3.5} ${y + 3.5}l7 7" class="${cls}"/>`;
  },
  gear(x, y, cls = 'pg-line', r = 10) {
    let teeth = '';
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      teeth += `M${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}L${(x + (r + 3.5) * Math.cos(a)).toFixed(1)} ${(y + (r + 3.5) * Math.sin(a)).toFixed(1)}`;
    }
    return `<circle cx="${x}" cy="${y}" r="${r}" class="${cls} ${fillFor(cls)}"/><path d="${teeth}" class="${cls}"/><circle cx="${x}" cy="${y}" r="${(r * 0.35).toFixed(1)}" class="${cls}"/>`;
  },
  // building: (x, y) is the bottom centre so blocks share a ground line
  building(x, y, cls = 'pg-line', w = 16, h = 26) {
    let out = `<rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}" rx="1.5" class="${cls} ${fillFor(cls)}"/>`;
    for (let wy = y - h + 6; wy < y - 4; wy += 6) out += `<path d="M${x - w / 2 + 4} ${wy}h${w - 8}" class="pg-dim"/>`;
    return out;
  },
  flag(x, y, cls = 'pg-line') {
    return `<path d="M${x - 7} ${y + 13}V${y - 13}h14l-3 5 3 5h-14" class="${cls} ${fillFor(cls)}"/>`;
  },
  // tally: four strokes and a diagonal
  tally(x, y, cls = 'pg-line') {
    return `<path d="M${x - 9} ${y - 8}v16M${x - 3} ${y - 8}v16M${x + 3} ${y - 8}v16M${x + 9} ${y - 8}v16M${x - 12} ${y + 5}L${x + 12} ${y - 5}" class="${cls}"/>`;
  },
  compass(x, y, cls = 'pg-line', needle = 'pg-gold-solid') {
    return `<circle cx="${x}" cy="${y}" r="11" class="${cls} ${fillFor(cls)}"/><path d="M${x} ${y - 7}l3.5 7h-7z" class="${needle}"/><path d="M${x} ${y + 7}l3.5-7h-7z" class="${cls}"/>`;
  },
  // --- pieces that only one or two scenes need ---
  rocket(x, y, cls = 'pg-gold') {
    return `<g transform="translate(${x} ${y})" class="${cls}"><path d="M0-14c5 4 7 11 5 19H-5c-2-8 0-15 5-19z" class="${fillFor(cls)}"/><path d="M-5 0l-5 6v4h5M5 0l5 6v4H5M-3 5v6M3 5v6"/><circle cx="0" cy="-4" r="2.5"/></g>`;
  },
  planet(x, y, cls = 'pg-line') {
    return `<circle cx="${x}" cy="${y}" r="10" class="${cls} ${fillFor(cls)}"/><ellipse cx="${x}" cy="${y}" rx="17" ry="4.5" transform="rotate(-18 ${x} ${y})" class="pg-dim"/>`;
  },
  train(x, y, cls = 'pg-gold') {
    return `<g transform="translate(${x} ${y})" class="${cls}"><rect x="-17" y="-6" width="34" height="14" rx="3" class="${fillFor(cls)}"/><path d="M-13-6v-6h10v6"/><circle cx="-10" cy="11" r="3"/><circle cx="0" cy="11" r="3"/><circle cx="10" cy="11" r="3"/></g>`;
  },
  boat(x, y, cls = 'pg-gold') {
    return `<g transform="translate(${x} ${y})" class="${cls}"><path d="M-16 2h32l-5 8h-22z" class="${fillFor(cls)}"/><path d="M0 2v-18"/><path d="M0-16l13 13H0z" class="${fillFor(cls)}"/></g>`;
  },
  wave(x, y, cls = 'pg-line', w = 60) {
    const n = Math.round(w / 12);
    let d = `M${x - w / 2} ${y}`;
    for (let i = 0; i < n; i++) d += `q3-5 6 0t6 0`;
    return `<path d="${d}" class="${cls}"/>`;
  },
  fish(x, y, cls = 'pg-line') {
    return `<g transform="translate(${x} ${y})" class="${cls}"><path d="M-9 0c4-6 12-6 16 0-4 6-12 6-16 0z" class="${fillFor(cls)}"/><path d="M7 0l6-5v10z"/><circle cx="-4" cy="-1" r="1" class="${solidFor(cls)}"/></g>`;
  },
  phone(x, y, cls = 'pg-line') {
    let out = `<rect x="${x - 11}" y="${y - 19}" width="22" height="38" rx="4" class="${cls} ${fillFor(cls)}"/><path d="M${x - 3} ${y + 14}h6" class="${cls}"/>`;
    return out;
  },
  book(x, y, cls = 'pg-line') {
    return `<g transform="translate(${x} ${y})" class="${cls}"><path d="M-17-11q8-3 17 0 9-3 17 0v22q-8-3-17 0-9-3-17 0z" class="${fillFor(cls)}"/><path d="M0-11v22"/></g>`;
  },
  ear(x, y, cls = 'pg-line') {
    return `<g transform="translate(${x} ${y})" class="${cls}"><path d="M-6 8a9 9 0 1 1 12-5c0 4-4 5-5 9a3.5 3.5 0 0 1-7 0"/><path d="M-2 2a4 4 0 0 1 5-4"/></g>`;
  },
  barn(x, y, cls = 'pg-line') {
    return `<g transform="translate(${x} ${y})" class="${cls}"><path d="M-12 10v-9l12-9 12 9v9z" class="${fillFor(cls)}"/><path d="M-4 10v-7h8v7"/></g>`;
  },
  sheep(x, y, cls = 'pg-line') {
    return `<g transform="translate(${x} ${y})" class="${cls}"><ellipse cx="0" cy="0" rx="9" ry="6" class="${fillFor(cls)}"/><circle cx="10" cy="-2" r="3.5" class="${fillFor(cls)}"/><path d="M-5 6v5M4 6v5"/></g>`;
  },
  // burst: radiating strokes, for a clash
  burst(x, y, cls = 'pg-gold', r1 = 4, r2 = 10) {
    let d = '';
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + Math.PI / 8;
      d += `M${(x + r1 * Math.cos(a)).toFixed(1)} ${(y + r1 * Math.sin(a)).toFixed(1)}L${(x + r2 * Math.cos(a)).toFixed(1)} ${(y + r2 * Math.sin(a)).toFixed(1)}`;
    }
    return `<path d="${d}" class="${cls}"/>`;
  },
  // a blobby map outline split into four regions
  regionMap(x, y, cls = 'pg-line', k = 1) {
    return `<g transform="translate(${x} ${y}) scale(${k})" class="${cls}"><path d="M-34-14q4-16 20-13t20 1q16 2 14 20t-4 22q-6 16-24 12t-20 0q-16 0-14-18t8-24z" class="${fillFor(cls)}"/><path d="M0-27v53M-34 0h68" class="pg-dim"/></g>`;
  },
  monster(x, y, cls = 'pg-line') {
    return `<g transform="translate(${x} ${y})" class="${cls}"><path d="M-12 12v-14a12 12 0 0 1 24 0v14z" class="${fillFor(cls)}"/><path d="M-9-10l-3-8 7 4M9-10l3-8-7 4"/><circle cx="-4" cy="-2" r="1.8" class="${solidFor(cls)}"/><circle cx="4" cy="-2" r="1.8" class="${solidFor(cls)}"/><path d="M-5 6l2 3 3-3 3 3 2-3"/></g>`;
  },
  // a face-down card back: card with a dim diagonal hatch
  cardBack(x, y, w = 22, h = 30, cls = 'pg-line') {
    return PG.card(x, y, w, h, cls) + `<path d="M${x + 4} ${y + h - 4}L${x + w - 4} ${y + 4}M${x + 4} ${y + h / 2}L${x + w / 2} ${y + 4}M${x + w / 2} ${y + h - 4}L${x + w - 4} ${y + h / 2}" class="pg-dim"/>`;
  },
  // a card seen edge-on, mid-flip
  cardEdge(x, y, cls = 'pg-gold') {
    return `<path d="M${x - 2} ${y - 15}l4 0 2 30-8 0z" class="${cls} ${fillFor(cls)}"/>`;
  },
  // a hand with its arm cut short, raised — for voting / holding
  raisedHand(x, y, cls = 'pg-line') {
    return PG.hand(x, y, cls);
  },
  // a curved arrow (arc from a1 to a2 degrees around (x,y) at radius r)
  arc(x, y, r, a1, a2, cls = 'pg-gold', head = true) {
    const p = (a) => [x + r * Math.cos((a * Math.PI) / 180), y + r * Math.sin((a * Math.PI) / 180)];
    const [x1, y1] = p(a1), [x2, y2] = p(a2);
    const large = Math.abs(a2 - a1) > 180 ? 1 : 0, sweep = a2 > a1 ? 1 : 0;
    let out = `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 ${large} ${sweep} ${x2.toFixed(1)} ${y2.toFixed(1)}" class="${cls}"/>`;
    if (head) {
      const t = ((a2 + (sweep ? 90 : -90)) * Math.PI) / 180, k = 6;
      const ax = x2 - k * Math.cos(t - .5), ay = y2 - k * Math.sin(t - .5);
      const bx = x2 - k * Math.cos(t + .5), by = y2 - k * Math.sin(t + .5);
      out += `<path d="M${ax.toFixed(1)} ${ay.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}" class="${cls}"/>`;
    }
    return out;
  },
  // a fan of n cards pivoting below the box
  fan(x, y, n = 5, hot = -1, spread = 14) {
    let out = '';
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * spread;
      const gold = i === hot;
      out += PG.rot(a, x, y + 62, `<rect x="${x - 11}" y="${y}" width="22" height="30" rx="3" class="${gold ? 'pg-gold pg-gold-fill' : 'pg-line pg-fill'}"/>`);
    }
    return out;
  },
  // small grid of cells (dim), top-left (l, t)
  grid(l, t, cols, rows, cell, cls = 'pg-dim') {
    let d = '';
    for (let i = 0; i <= cols; i++) d += `M${l + i * cell} ${t}v${rows * cell}`;
    for (let j = 0; j <= rows; j++) d += `M${l} ${t + j * cell}h${cols * cell}`;
    return `<path d="${d}" class="${cls}"/>`;
  },
  // motion lines trailing to the left of (x, y)
  whoosh(x, y, cls = 'pg-dim') {
    return `<path d="M${x} ${y - 5}h-8M${x - 3} ${y}h-10M${x} ${y + 5}h-8" class="${cls}"/>`;
  },
  exclaim(x, y, cls = 'pg-gold') {
    return `<path d="M${x} ${y - 12}v13" class="${cls}"/><circle cx="${x}" cy="${y + 8}" r="1.8" class="${solidFor(cls)}"/>`;
  },
});

// ---- Scenes ----
const SCENES = {
  'hexes-tokens': () =>
    PG.tile(38, 34, 16) + PG.tile(65, 50, 16, 'pg-line', 'pg-gold-fill') + PG.tile(38, 66, 16) +
    PG.token(38, 34, 6) + PG.token(65, 50, 6, 'pg-gold-solid'),
  'trophy-patterns': () =>
    PG.trophy(50, 22) +
    PG.token(20, 56, 5) + PG.token(34, 56, 5) + PG.token(27, 68, 5, 'pg-gold-solid') +
    `<text x="27" y="88" text-anchor="middle" class="pg-mono">+3</text>` +
    PG.hex(66, 54, 10, 'pg-line', 'pg-gold-fill') + PG.hex(83, 64, 10, 'pg-line', 'pg-gold-fill') + PG.hex(66, 74, 10, 'pg-line', 'pg-gold-fill') +
    `<text x="75" y="95" text-anchor="middle" class="pg-mono">+5</text>`,
  'pick-pair': () =>
    PG.pair(30, 20) + PG.pair(30, 41, true) + PG.pair(30, 62) + PG.pair(30, 83) +
    PG.arrow(86, 41, 66, 41),
  'place-tile': () =>
    PG.map(28, 40, 'pg-dim') + PG.hex(50.5, 79, 13, 'pg-gold', 'pg-gold-fill') + `<circle cx="50.5" cy="79" r="3" class="pg-gold"/>` +
    PG.arrow(78, 54, 60, 70),
  'place-token': () =>
    PG.map(28, 40, 'pg-dim') + PG.hex(50.5, 79, 13, 'pg-line', 'pg-fill') + `<circle cx="50.5" cy="79" r="3" class="pg-gold"/>` +
    PG.token(78, 38, 7, 'pg-gold-solid') + PG.arrow(76, 50, 58, 70) + PG.check(88, 84),
  'lock-bag': () =>
    PG.tile(30, 40, 16, 'pg-line') + PG.token(30, 40, 6, 'pg-gold-solid') + PG.lock(30, 71) +
    PG.token(66, 32, 6, 'pg-gold-solid') + PG.cross(66, 32, 'pg-line') + PG.arrow(66, 44, 66, 60) + PG.bag(66, 78),
  'hand-pair': () =>
    PG.pair(30, 30, true) + PG.pair(30, 74) + PG.hand(74, 46) + PG.check(88, 26),

  // ---- HOOK: what kind of game this is ----
  'hexes-dice': () =>
    PG.tile(30, 34, 14) + PG.tile(52.5, 47, 14) + PG.tile(30, 60, 14) +
    PG.die(78, 76, 'pg-gold', 5, 20),
  'cards-hand': () => PG.fan(50, 30, 5, 2),
  'cards-tableau': () =>
    PG.card(14, 20) + PG.card(39, 20) + PG.card(64, 20) +
    PG.meeple(50, 78, 'pg-gold', 'pg-gold-fill', 1.1),
  'deck-cards': () =>
    PG.cardBack(14, 34) + PG.cardBack(18, 30) + PG.cardBack(22, 26) +
    PG.card(54, 30, 22, 30, 'pg-gold') + PG.card(72, 44, 22, 30, 'pg-gold'),
  'dice-cup': () =>
    PG.rot(-30, 34, 44, `<path d="M22 28h24l-4 32H26z" class="pg-line pg-fill"/><path d="M22 28q12 4 24 0" class="pg-line"/>`) +
    PG.die(62, 54, 'pg-line', 3, 15) + PG.die(80, 72, 'pg-line', 6, 15) + PG.die(58, 80, 'pg-gold', 5, 15),
  'map-armies': () =>
    PG.regionMap(50, 50, 'pg-line', 1.15) +
    PG.meeple(34, 34, 'pg-line', 'pg-fill', 0.9) + PG.meeple(66, 34, 'pg-line', 'pg-fill', 0.9) +
    PG.meeple(34, 66, 'pg-gold', 'pg-gold-fill', 0.9),
  'map-board': () =>
    `<rect x="10" y="14" width="80" height="72" rx="4" class="pg-line pg-fill"/>` +
    `<path d="M24 34L48 26 74 36 62 62 30 70z M48 26 62 62" class="pg-dim"/>` +
    PG.token(24, 34, 4) + PG.token(48, 26, 4) + PG.token(74, 36, 4) + PG.token(30, 70, 4) +
    PG.token(62, 62, 6, 'pg-gold-solid'),
  'workers-board': () =>
    `<rect x="10" y="20" width="80" height="60" rx="4" class="pg-line pg-fill"/>` +
    [[26, 38], [50, 38], [74, 38], [26, 64], [50, 64], [74, 64]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" class="pg-dim"/>`).join('') +
    PG.meeple(50, 38, 'pg-line', 'pg-fill', 0.8) + PG.meeple(26, 64, 'pg-gold', 'pg-gold-fill', 0.8),
  'hidden-role': () =>
    PG.card(30, 22, 40, 56) + `<rect x="35" y="27" width="30" height="46" rx="2" class="pg-dim"/>` + PG.txt(50, 60, '?', true, 30),
  'team-vs-team': () =>
    `<path d="M50 14v72" class="pg-dim" stroke-dasharray="3 4"/>` +
    PG.meeple(20, 36, 'pg-line') + PG.meeple(34, 62, 'pg-line') + PG.meeple(20, 66, 'pg-gold', 'pg-gold-fill') +
    PG.meeple(80, 36, 'pg-dim') + PG.meeple(66, 62, 'pg-dim') + PG.meeple(80, 66, 'pg-dim'),
  'coop-threat': () =>
    PG.meeple(20, 40, 'pg-line') + PG.meeple(20, 68, 'pg-line') + PG.meeple(38, 54, 'pg-line') +
    PG.shield(58, 54, 'pg-gold') + PG.skull(84, 52, 'pg-line'),
  'drawing-pad': () =>
    PG.sheet(44, 54, 'pg-line', 40, 48) + `<path d="M30 50q8-14 14-2t12-4" class="pg-dim"/>` +
    `<path d="M24 32h40" class="pg-line"/>` + PG.pencil(70, 34),
  'word-bubble': () => PG.bubble(50, 46, 'pg-gold', 3, false, 56, 40),
  'route-network': () =>
    `<path d="M18 30L46 22 80 30 64 60 34 76 18 30M46 22 64 60" class="pg-dim"/>` +
    `<path d="M34 76L80 30" class="pg-gold"/>` +
    [[18, 30], [46, 22], [80, 30], [64, 60], [34, 76]].map(([x, y]) => PG.token(x, y, 4)).join(''),
  'coins-stack': () =>
    PG.coinStack(34, 70, 4) + PG.coinEdge(34, 54) + PG.banknote(68, 62),
  'stock-chart': () =>
    `<path d="M16 16v66h68" class="pg-line"/><path d="M22 70l14-12 12 8 14-20 12-8" class="pg-line"/>` +
    PG.coin(74, 38, 'pg-gold', 7),
  'grid-pieces': () =>
    PG.grid(22, 22, 4, 4, 14) + PG.token(43, 43, 5) + PG.token(71, 29, 5) + PG.token(57, 71, 5, 'pg-gold-solid'),
  'duel': () =>
    PG.meeple(22, 52, 'pg-gold', 'pg-gold-fill', 1.2) + PG.card(39, 36) + PG.meeple(78, 52, 'pg-line', 'pg-fill', 1.2),
  'timer-sand': () =>
    PG.hourglass(30, 50, 'pg-line', 0.6) + PG.card(56, 26) + PG.card(68, 44, 22, 30, 'pg-gold'),
  'flick': () =>
    PG.rot(90, 32, 56, PG.hand(32, 56)) + PG.token(66, 56, 8) + PG.whoosh(56, 56) + PG.arrow(76, 56, 90, 56),
  'city-blocks': () =>
    `<path d="M10 84h80" class="pg-dim"/>` + PG.building(28, 84, 'pg-line', 18, 30) + PG.building(50, 84, 'pg-line', 18, 46) + PG.building(72, 84, 'pg-gold', 18, 62),
  'farm-fields': () =>
    PG.grid(14, 14, 3, 3, 24) + PG.barn(38, 38, 'pg-gold') + PG.sheep(62, 62),
  'engine-gears': () =>
    PG.gear(38, 44, 'pg-line', 12) + PG.gear(66, 60, 'pg-line', 9) +
    PG.arc(52, 52, 34, -150, 60, 'pg-gold'),
  'auction-gavel': () =>
    PG.card(22, 44) + PG.gavel(38, 28) +
    PG.coinStack(62, 76, 2) + PG.coinStack(80, 76, 4),
  'handshake': () =>
    PG.card(24, 60, 22, 30, 'pg-dim') + PG.card(54, 60, 22, 30, 'pg-dim') +
    PG.rot(90, 36, 34, PG.hand(36, 34)) + PG.rot(-90, 64, 34, PG.hand(64, 34, 'pg-line')),
  'push-luck': () =>
    PG.die(32, 50, 'pg-line', 'skull', 26) + PG.die(68, 50, 'pg-gold', 'gem', 26),
  'race-track': () =>
    `<path d="M12 78A38 38 0 0 1 88 78M24 78A26 26 0 0 1 76 78" class="pg-dim"/>` +
    PG.token(20.6, 65.7, 5) + PG.token(50, 46, 5) + PG.token(75.5, 55.8, 5.5, 'pg-gold-solid') +
    PG.flag(86, 66, 'pg-line'),
  'polyomino': () =>
    PG.grid(16, 16, 5, 5, 13.6) +
    `<path d="M16 70.4h27.2V43.2H29.6V56.8H16z" class="pg-line pg-fill"/>` +
    `<path d="M43.2 43.2h40.8v13.6H56.8v13.6H43.2z" class="pg-gold pg-gold-fill"/>`,
  'question-cards': () =>
    PG.card(24, 22, 26, 36) + PG.txt(37, 46, '?', false, 18) + PG.hand(70, 60),
  'magnifier': () =>
    PG.card(24, 44, 22, 30, 'pg-dim') + PG.card(50, 44) + PG.magnifier(72, 36),
  'spaceship': () =>
    PG.planet(50, 72) + PG.rocket(62, 30),
  'story-picture': () =>
    PG.card(14, 24, 32, 42) + `<path d="M18 58l8-10 6 6 6-9 8 13" class="pg-dim"/><circle cx="36" cy="34" r="3" class="pg-dim"/>` +
    PG.bubble(70, 42, 'pg-gold', 2, false, 32, 22),
  'trains': () =>
    `<path d="M8 74h84M18 70v8M30 70v8M42 70v8M54 70v8M66 70v8M78 70v8" class="pg-dim"/>` +
    PG.building(16, 54, 'pg-line', 12, 20) + PG.building(84, 54, 'pg-line', 12, 20) + PG.train(50, 56),
  'ship-sea': () =>
    PG.wave(50, 78, 'pg-line', 72) + PG.wave(50, 88, 'pg-dim', 60) +
    PG.boat(50, 60) + `<rect x="-13" y="-7" width="9" height="9" class="pg-line pg-fill" transform="translate(50 60)"/>`,
  'monster-fight': () =>
    PG.meeple(26, 60, 'pg-gold', 'pg-gold-fill', 1.3) + PG.burst(50, 50, 'pg-dim', 3, 7) + PG.monster(74, 52),
  'campaign-book': () =>
    PG.book(50, 50) + `<circle cx="42" cy="46" r="1.8" class="pg-dim"/><circle cx="38" cy="56" r="1.8" class="pg-dim"/>` +
    `<path d="M56 60q6-10 12-4t8-10" class="pg-gold"/><circle cx="56" cy="60" r="2.5" class="pg-gold-solid"/>`,
  'pencil-sheet': () =>
    PG.sheet(40, 52, 'pg-line', 34, 44, true) + PG.pencil(72, 38),
  'stack-tower': () =>
    PG.rot(-4, 50, 80, `<rect x="34" y="72" width="32" height="10" rx="2" class="pg-line pg-fill"/>`) +
    PG.rot(5, 50, 66, `<rect x="36" y="58" width="32" height="10" rx="2" class="pg-line pg-fill"/>`) +
    PG.rot(-7, 50, 52, `<rect x="32" y="44" width="32" height="10" rx="2" class="pg-line pg-fill"/>`) +
    PG.rot(8, 50, 36, `<rect x="38" y="28" width="32" height="10" rx="2" class="pg-gold pg-gold-fill"/>`),
  'fish-hook': () =>
    `<path d="M74 10v40a8 8 0 0 1-16 0" class="pg-gold"/>` + PG.fish(38, 66),
  'phone': () =>
    PG.phone(50, 50) +
    [[42, 40], [50, 40], [58, 40], [42, 50], [50, 50], [58, 50], [42, 60], [50, 60], [58, 60]]
      .map(([x, y], i) => `<rect x="${x - 2.5}" y="${y - 2.5}" width="5" height="5" rx="1" class="${i === 4 ? 'pg-gold-solid' : 'pg-ivory-solid'}"/>`).join(''),
  'vote-hands': () =>
    PG.hand(24, 70, 'pg-line') + PG.hand(50, 74, 'pg-line') + PG.hand(76, 70, 'pg-line') +
    PG.card(39, 12, 22, 30, 'pg-gold'),

  // ---- WIN ----
  'trophy-points': () =>
    PG.trophy(50, 22) + PG.token(32, 62, 7) + PG.token(50, 62, 7) + PG.token(68, 62, 7) + PG.txt(50, 90, '+3', true),
  'trophy-first': () =>
    PG.trophy(50, 22) + `<path d="M12 76h76" class="pg-dim"/>` + PG.token(24, 76, 5) + PG.token(46, 76, 5) +
    PG.token(68, 76, 6, 'pg-gold-solid') + PG.flag(84, 64),
  'trophy-team': () =>
    PG.trophy(50, 22) + PG.meeple(28, 68, 'pg-line') + PG.meeple(50, 68, 'pg-line') + PG.meeple(72, 68, 'pg-line'),
  'trophy-standing': () =>
    PG.trophy(50, 22) + PG.meeple(50, 66, 'pg-gold', 'pg-gold-fill', 1.1) +
    PG.meeple(24, 70, 'pg-dim') + PG.cross(24, 70, 'pg-dim') + PG.meeple(76, 70, 'pg-dim') + PG.cross(76, 70, 'pg-dim'),
  'trophy-coins': () =>
    PG.trophy(50, 22) + PG.coinStack(50, 82, 4) + PG.coinEdge(50, 66),
  'trophy-survive': () =>
    PG.trophy(50, 22) + PG.shield(50, 68, 'pg-line') + PG.check(50, 68, 'pg-gold'),
  'trophy-guess': () =>
    PG.trophy(50, 22) + PG.card(39, 50, 22, 30) + PG.check(50, 66, 'pg-gold'),
  'trophy-area': () =>
    PG.trophy(50, 22) +
    `<rect x="26" y="50" width="24" height="20" class="pg-gold-fill"/><rect x="50" y="50" width="24" height="20" class="pg-gold-fill"/><rect x="26" y="70" width="24" height="20" class="pg-gold-fill"/>` +
    `<rect x="26" y="50" width="48" height="40" rx="4" class="pg-line"/><path d="M50 50v40M26 70h48" class="pg-dim"/>`,
  'trophy-rounds': () =>
    PG.trophy(50, 22) + PG.tally(50, 68, 'pg-line'),
  'trophy-lowest': () =>
    PG.trophy(50, 22) + PG.txt(30, 76, '12', false, 14) + PG.cross(30, 72, 'pg-dim') + PG.txt(70, 76, '3', true, 16) + PG.check(70, 86, 'pg-gold'),

  // ---- TURN (strip frames) ----
  'draw-card': () =>
    PG.cardBack(14, 30) + PG.cardBack(18, 26) + PG.card(58, 22, 22, 30, 'pg-gold') + PG.hand(70, 70),
  'play-card': () =>
    `<path d="M10 80h80" class="pg-dim"/>` + PG.card(39, 44, 22, 30, 'pg-gold') + PG.hand(74, 46) + PG.arrow(50, 30, 50, 40),
  'pick-market': () =>
    PG.card(10, 20, 17, 24) + PG.card(31, 20, 17, 24, 'pg-gold') + PG.card(52, 20, 17, 24) + PG.card(73, 20, 17, 24) +
    PG.hand(42, 70),
  'place-worker': () =>
    `<rect x="10" y="44" width="80" height="44" rx="4" class="pg-dim pg-fill"/>` +
    `<circle cx="28" cy="66" r="7" class="pg-dim"/><circle cx="50" cy="66" r="7" class="pg-dim"/><circle cx="72" cy="66" r="7" class="pg-dim"/>` +
    PG.meeple(50, 24, 'pg-gold', 'pg-gold-fill') + PG.arrow(50, 38, 50, 56),
  'roll-dice': () =>
    PG.rot(-18, 34, 50, PG.die(34, 50, 'pg-line', 3, 22)) + PG.rot(22, 66, 54, PG.die(66, 54, 'pg-gold', 5, 22)) +
    PG.whoosh(16, 46) + `<path d="M84 34h8M86 40h6" class="pg-dim"/>`,
  'bid-coins': () =>
    PG.rot(90, 30, 56, PG.hand(30, 56)) + PG.coinStack(60, 66, 3) + PG.coinStack(76, 62, 2) + PG.arrow(46, 36, 78, 36),
  'move-piece': () =>
    `<path d="M14 66q18-40 36-18t36-20" class="pg-dim" stroke-dasharray="1 6"/>` +
    PG.token(14, 66, 4, 'pg-dim') + PG.token(86, 28, 4, 'pg-dim') +
    PG.meeple(38, 44, 'pg-gold', 'pg-gold-fill') + PG.arrow(50, 36, 74, 30),
  'trade-cards': () =>
    PG.card(14, 20, 22, 30, 'pg-gold') + PG.arrow(40, 30, 60, 30) +
    PG.card(64, 50) + PG.arrow(60, 70, 40, 70, 'pg-line'),
  'collect-goods': () =>
    PG.token(20, 26, 5) + `<rect x="30" y="16" width="10" height="10" rx="2" class="pg-ivory-solid"/>` + PG.hex(52, 26, 6, 'pg-line', 'pg-fill') +
    PG.arrow(36, 40, 56, 66) + PG.hand(70, 74),
  'build': () =>
    `<path d="M10 84h80" class="pg-dim"/>` + PG.building(30, 84, 'pg-line', 18, 30) +
    PG.building(62, 72, 'pg-gold', 18, 34) + PG.arrow(62, 20, 62, 32) + `<path d="M80 30h10M85 25v10" class="pg-gold"/>`,
  'attack': () =>
    PG.meeple(26, 52, 'pg-gold', 'pg-gold-fill', 1.2) + PG.burst(50, 50, 'pg-gold') + PG.meeple(74, 52, 'pg-line', 'pg-fill', 1.2),
  'flip-card': () =>
    PG.cardBack(12, 36) + PG.cardEdge(50, 50) + PG.arc(50, 50, 24, -150, -30, 'pg-gold') + PG.card(66, 36, 22, 30, 'pg-gold'),
  'discuss': () =>
    PG.bubble(34, 34, 'pg-line', 2, false, 40, 26) + PG.bubble(66, 66, 'pg-gold', 2, true, 40, 26),
  'speak-clue': () =>
    PG.bubble(50, 46, 'pg-gold', 0, false, 52, 32) + `<path d="M38 46h24" class="pg-gold"/>`,
  'guess': () =>
    PG.card(10, 20, 22, 30) + PG.card(39, 20, 22, 30, 'pg-gold') + PG.card(68, 20, 22, 30) +
    PG.txt(50, 16, '?', false, 12) + PG.hand(50, 74),
  'draw-sketch': () =>
    PG.card(20, 26, 36, 46) + `<path d="M26 62q8-16 14-4t10-10" class="pg-dim"/>` + PG.pencil(66, 54),
  'write': () =>
    PG.sheet(38, 50, 'pg-line', 34, 44) + PG.pencil(68, 56),
  'vote': () =>
    PG.card(16, 10, 20, 28) + PG.card(40, 10, 20, 28, 'pg-gold') + PG.card(64, 10, 20, 28) + PG.check(50, 30, 'pg-gold') +
    PG.hand(26, 70, 'pg-line') + PG.hand(50, 74, 'pg-line') + PG.hand(74, 70, 'pg-line'),
  'reveal': () =>
    PG.cardBack(12, 36, 22, 30, 'pg-dim') + PG.arc(50, 50, 24, -150, -30, 'pg-gold') +
    PG.card(64, 36, 22, 30, 'pg-gold') + PG.hand(46, 76),
  'flick-piece': () =>
    PG.rot(90, 26, 60, PG.hand(26, 60)) + PG.token(56, 60, 8) + PG.arrow(68, 60, 90, 60),
  'pass-turn': () =>
    PG.meeple(50, 22, 'pg-dim') + PG.meeple(78, 50, 'pg-line') + PG.meeple(50, 78, 'pg-dim') + PG.meeple(22, 50, 'pg-dim') +
    PG.arc(50, 50, 20, -60, 15, 'pg-gold'),
  'pick-die': () =>
    PG.die(24, 30, 'pg-line', 4, 16) + PG.die(44, 30, 'pg-line', 2, 16) + PG.die(30, 52, 'pg-line', 6, 16) +
    PG.die(64, 34, 'pg-gold', 5, 18) + PG.hand(72, 70),
  'score-round': () =>
    PG.tally(42, 50, 'pg-line') + PG.check(78, 50, 'pg-gold'),
  'take-or-pay': () =>
    PG.card(39, 18, 22, 30) + PG.token(50, 33, 4.5) +
    `<path d="M50 52v12" class="pg-gold"/>` + PG.arrow(50, 64, 26, 84) + PG.arrow(50, 64, 74, 84),
  'explore': () =>
    PG.regionMap(50, 54, 'pg-dim', 1.1) + PG.meeple(38, 56, 'pg-line') + PG.compass(66, 44, 'pg-gold'),
  'answer': () =>
    `<rect x="14" y="26" width="46" height="46" rx="3" class="pg-line pg-fill"/>` + PG.txt(37, 58, '7', true, 22) + PG.pencil(74, 60),
  'listen': () =>
    PG.ear(38, 50, 'pg-line') + `<path d="M58 40a12 12 0 0 1 0 20M66 32a22 22 0 0 1 0 36" class="pg-gold"/>`,
  'act': () =>
    `<path d="M50 8L24 74M50 8l26 66" class="pg-dim"/><ellipse cx="50" cy="76" rx="30" ry="8" class="pg-dim"/>` +
    `<g transform="translate(50 56) scale(1.3)"><path d="M-3-4L-11-9v3l7 3-2 8h4.5L0 4l1.5 5H6L4-3l7-3v-3l-8 5a3.8 3.8 0 1 0-6 0z" class="pg-gold pg-gold-fill"/></g>`,
  'count-sync': () =>
    PG.card(10, 12, 18, 24) + PG.hand(20, 56, 'pg-line') +
    PG.card(41, 12, 18, 24, 'pg-gold') + PG.hand(50, 60) +
    PG.card(72, 12, 18, 24) + PG.hand(80, 56, 'pg-line'),

  // ---- WATCH OUT ----
  'alert': () =>
    PG.card(58, 34, 26, 36) +
    `<path d="M32 22L10 60h44z" class="pg-gold"/><path d="M32 36v12" class="pg-gold"/><circle cx="32" cy="53" r="1.8" class="pg-gold-solid"/>`,
  'no-talk': () =>
    PG.bubble(50, 46, 'pg-line', 2, false, 48, 32) + `<path d="M22 74L78 22" class="pg-gold"/>`,
  'hidden': () =>
    PG.card(39, 44, 22, 30, 'pg-dim') + PG.eye(50, 34, 'pg-line') + `<path d="M34 50L66 18" class="pg-gold"/>`,
  'bust': () =>
    PG.die(34, 50, 'pg-gold', 'skull', 28) + PG.token(64, 40, 6) + PG.token(78, 54, 4.5, 'pg-dim') + PG.token(66, 66, 3, 'pg-dim') +
    PG.arrow(60, 76, 84, 82, 'pg-dim'),
  'timer': () =>
    PG.hourglass(50, 50, 'pg-line', 0.12, 'pg-gold-solid') + `<path d="M50 52v6" class="pg-gold"/>`,
  'must': () =>
    PG.arrow(14, 62, 70, 62, 'pg-line') + PG.card(72, 48, 18, 26, 'pg-line') + PG.exclaim(42, 40, 'pg-gold'),
  'order': () =>
    `<circle cx="20" cy="50" r="9" class="pg-line pg-fill"/><circle cx="50" cy="50" r="9" class="pg-line pg-fill"/><circle cx="80" cy="50" r="9" class="pg-line pg-fill"/>` +
    PG.txt(20, 54, '1', false) + PG.txt(50, 54, '2', false) + PG.txt(80, 54, '3', false) +
    PG.arrow(31, 50, 39, 50) + PG.arrow(61, 50, 69, 50),
  'count': () =>
    PG.card(24, 30, 26, 36, 'pg-dim') + PG.card(36, 24, 26, 36) +
    `<circle cx="66" cy="28" r="9" class="pg-gold pg-gold-fill"/>` + PG.txt(66, 32, '3', true),
  // Cascadia's gotcha: the approved lock-bag composition, under the library name.
  'lock': () => SCENES['lock-bag'](),

  // ---- TURN ONE ----
  'hand-card': () =>
    PG.card(10, 18, 22, 30) + PG.card(39, 18, 22, 30, 'pg-gold') + PG.card(68, 18, 22, 30) + PG.hand(50, 74) + PG.check(80, 62),
  'hand-worker': () =>
    `<rect x="10" y="14" width="80" height="44" rx="4" class="pg-dim pg-fill"/>` +
    `<circle cx="28" cy="36" r="7" class="pg-dim"/><circle cx="50" cy="36" r="8" class="pg-dim"/><circle cx="72" cy="36" r="7" class="pg-dim"/>` +
    PG.meeple(50, 36, 'pg-gold', 'pg-gold-fill') + PG.hand(60, 78),
  'hand-cheap': () =>
    PG.card(10, 12, 22, 30, 'pg-gold') + PG.card(39, 12, 22, 30) + PG.card(68, 12, 22, 30) +
    PG.token(21, 52, 3) + PG.token(46, 52, 3) + PG.token(54, 52, 3) + PG.token(72, 52, 3) + PG.token(79, 52, 3) + PG.token(86, 52, 3) +
    PG.hand(22, 78),
  'hand-center': () =>
    PG.regionMap(50, 42, 'pg-dim', 1.05) + PG.token(50, 42, 6, 'pg-gold-solid') + PG.hand(68, 82),
  'hand-talk': () =>
    PG.bubble(58, 36, 'pg-line', 0, true, 48, 30) + `<circle cx="47" cy="36" r="2" class="pg-ivory-solid"/><circle cx="58" cy="36" r="2" class="pg-ivory-solid"/><circle cx="69" cy="36" r="2" class="pg-ivory-solid"/>` +
    PG.hand(30, 74),
  'hand-watch': () =>
    PG.eye(50, 30, 'pg-gold') + PG.meeple(26, 70, 'pg-line') + PG.meeple(50, 74, 'pg-line') + PG.meeple(74, 70, 'pg-line'),
  'hand-safe': () =>
    PG.card(10, 14, 22, 30) + PG.card(39, 14, 22, 30) + PG.card(68, 14, 22, 30) + PG.shield(79, 29, 'pg-gold') + PG.hand(70, 74),
};

export const SCENE_NAMES = Object.keys(SCENES);

// Returns the scene as an inline <svg>. The caption beside a scene is its
// accessible text, so the SVG is aria-hidden. An unknown name renders an empty
// <svg> and warns, so a typo in the data never breaks the modal.
export function renderScene(name) {
  const fn = SCENES[name];
  if (!fn) console.warn(`teach-scenes: unknown scene "${name}"`);
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${fn ? fn() : ''}</svg>`;
}
