# Claude Code task: "Teach me in 60 seconds" section in the game modal

Two commits, in this order. Do not start the second until the first is green.

1. **Remove the Stats radar** from the game modal.
2. **Add the Teach section** as the last section of the modal, gated behind `?teach=1`.

Design source of truth: `docs/mockups/teach-60s.html` (copy it in from the attached file). Open it in a browser first. It is the production modal with the Stats section removed and the Teach section appended; the three toggle-bar states are the acceptance states.

Content source of truth: `docs/teach/teach.json` (196 entries keyed by `bggId`), `docs/teach/teach-review.md` (human-readable), `docs/teach/teach-scenes.py` (scene library). Commit all three under `docs/teach/`.

House rules that apply throughout (from earlier specs — unchanged):

- Never put `animation` and `transition` on the same property of the same element. WebKit silently drops the transition. The modal's entrance (`bgs-modal-pop`) lives on `.backdrop .card`; nothing added here may animate or transition at all. There is no motion in this feature.
- Gold rings are `box-shadow: inset`, never `outline`.
- `games.json` round-trips with `json.dump(..., indent=2, ensure_ascii=False)` plus a trailing newline. Diff must be additive only.
- Icons are Tabler line style, 24×24 viewBox, `currentColor` stroke, 1.75 stroke-width, no fill.

---

## Commit 1 — remove the Stats radar

**Why:** Nok's decision. The section is being replaced, not moved.

**`js/game-modal.js`**

- Delete `FP_AXES`, `FP_MAX`, `FP_R`, `FP_LABEL_GAP`, `FP_LABEL_CLEARANCE`, `FP_LABEL_FONT`, `FP_BASELINE_NUDGE`, `FP_RING`, `FP_CX`, `FP_W`, `FP_CY`, `FP_H`, `fingerprintAxes()`, `fpPoint()`, `fingerprintHTML()`.
- In `bodyHTML(g)`, delete the line `${fingerprintHTML(g)}`.

**`css/game-modal.css`**

- Delete the whole `/* ---- Stats fingerprint ---- */` block: `.fp-section`, `.fp-section .why-heading`, `.fp-chart`, `.fp-chart svg`, `.radar-grid`, `.radar-axis`, `.radar-label`, `.radar-shape`, `@keyframes bgs-fp-bloom`, `.radar-dot`, and the `prefers-reduced-motion` rule for `.radar-shape`.

**`games.json`** — leave the `fingerprint` field in place. It is inert data now; removing it is a 196-line diff for no product change. Note it in the commit message.

**`docs/`** — leave `claude-code-spec-details-modal-visuals.md` and the old mockup as history; add one line at the top of that spec: "Stats radar removed in <commit>; the table-shot toggle in this spec still stands."

Verify: open a game with a fingerprint (Cascadia) — no Stats heading, no divider left behind, the tag line is the last thing in the body, Close button fade still overlaps the tag. Grep the repo for `radar` and `fingerprintHTML`: zero hits outside `docs/` and `games.json`.

Commit: `Remove Stats radar from game modal`

---

## Commit 2 — Teach section, gated

### 2.1 Feature flag

Same pattern as `?vibes=1` and `?gamenight=1`: read `new URLSearchParams(location.search).get('teach') === '1'` once at module load in `js/game-modal.js` (or wherever the existing flags are read — match that). When off, `teachHTML()` returns `''` and nothing else in the modal changes. No entry point, no menu item, no copy anywhere mentions the feature until the flag is removed.

### 2.2 Data

**New nullable field on each game in `games.json`, after `caption`:**

```json
"teach": {
  "beats": [
    { "key": "hook",   "label": "Hook",        "scene": "hexes-tokens",   "caption": "…" },
    { "key": "win",    "label": "How you win", "scene": "trophy-points",  "caption": "…" },
    { "key": "turn",   "label": "Your turn",   "scene": "strip",
      "steps": [ { "scene": "pick-pair", "caption": "…" }, { "scene": "place-tile", "caption": "…" }, { "scene": "place-token", "caption": "…" } ],
      "caption": "…" },
    { "key": "gotcha", "label": "Watch out",   "scene": "lock",           "caption": "…" },
    { "key": "first",  "label": "Turn one",    "scene": "hand-pair",      "caption": "…" }
  ],
  "wordCount": 58,
  "source": "generated",
  "reviewed": false
}
```

**Merge script — `scripts/merge-teach.py`:**

- Reads `docs/teach/teach.json` and `games.json`.
- For each game, if `teach.json` has its `bggId`, insert `teach` after `caption` (preserve key order; use a plain `dict` and rebuild in order, or `OrderedDict`).
- Skip entries with `"confidence": "low"` unless `--include-low` is passed. Print the skipped titles.
- Never overwrite an existing `teach` whose `reviewed` is `true` unless `--force`.
- Write with `indent=2, ensure_ascii=False` and a trailing newline. Exit non-zero if any resulting `beats` array isn't exactly five with those keys in that order, or any caption exceeds 12 words (strip frames: 6).
- Run it once. Commit the resulting `games.json` diff — it must be additive.

`confidence` stays in `teach.json` only; do not copy it into `games.json`.

### 2.3 Scene library — `js/teach-scenes.js`

New ES module. Exports `renderScene(name) → SVG string` and `SCENE_NAMES`.

Start from the `PG` primitives and the seven Cascadia `SCENES` in the mockup (copied below verbatim — keep them byte-for-byte, they're already approved). Then add every scene in `docs/teach/teach-scenes.py` that has a non-zero usage count in `teach-review.md` (three are unused; skip them). Each scene:

- Draws into a `0 0 100 100` box. Nothing outside it. Keep a 6px margin from the edges; text baselines no lower than y=96.
- Uses only the `pg-*` classes below. **Gold is the thing the player does; ivory is the world.** Dim ivory for things that exist but aren't in play this frame. One gold element per scene, two at most.
- Is composed from primitives. New primitives you need (`die`, `meeple`, `coin`, `banknote`, `gavel`, `shield`, `skull`, `pencil`, `sheet`, `bubble`, `hourglass`, `eye`, `magnifier`, `gear`, `building`, `flag`, `tally`, `compass`) go into `PG`, each drawn once as a function `(x, y, cls) →` string, in the same Tabler stroke language as the existing icons in `game-modal.js`. Simplify Tabler paths rather than tracing them.
- Unknown scene name → return an empty `<svg>` (so a data typo never breaks the modal) and `console.warn` it.

**Contact sheet — `docs/mockups/teach-scenes.html`:** a static page that imports `teach-scenes.js` and renders every scene in a labelled grid on the plate background, at 84px and at 180px. This is how Nok reviews the artwork; it is a deliverable, not scaffolding. Screenshot it at both sizes and look at it before you call the commit done: nothing clipped, nothing that reads as a different object at 84px than at 180px.

### 2.4 Rendering — `js/game-modal.js`

Import `renderScene` from `./teach-scenes.js`. Add `SCHOOL_ICON`, `ALERT_ICON`, `PENCIL_ICON` next to the existing icon constants (below). Add `teachHTML(g)` and `beatHTML(b)` from the mockup (below), with one change: **scene SVGs are `aria-hidden="true"`**, not `role="img"`. The caption beside each scene is the accessible text; naming the scene as well would read everything twice.

In `bodyHTML(g)`, append `${teachHTML(g)}` after `<span class="tag">…</span>`. It is the last thing in the body.

All-or-nothing, same contract as the old fingerprint: `teachHTML` returns `''` if the flag is off, if `g.teach` is missing, or if `beats` isn't an array of five. No divider is ever left behind.

Draft label: render `.teach-draft` when `g.teach.reviewed !== true`.

The results screen's `i` button and the waiting-room pages all open this same modal through `game-modal.js`, so the section appears there automatically. Do not add anything to `results.html`.

### 2.5 CSS — `css/game-modal.css`

Append the block below after the `.card-sticky` rules, before the focus-visible rule. Two deviations from the mockup, both deliberate:

- `.teach-frame__num` colour is `var(--bgs-gold)`, not `--bgs-gold-dim`. Gold-dim on the plate is ~4.0:1; at 10px that's text and needs 4.5:1. Full gold is ~8:1.
- Drop the `transition` on `.teach-beat__text` and `.teach-frame__cap` — they existed for the read-aloud toggle, which is gone. With them gone there is no motion in this feature and nothing to add under `prefers-reduced-motion`.

`.teach-draft` uses `--bgs-gold-dim` at 11px, which is the same contrast deviation `.why-heading` already makes. Keep it consistent with the heading; if Nok wants both fixed, that's a separate change.

### 2.6 Verification checklist

Desktop and iOS Safari, `?teach=1` on and off:

- [ ] Flag off: modal is byte-identical to Commit 1 output. Grep the rendered DOM for `teach-`: zero hits.
- [ ] Flag on, Cascadia: section renders last, matches `teach-60s.html` "With teach" state at 390px and at 440px.
- [ ] Flag on, a game with no `teach` (any `confidence: low` title that was skipped): no heading, no divider, tag is last.
- [ ] Flag on, any unreviewed game: draft line under the heading.
- [ ] Results screen `i` button on a winner with `teach`: section present.
- [ ] Beats are an `<ol>`; VoiceOver reads "list, 5 items", each caption once, no scene descriptions.
- [ ] Strip frames stay three-across at 390px with captions on ≤2 lines; the footer line is under all three.
- [ ] Contact sheet: every used scene renders, nothing clips, gold appears in every scene at most twice.
- [ ] `git diff games.json` is additive only; file ends with a newline; `python3 -c "import json;json.load(open('games.json'))"` passes.
- [ ] Lighthouse a11y on the shelf with the modal open: no new contrast failures.
- [ ] No `transition` or `animation` on any `.teach-*` or `.pg-*` selector.

Commit: `Add "Teach me in 60 seconds" section to game modal (behind ?teach=1)`

Do **not** remove the flag in this task.

---

## Appendix A — CSS block (from the mockup; apply the two deviations in 2.5)

```css
/* =====================================================================
   2. NEW — the "Teach me in 60 seconds" section. Rendered only when the
      game carries a `teach` field, in the same all-or-nothing way as
      Stats; when absent, no section, no divider. Always the last section,
      so the modal reads cover → who/how long → why → how to play.
   ===================================================================== */
.teach-section{
  margin-top:20px;padding-top:18px;
  border-top:1px solid rgba(var(--bgs-ivory-rgb),0.10);
}
.teach-section .why-heading{margin-top:0;display:flex;align-items:center;gap:6px;}
.teach-section .why-heading svg{color:var(--bgs-gold);}

/* Draft label — shown only while teach.reviewed is false. Sits directly
   under the heading, in the heading's own voice. */
.teach-draft{
  display:flex;align-items:center;gap:7px;
  font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.02em;
  color:var(--bgs-gold-dim);margin:-4px 0 12px;
}
.teach-draft svg{flex-shrink:0;}

/* -- The five beats ----------------------------------------------------
   Picture first, caption second. Each beat is an 84px scene beside a
   twelve-word caption; "Your turn" is the exception — a three-frame strip,
   because a turn *is* a sequence and the layout should say so.
   Scenes are inline SVG from the shared pictogram library, in the Tabler
   line style the app already uses for icons: ivory strokes for the world,
   gold for the one thing the player does. */
.teach-beats{list-style:none;margin:0;padding:0;}
.teach-beat{
  display:grid;grid-template-columns:84px 1fr;gap:14px;align-items:center;
  padding:12px 0;border-bottom:1px solid rgba(var(--bgs-ivory-rgb),0.10);
}
.teach-beat:first-child{padding-top:2px;}
.teach-beat:last-child{border-bottom:none;padding-bottom:4px;}
.teach-beat--strip{grid-template-columns:1fr;gap:10px;}
.teach-scene{
  width:84px;height:84px;border-radius:10px;
  background:rgba(var(--bgs-bg-rgb),0.35);
  border:1px solid rgba(var(--bgs-ivory-rgb),0.08);
  display:flex;align-items:center;justify-content:center;
}
.teach-scene svg{width:100%;height:100%;display:block;overflow:visible;}
.teach-beat__label{
  display:flex;align-items:center;gap:6px;
  font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.08em;
  text-transform:uppercase;color:var(--bgs-gold-dim);margin:0 0 4px;
}
.teach-beat__label svg{color:var(--bgs-gold);}
.teach-beat__text{font-size:15px;line-height:1.45;color:var(--bgs-ivory);margin:0;}
/* the three-frame strip */
.teach-strip{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.teach-frame{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;}
.teach-frame .teach-scene{position:relative;width:100%;height:auto;aspect-ratio:1/1;}
.teach-frame__cap{font-size:12px;line-height:1.35;color:var(--bgs-ivory-70);margin:0;text-align:center;}
.teach-frame__num{
  position:absolute;top:6px;left:6px;
  font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;color:var(--bgs-gold-dim);
}
.teach-beat--strip .teach-beat__text{color:var(--bgs-ivory-70);font-size:13.5px;}
/* SVG palette — CSS vars so the scenes retheme with the app */
.pg-line{stroke:var(--bgs-ivory);stroke-opacity:.72;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;}
.pg-dim{stroke:var(--bgs-ivory);stroke-opacity:.32;fill:none;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;}
.pg-fill{fill:rgba(var(--bgs-ivory-rgb),.06);}
.pg-gold{stroke:var(--bgs-gold);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.pg-gold-fill{fill:rgba(var(--bgs-gold-rgb),.20);}
.pg-gold-solid{fill:var(--bgs-gold);}
.pg-ivory-solid{fill:var(--bgs-ivory);fill-opacity:.72;}
.pg-mono{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;fill:var(--bgs-gold);}

/* Word budget footer — the discipline the format depends on. */
.teach-foot{
  font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--bgs-ivory-45);
  margin:12px 0 0;text-align:center;
}

@media (prefers-reduced-motion:reduce){.backdrop .card{animation:none;}}
.rm .backdrop .card{animation:none;}

```

## Appendix B — icons (add beside the existing icon constants)

```js
const ic = (paths, s = 15, w = 1.75) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const SCHOOL_ICON = ic('<path d="M22 9l-10-4-10 4 10 4 10-4v6"/><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4"/>', 16);
const ALERT_ICON  = ic('<path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87l-8.106-13.536a1.914 1.914 0 0 0-3.274 0z"/><path d="M12 16h.01"/>', 13);
const PENCIL_ICON = ic('<path d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16v4"/><path d="M13.5 6.5l4 4"/>', 13);
```

## Appendix C — pictogram library, Cascadia scenes, and renderers (from the mockup)

`PG` and `SCENES` go to `js/teach-scenes.js`; `beatHTML` and `teachHTML` go to `js/game-modal.js`. Change `role="img" aria-label="…"` to `aria-hidden="true"` on both `<svg>` elements, add the flag check and the five-beat guard to `teachHTML`.

```js
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
};
const scene = (name, label) =>
  `<div class="teach-scene"><svg viewBox="0 0 100 100" role="img" aria-label="${label}">${SCENES[name] ? SCENES[name]() : ''}</svg></div>`;

function beatHTML(b) {
  const icon = b.key === 'gotcha' ? ALERT_ICON : '';
  if (b.scene === 'strip') {
    return `
      <li class="teach-beat teach-beat--strip">
        <p class="teach-beat__label">${icon}${b.label}</p>
        <div class="teach-strip">
          ${b.steps.map((s, i) => `
            <div class="teach-frame">
              <div class="teach-scene"><span class="teach-frame__num">${i + 1}</span><svg viewBox="0 0 100 100" role="img" aria-label="${s.caption}">${SCENES[s.scene]()}</svg></div>
              <p class="teach-frame__cap">${s.caption}</p>
            </div>`).join('')}
        </div>
        <p class="teach-beat__text">${b.caption}</p>
      </li>`;
  }
  return `
    <li class="teach-beat">
      ${scene(b.scene, b.label)}
      <div>
        <p class="teach-beat__label">${icon}${b.label}</p>
        <p class="teach-beat__text">${b.caption}</p>
      </div>
    </li>`;
}

// Rendered only when the game has a `teach` field; otherwise nothing is
// emitted, so no divider is left behind — nothing is left behind.
function teachHTML(g, { draft = false } = {}) {
  const t = g.teach;
  if (!t || !Array.isArray(t.beats) || !t.beats.length) return '';
  return `
    <section class="teach-section">
      <p class="why-heading">${SCHOOL_ICON} Teach me in 60 seconds</p>
      ${draft ? `<p class="teach-draft">${PENCIL_ICON} Draft — not yet checked against the rulebook</p>` : ''}
      <ol class="teach-beats">
        ${t.beats.map(beatHTML).join('')}
      </ol>
      <p class="teach-foot">${t.wordCount} words · five pictures</p>
    </section>`;
}

```
