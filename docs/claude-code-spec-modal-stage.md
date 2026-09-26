# Claude Code spec — Game detail modal: "The stage" + "The lift"

Two ordered commits. Commit 1 restyles the shared game detail modal
(`js/game-modal.js` + `css/game-modal.css`) into the locked "stage" design
and removes the Teach section, the back-of-box flip and the BGG line.
Commit 2 adds the shelf → modal transition ("the lift"): the tapped cover
flies from its shelf card to its place on the stage.

Design reference: Design canvas "Game modal — 3 options", artboards
"C · The stage (locked)" and "T1 · The lift". Sample game on the canvas is
Viticulture Essential Edition (landscape cover); Ark Nova / portrait covers
follow the same rules.

The modal is shared by shelf.html, the game-night waiting room, the swipe
screen and the results screen. Everything below lands on all of them; only
the shelf passes a transition origin (Commit 2).

Stop for review after each commit.

---

## Hard rules (apply to both commits)

- **WebKit animation/transition rule.** Never put both `animation` and
  `transition` on the same CSS property of the same element — WebKit drops the
  transition silently. `.backdrop .card` currently has
  `animation: bgs-modal-pop` (opacity + transform). That keyframe animation is
  **deleted** in Commit 1; opacity/transform on the backdrop and card are
  driven by transitions only from then on. Where two motions share an element
  (the ghost's move and its crop) they live on different properties
  (`transform`, `clip-path`); nothing else animates on the ghost.
- Focus rings and gold rings via `box-shadow: inset`, never `outline`.
- No `backdrop-filter` over content that scrolls under it (the `.modal__close`
  comment in the current CSS explains why). The corner close button and the
  gold Add pill are tinted plates, not blurred glass — see Deviations.
- Token names verbatim from `css/base.css`.
- `games.json` is not touched. The `teach` fields stay in the data, inert.

---

## Commit 1 — `feat(modal): restyle the game detail modal as the stage`

### 1a. Remove

**Teach section** — delete from `js/game-modal.js`: `TEACH_ENABLED`,
`teachVisible`, `TEACH_BEAT_KEYS`, `beatHTML`, `teachHTML`, the
`renderScene` import, `SCHOOL_ICON`, `ALERT_ICON`, `PENCIL_ICON`, and the
`${teachHTML(g)}` call in `bodyHTML`. Delete the `.teach-*` and `.pg-*` rules
from `css/game-modal.css` (from `/* ---- Teach me in 60 seconds ---- */` to
`.teach-foot`). Leave `js/teach-scenes.js` in place (unused after this; a
follow-up can delete it). `?teach=1` no longer does anything.

**Back-of-box flip** — delete `coverHTML`'s `if (g.backImage)` branch,
`wireFlip`, and the `.flip-scene / .flip-card / .flip-face / .flip-front /
.flip-back / .flip-hint` rules. Every game now renders the single-cover
branch. `backImage` stays in the data, ignored.

**Footer Close** — delete the `<button class="modal__close" id="modalCloseBtn">`
from `createGameModal`'s markup, its click listener, and the
`.card-sticky .modal__close` + `body:not(.gn-selecting) .card-sticky .modal__close`
rules. Closing is the corner ×, backdrop tap, and (Commit 2) swipe-down.

**BGG** — nothing to add. No BGG link or badge in the modal; the "Powered by
BGG" attribution stays where it already lives on the pages.

### 1b. New body markup

Replace `bodyHTML(g)`:

```js
function bodyHTML(g) {
  return `
    <div class="stage-hero">
      <span class="stage-light" aria-hidden="true"></span>
      ${mediaHTML(g)}
    </div>
    ${g.tag ? `<p class="stage-eyebrow">${g.tag}</p>` : ''}
    <h2 class="stage-title">${g.title}</h2>
    <p class="stage-meta">
      <span class="stage-meta__item">${PLAYERS_ICON}${playersRangeLabel(g.players)}${bestAtLabel(g)}</span>
      <span class="stage-meta__sep" aria-hidden="true">·</span>
      <span class="stage-meta__item">${TIME_ICON}${timeLabel(g.time)}</span>
      <span class="stage-meta__sep" aria-hidden="true">·</span>
      <span class="stage-meta__item">${WEIGHT_ICON}${weightLabel(g.weightScore)}</span>
    </p>
    <p class="blurb">${g.blurb}</p>
    ${highlightsHTML(g)}`;
}
```

- `.tag` (the old pill after Highlights) moves up to become the eyebrow.
  Delete the `.backdrop .card .tag` rule.
- `.stat-row` / `.stat-chip` are gone; delete their rules. Keep the three icon
  constants but change their size attributes to `width="14" height="14"`.
- `coverHTML(g)` keeps its single-cover branch. Change the wrapper class from
  `card-cover-wrap` to `stage-cover-wrap` and drop the inline
  `style="background:${g.color}22"` — the stage has no plate behind the
  cover; on image error set `this.parentElement.style.background` to
  `${g.color}` as today so a missing cover still shows a tinted box.
- `mediaHTML(g)` unchanged in behaviour: games with `tableShot` still get the
  cover/table crossfade and the `.media-toggle-row` under the hero. Rename the
  wrapper reference from `.card-cover-wrap` accordingly. The toggle row keeps
  its current styling.

**Best at** — new helper in `js/game-modal.js` (not in filters.js; it is
display-only):

```js
// "best at 3–4" from playerRecommendations ({ "3": "best", "4": "best", … }).
// Contiguous run → "3–4"; single → "3"; gaps → "2, 4". Nothing → ''.
function bestAtLabel(g) {
  const rec = g.playerRecommendations;
  if (!rec) return '';
  const best = Object.keys(rec).filter((k) => rec[k] === 'best').map(Number).sort((a, b) => a - b);
  if (!best.length) return '';
  const runs = [];
  for (const n of best) {
    const r = runs[runs.length - 1];
    if (r && n === r[1] + 1) r[1] = n; else runs.push([n, n]);
  }
  const txt = runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');
  return ` <span class="stage-meta__best">· best at ${txt}</span>`;
}
```

### 1c. Shell markup

`createGameModal` markup becomes:

```html
<div class="backdrop" id="backdrop">
  <div class="card stage" id="card">
    <button class="close-btn" id="close-btn" type="button" aria-label="Close">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <div id="card-body"></div>
    <div class="card-sticky" id="cardSticky">
      ${selection ? '<button class="modal__add" id="modalAddBtn" type="button"></button>' : ''}
    </div>
  </div>
</div>
```

`open()` / `close()` keep their bodies for now (Commit 2 rewrites them), minus
the `wireFlip(body)` call.

### 1d. CSS

Replace the modal, cover, stat, close and sticky blocks in
`css/game-modal.css` with the following. Highlights (`.why-heading`,
`.why-list`), blurb, media-stack/toggle and focus rules stay as they are
except where noted.

```css
/* ---- shell ---- */
.backdrop{
  position:fixed;inset:0;
  background:rgba(var(--bgs-bg-rgb),0.78);
  display:flex;align-items:center;justify-content:center;
  padding:0;
  z-index:30;
  opacity:0;visibility:hidden;
  transition:opacity .4s ease, visibility 0s linear .4s;
}
.backdrop.open{opacity:1;visibility:visible;transition:opacity .4s ease;}

/* Phone: the modal is the whole screen. */
.backdrop .card.stage{
  position:relative;
  width:100%;height:100%;
  background:var(--bgs-bg);
  border:none;border-radius:0;
  display:flex;flex-direction:column;
  overflow:hidden;
}
#card-body{
  flex:1 1 auto;min-height:0;overflow-y:auto;
  padding:0 24px calc(40px + env(safe-area-inset-bottom));
}
/* Bottom fade so the last line reads as scrollable. */
.backdrop .card.stage::after{
  content:"";position:absolute;left:0;right:0;bottom:0;height:60px;z-index:4;
  background:linear-gradient(to top, var(--bgs-bg), rgba(var(--bgs-bg-rgb),0));
  pointer-events:none;
}

/* Desktop: a centred panel with the same insides. */
@media (min-width:700px){
  .backdrop{padding:24px;}
  .backdrop .card.stage{
    width:560px;height:auto;max-height:90vh;
    border-radius:20px;
    border:1px solid rgba(var(--bgs-gold-rgb),0.3);
  }
  .backdrop .card.stage::after{border-radius:0 0 20px 20px;}
}

/* ---- hero ---- */
.stage-hero{
  position:relative;
  display:flex;flex-direction:column;align-items:center;
  padding-top:calc(84px + env(safe-area-inset-top));
}
.stage-light{
  position:absolute;left:-64px;right:-64px;top:20px;height:380px;
  background:radial-gradient(ellipse at 50% 62%,
    rgba(var(--bgs-gold-rgb),0.30) 0%,
    rgba(var(--bgs-gold-rgb),0.10) 40%,
    rgba(var(--bgs-gold-rgb),0) 68%);
  pointer-events:none;
}
.stage-cover-wrap{
  position:relative;
  width:min(300px, calc(100vw - 90px));
  min-height:80px;
  border-radius:8px;overflow:hidden;
  box-shadow:0 30px 50px -18px rgba(0,0,0,0.8), 0 0 0 1px rgba(var(--bgs-ivory-rgb),0.06);
}
.card-cover{display:block;width:100%;height:auto;}
@media (min-width:700px){ .stage-cover-wrap{width:300px;} }
/* media-stack: the cover layer keeps sizing the block, as today. */
.stage-hero .media-stack{width:min(300px, calc(100vw - 90px));position:relative;}
@media (min-width:700px){ .stage-hero .media-stack{width:300px;} }
.stage-hero .media-toggle-row{margin-top:14px;}

/* ---- text ---- */
.stage-eyebrow{
  margin:26px 0 0;text-align:center;
  font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:500;
  letter-spacing:.08em;text-transform:uppercase;color:var(--bgs-gold);
}
.backdrop .card h2.stage-title{
  margin:8px 0 0;text-align:center;
  font-family:'Fraunces',serif;font-weight:600;font-size:30px;line-height:1.1;
  color:var(--bgs-ivory);
}
.stage-eyebrow + .stage-title{margin-top:8px;}
.stage-hero + .stage-title{margin-top:26px;}
.stage-meta{
  margin:12px 0 0;
  display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;
  font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--bgs-ivory-70);
}
.stage-meta__item{display:inline-flex;align-items:center;gap:5px;}
.stage-meta__item .stat-icon{color:var(--bgs-icon-gold);flex-shrink:0;}
.stage-meta__sep{color:rgba(var(--bgs-ivory-rgb),0.35);}
.stage-meta__best{color:var(--bgs-gold);}
.backdrop .card p.blurb{margin:22px 0 0;font-size:15px;line-height:1.6;color:var(--bgs-ivory-70);}
.why-heading{margin-top:18px;}          /* was whatever it is today; keep the rest */

/* ---- close ---- */
.close-btn{
  position:absolute;top:calc(16px + env(safe-area-inset-top));right:16px;z-index:10;
  width:44px;height:44px;border-radius:50%;border:none;padding:0;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  color:var(--bgs-ivory);
  background:rgba(var(--bgs-plate-rgb),0.92);
  box-shadow:inset 0 0 0 1px rgba(var(--bgs-gold-rgb),0.28),
             inset 1px 1px 0 rgba(var(--bgs-ivory-rgb),0.22),
             0 8px 24px -10px rgba(0,0,0,0.6);
}
@media (min-width:700px){ .close-btn{top:16px;} }

/* ---- selection mode: one floating gold pill ---- */
.card-sticky{
  position:absolute;left:0;right:0;bottom:0;z-index:5;
  display:flex;justify-content:center;
  padding:0 20px calc(24px + env(safe-area-inset-bottom));
  pointer-events:none;
}
.card-sticky .modal__add{
  pointer-events:auto;
  height:48px;padding:0 22px;border-radius:24px;border:none;cursor:pointer;
  background:var(--bgs-gold);color:var(--bgs-on-gold);
  font:inherit;font-size:13.5px;font-weight:700;
  display:flex;align-items:center;gap:8px;
  box-shadow:0 12px 32px -12px rgba(0,0,0,0.6);
}
.card-sticky .modal__add.is-in{
  background:rgba(var(--bgs-plate-rgb),0.92);color:var(--bgs-gold);
  box-shadow:inset 0 0 0 1.5px rgba(var(--bgs-gold-rgb),0.55), 0 12px 32px -12px rgba(0,0,0,0.6);
}
.card-sticky .modal__add svg{width:15px;height:15px;}
body:not(.gn-selecting) .card-sticky{display:none;}
body.gn-selecting #card-body{padding-bottom:calc(96px + env(safe-area-inset-bottom));}
```

Delete `@keyframes bgs-modal-pop`. Delete `.card-cover-wrap`, `.stat-row`,
`.stat-chip`, `.backdrop .card .tag`, the old `.close-btn:hover`, the
`prefers-reduced-transparency` block for `.modal__close`, and the flip and
teach blocks. Update the focus-ring selector list to drop
`.card-sticky button` if it no longer matches anything relevant (keep it for
`.modal__add`).

### 1e. Verification — Commit 1

- [ ] Shelf, night-host waiting room, vote-swipe and results all open the modal
      with no console errors; `?teach=1` shows nothing extra.
- [ ] A game with `backImage` (Ark Nova, Viticulture…) shows one cover, no
      hint text, no flip on tap or swipe.
- [ ] A game with `tableShot` still shows the Cover / On the table toggle under
      the hero, crossfade intact.
- [ ] Meta line: `1–6 · best at 3–4 · 45–90m · 2.9 / 5` for Viticulture;
      a game without `playerRecommendations` shows no "best at".
- [ ] Portrait and landscape covers both uncropped, 300px wide, centred under
      the gold light; the light scrolls with the cover.
- [ ] Phone: modal fills the screen; content scrolls under the bottom fade;
      × sits clear of the status bar (safe-area).
- [ ] ≥700px: 560px panel, gold hairline, max 90vh, scrolls inside.
- [ ] Selection mode on the shelf: gold "Add to tonight" pill floats at the
      bottom, toggles to the outlined "In tonight's deck"; outside selection
      mode nothing is at the bottom.
- [ ] × and backdrop tap close. No "Close" text button anywhere.
- [ ] `grep -n animation css/game-modal.css` returns nothing for the shell.
- [ ] Reading five games in a row on iOS Safari does not reload the page
      (body is still emptied on close).

---

## Commit 2 — `feat(modal): lift the cover from the shelf into the modal`

### 2a. Idea

One element moves: a fixed-position **ghost** copy of the tapped cover. It
starts exactly over the shelf card's art (same crop), flies to the stage
cover's rectangle while the crop relaxes to the full box art, then hands off
to the real cover. Backdrop fades to `--bgs-bg` underneath; light, text and
× come in behind it. Close plays it in reverse.

Everything is `transform` + `clip-path` + `opacity`. No layout animates.

### 2b. API

`open(game, { from } = {})` — `from` is the shelf element whose bounds the
cover should lift from: the `.game-card .art` in grid view, the
`.gbox .face` in shelf view. Both crop the cover with
`object-fit:cover; object-position:center top`, which is what the ghost's
starting clip reproduces. Callers that pass nothing (waiting room, swipe,
results) get a plain fade.

shelf.html — pass the origin:

```js
// before
el.addEventListener('click', ev => onTileClick(ev, g, el));
…
function openCard(g){ gameModal.open(g); }

// after
el.addEventListener('click', ev => onTileClick(ev, g, el));
…
function onTileClick(ev, g, el){
  const from = el.querySelector('.art, .face');
  …every `openCard(g)` in here becomes `openCard(g, from)`…
}
function openCard(g, from){ gameModal.open(g, { from }); }
```

### 2c. Modal state

```css
/* Pieces that come in behind the ghost. */
.stage-light, .stage-eyebrow, .stage-title, .stage-meta, .blurb, .why-heading, .why-list,
.media-toggle-row, .close-btn, .card-sticky{ opacity:0; }
.stage-eyebrow, .stage-title, .stage-meta, .blurb, .why-heading, .why-list, .media-toggle-row{
  transform:translateY(18px);
}
.close-btn{transform:scale(.8);}

.card.stage.is-in .stage-light{opacity:1;transition:opacity .5s ease .15s;}
.card.stage.is-in :is(.stage-eyebrow,.stage-title,.stage-meta,.blurb,.why-heading,.why-list,.media-toggle-row){
  opacity:1;transform:none;
  transition:opacity .35s ease .3s, transform .45s cubic-bezier(.2,.8,.2,1) .3s;
}
.card.stage.is-in .close-btn,
.card.stage.is-in .card-sticky{opacity:1;transform:none;transition:opacity .25s ease .4s, transform .25s ease .4s;}

/* Leaving: text goes first, quickly, no delay. */
.card.stage.is-out :is(.stage-light,.stage-eyebrow,.stage-title,.stage-meta,.blurb,.why-heading,.why-list,.media-toggle-row,.close-btn,.card-sticky){
  opacity:0;transition:opacity .2s ease;
}

/* The real cover is hidden while the ghost is in flight. */
.card.stage.is-lifting .stage-cover-wrap{visibility:hidden;}

/* The ghost. Sized to the DESTINATION rect; transform + clip-path carry it
   to/from the shelf. Two properties, two transitions, one element — the
   WebKit rule is satisfied because nothing here is a keyframe animation. */
.lift-ghost{
  position:fixed;z-index:31;
  border-radius:8px;overflow:hidden;
  transform-origin:0 0;
  pointer-events:none;
  will-change:transform, clip-path;
  transition:transform .55s var(--ease-liquid), clip-path .55s var(--ease-liquid);
}
.lift-ghost img{display:block;width:100%;height:100%;}

/* Plain fade for openers with no origin, and for reduced motion. */
.backdrop.no-lift .card.stage{transform:scale(.96);transition:transform .35s var(--ease-liquid);}
.backdrop.no-lift.open .card.stage{transform:none;}
@media (prefers-reduced-motion:reduce){
  .backdrop{transition-duration:.15s;}
  .card.stage :is(.stage-light,.stage-eyebrow,.stage-title,.stage-meta,.blurb,.why-heading,.why-list,.media-toggle-row,.close-btn,.card-sticky){
    transform:none;transition:none;
  }
  .backdrop.no-lift .card.stage{transform:none;transition:none;}
}
```

Note: the `.blurb` / `.why-*` selectors above must stay scoped — prefix them
with `.card.stage` in the file (`.card.stage .blurb` etc.) so nothing outside
the modal is affected.

### 2d. JS

Replace `open` / `close` in `createGameModal`:

```js
const card = document.getElementById('card');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let origin = null;        // the shelf element we lifted from
let ghost  = null;
let settle = 0;           // timeout id for the hand-off

function coverRect(){
  return body.querySelector('.stage-cover-wrap')?.getBoundingClientRect();
}

// Places the ghost over `rect` as the shelf crops it (cover-fit, centred,
// top-aligned) given the ghost's own box `dest`.
function shelfTransform(rect, dest){
  const s = Math.max(rect.width / dest.width, rect.height / dest.height);
  const dx = rect.left + (rect.width  - dest.width  * s) / 2 - dest.left;
  const dy = rect.top - dest.top;
  const insetX = (dest.width  - rect.width  / s) / 2;
  const insetB =  dest.height - rect.height / s;
  return {
    transform: `translate(${dx}px, ${dy}px) scale(${s})`,
    clip: `inset(0 ${insetX}px ${insetB}px ${insetX}px)`,
  };
}

function makeGhost(dest, src){
  const el = document.createElement('div');
  el.className = 'lift-ghost';
  el.style.left = `${dest.left}px`;
  el.style.top = `${dest.top}px`;
  el.style.width = `${dest.width}px`;
  el.style.height = `${dest.height}px`;
  el.innerHTML = `<img src="${src}" alt="">`;
  document.body.appendChild(el);
  return el;
}

function killGhost(){
  clearTimeout(settle);
  ghost?.remove();
  ghost = null;
  card.classList.remove('is-lifting');
}

function open(game, { from } = {}){
  killGhost();
  openGame = game;
  body.innerHTML = bodyHTML(game);
  body.scrollTop = 0;
  wireMediaToggle(body);
  refreshFooter();
  card.classList.remove('is-out');

  const fromImg = from?.querySelector('img');
  const lift = from && fromImg && fromImg.complete && fromImg.naturalWidth && !reduced.matches;

  // The stage cover takes the shelf's already-decoded bitmap first, so the
  // block has its final height before the mid-size image arrives.
  const coverImg = body.querySelector('.card-cover');
  if (lift && coverImg){
    coverImg.style.aspectRatio = `${fromImg.naturalWidth} / ${fromImg.naturalHeight}`;
    const hi = coverImg.src;
    coverImg.src = fromImg.currentSrc || fromImg.src;
    const pre = new Image();
    pre.onload = () => { if (openGame === game) coverImg.src = hi; };
    pre.src = hi;
  }

  backdrop.classList.toggle('no-lift', !lift);
  backdrop.classList.add('open');
  syncScrollLock();

  if (!lift){
    origin = null;
    requestAnimationFrame(() => card.classList.add('is-in'));
    return;
  }

  origin = from;
  card.classList.add('is-lifting');
  const dest = coverRect();                 // forces layout with the modal visible
  const start = shelfTransform(from.getBoundingClientRect(), dest);
  ghost = makeGhost(dest, coverImg.src);
  ghost.style.transform = start.transform;
  ghost.style.clipPath = start.clip;
  // Two frames: one to commit the start state, one to transition from it.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ghost.style.transform = 'none';
    ghost.style.clipPath = 'inset(0)';
    card.classList.add('is-in');
    settle = setTimeout(killGhost, 600);   // hand-off; transitionend is not relied on
  }));
}

function close(){
  if (!backdrop.classList.contains('open')) return;
  const game = openGame;
  openGame = null;
  card.classList.remove('is-in');
  card.classList.add('is-out');

  const dest = coverRect();
  const onScreen = origin && document.contains(origin) && (() => {
    const r = origin.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  })();
  const lift = onScreen && dest && !reduced.matches;

  const finish = () => {
    killGhost();
    backdrop.classList.remove('open');
    card.classList.remove('is-out');
    syncScrollLock();
    body.innerHTML = '';                    // release the cover bitmap, as today
    origin = null;
  };

  if (!lift){ finish(); return; }

  killGhost();
  card.classList.add('is-lifting');
  const img = body.querySelector('.card-cover');
  ghost = makeGhost(dest, img?.currentSrc || img?.src || '');
  const end = shelfTransform(origin.getBoundingClientRect(), dest);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ghost.style.transform = end.transform;
    ghost.style.clipPath = end.clip;
    backdrop.classList.remove('open');      // backdrop fades under the returning ghost
    settle = setTimeout(finish, 560);
  }));
}
```

- `.backdrop.open` removal in `close()` must not hide the ghost: the ghost is
  a child of `body`, not the backdrop, and sits at `z-index:31`.
- If the shelf re-renders between open and close (filter change behind the
  modal), `document.contains(origin)` is false and close falls back to the
  plain fade. Same if the origin scrolled off screen.
- `refreshFooter`, backdrop-tap close and `registerOverlay` are unchanged.

### 2e. Swipe-down to close (phone only)

On `#card-body`, when `scrollTop === 0` and a touch moves down by more than
90px with `|dy| > |dx|`, call `close()`. Track `touchstart` / `touchmove`
(passive) / `touchend`; do nothing while the body is scrolled. No visual
follow-the-finger — the lift itself is the dismissal animation.

### 2f. Layout constants

| Constant | Value |
|---|---|
| Ghost / cover destination | the `.stage-cover-wrap` rect, measured on open |
| Lift duration / easing | 550ms `var(--ease-liquid)` (transform and clip-path) |
| Hand-off to real cover | 600ms timeout after the transition starts |
| Backdrop fade in / out | 400ms ease / 400ms ease |
| Light | opacity 0→1, 500ms ease, delay 150ms |
| Text (eyebrow, title, meta, blurb, highlights, toggle) | opacity 350ms ease + translateY 18px→0 450ms `cubic-bezier(.2,.8,.2,1)`, both delayed 300ms |
| × and Add pill | opacity + scale .8→1, 250ms ease, delay 400ms |
| Text on close | opacity → 0 in 200ms, no delay, then ghost returns |
| Return flight | same 550ms, backdrop fades in parallel, finish at 560ms |
| No-origin open | backdrop 400ms fade, card scale .96→1 350ms `--ease-liquid`, text as above |
| Reduced motion | backdrop 150ms fade, no ghost, no rise, no scale |
| Swipe-down threshold | 90px, vertical, only at `scrollTop === 0` |

### 2g. Verification — Commit 2

- [ ] Grid view: tap a card — the cover lifts out of the card, uncropping as
      it grows, and lands exactly on the stage cover (no visible jump at
      hand-off). Test one portrait cover (Ark Nova) and one landscape cover
      (Viticulture).
- [ ] Shelf view (boxes on planks): same, lifting from the leaning box. A
      slight angle mismatch at the very start is acceptable (see Deviations).
- [ ] × / backdrop tap / swipe-down: cover flies back into its card while the
      page fades back in; the card is untouched afterwards.
- [ ] Change a filter behind the modal (or scroll the origin off screen),
      then close: plain fade, no ghost stranded.
- [ ] Waiting room, vote-swipe, results: plain fade in/out, text rises, no
      ghost.
- [ ] Open five games back to back on iPhone: no stray `.lift-ghost` elements
      in the DOM, no page reload.
- [ ] Tap × during the flight: modal closes cleanly, ghost removed.
- [ ] `prefers-reduced-motion: reduce`: instant appear/disappear with a
      150ms fade, no movement.
- [ ] Selection mode: the Add pill comes in with the ×; the lift still works
      via the ⓘ info button.
- [ ] Desktop panel: lift lands on the panel's cover; return works.
- [ ] No console errors on any page.

---

## Deviations from the mockup (deliberate)

- **× is a tinted plate, not blurred glass.** The mockup's × and Add pill use
  the glass material; in production they sit over content that scrolls under
  them, and the codebase already avoids `backdrop-filter` there for scroll
  performance on iOS. They keep the glass rim (`inset` gold ring + ivory
  highlight) on a `.92` plate tint.
- **Table-shot toggle kept.** The stage mockup showed no toggle; the 7 games
  with a table photo keep the existing Cover / On the table control under the
  hero rather than losing the feature.
- **Shelf-view lean.** Boxes in shelf view lean by `--lean`; the ghost starts
  axis-aligned from the box's bounding rect rather than rotated. A rotated
  start would need a third element — not worth it for a ±6° difference in the
  first 100ms.
- **Ghost image is the shelf's bitmap.** The lift uses `imageSmall` (already
  decoded on the shelf) and the stage swaps to `imageMid` once it loads, so
  the flight never waits on the network. A brief resolution step-up on the
  stage is expected.
- **Teach code deleted rather than flag-off.** Section, styles and scene
  wiring go; `js/teach-scenes.js` and the `teach` data are left in place for
  a separate cleanup.

## Files touched

- `js/game-modal.js` — Commit 1 and 2
- `css/game-modal.css` — Commit 1 and 2
- `shelf.html` — Commit 2 only (`onTileClick` / `openCard` pass the origin)
